import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, of } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent implements OnInit {
  transactions: any[] = [];
  filtered: any[] = [];
  accounts: any[] = [];
  cards: any[] = [];
  categories: any[] = [];
  overdueCount = 0;
  loading = true;
  dailyFlowChart: EChartsOption = {};

  filters = { start: '', end: '', accountId: '', cardId: '', search: '', status: '', type: '' };
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();

  constructor(private api: ApiService) {}

  ngOnInit() {
    const now = new Date();
    this.filters.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    this.filters.end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    this.load();
  }

  load() {
    this.loading = true;
    Promise.all([
      this.api.getAccounts().pipe(catchError(() => of([]))).toPromise(),
      this.api.getCards().pipe(catchError(() => of([]))).toPromise(),
      this.api.getCategories().pipe(catchError(() => of([]))).toPromise(),
      this.api.getOverdueTransactions().pipe(catchError(() => of([]))).toPromise()
    ]).then(([accounts, cards, categories, overdue]: any[]) => {
      this.accounts = accounts || [];
      this.cards = cards || [];
      this.categories = categories || [];
      this.overdueCount = overdue?.length || 0;
      this.loadTransactions();
    });
  }

  loadTransactions() {
    const p: any = {};
    if (this.filters.start) p['start'] = this.filters.start;
    if (this.filters.end) p['end'] = this.filters.end;
    if (this.filters.accountId) p['accountId'] = this.filters.accountId;
    if (this.filters.cardId) p['cardId'] = this.filters.cardId;
    this.api.getTransactions(p).pipe(catchError(() => of([]))).subscribe(txs => {
      this.transactions = txs;
      this.applyFilters();
      this.loading = false;
    });
  }

  applyFilters() {
    let list = [...this.transactions];
    if (this.filters.search) list = list.filter(t => t.description?.toLowerCase().includes(this.filters.search.toLowerCase()));
    if (this.filters.status) list = list.filter(t => t.status === this.filters.status);
    if (this.filters.type) list = list.filter(t => t.type === this.filters.type);
    this.filtered = list;
    this.buildDailyFlowChart();
  }

  buildDailyFlowChart() {
    // Group income/expense by day
    const dayMap: { [key: string]: { income: number; expense: number } } = {};
    this.filtered.forEach(t => {
      const day = (t.date || '').slice(0, 10);
      if (!day) return;
      if (!dayMap[day]) dayMap[day] = { income: 0, expense: 0 };
      if (t.type === 'INCOME') dayMap[day].income += +t.amount;
      if (t.type === 'EXPENSE') dayMap[day].expense += +t.amount;
    });
    const days = Object.keys(dayMap).sort();
    if (days.length < 2) return;

    this.dailyFlowChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 12 },
        formatter: (p: any) => {
          const d = new Date(p[0]?.name).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          return `<b style="color:#e2e8f0">${d}</b><br/>
            ${p[0] ? `<span style="color:#94a3b8">📈 Receita: </span><b style="color:#10b981">${fmt(p[0].value)}</b><br/>` : ''}
            ${p[1] ? `<span style="color:#94a3b8">📉 Despesa: </span><b style="color:#ef4444">${fmt(p[1].value)}</b>` : ''}`;
        }
      },
      legend: { data: ['Receitas', 'Despesas'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 4, right: 8, icon: 'roundRect', itemWidth: 12, itemHeight: 6 },
      grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: days, axisLabel: { color: '#64748b', fontSize: 9, rotate: 30, formatter: (v: string) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => 'R$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      series: [
        {
          name: 'Receitas', type: 'bar', barMaxWidth: 14, barGap: '4%',
          data: days.map(d => dayMap[d].income),
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: 'rgba(16,185,129,0.2)' }] }, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(16,185,129,0.5)' } }
        },
        {
          name: 'Despesas', type: 'bar', barMaxWidth: 14,
          data: days.map(d => dayMap[d].expense),
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: 'rgba(239,68,68,0.2)' }] }, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(239,68,68,0.5)' } }
        }
      ]
    } as EChartsOption;
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(t: any) { this.editMode = true; this.form = { ...t, categoryId: t.category?.id, bankAccountId: t.bankAccount?.id, creditCardId: t.creditCard?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = this.buildPayload();
    const obs = this.editMode ? this.api.updateTransaction(this.form.id, payload) : this.api.createTransaction(payload);
    obs.subscribe(() => { this.closeModal(); this.loadTransactions(); });
  }

  buildPayload() {
    return {
      ...this.form,
      category: this.form.categoryId ? { id: +this.form.categoryId } : null,
      bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null,
      creditCard: this.form.creditCardId ? { id: +this.form.creditCardId } : null,
    };
  }

  delete(id: number) {
    if (confirm('Excluir transação?')) this.api.deleteTransaction(id).subscribe(() => this.loadTransactions());
  }

  toggleStatus(t: any) {
    const next = t.status === 'PAID' ? 'PENDING' : 'PAID';
    this.api.updateTransactionStatus(t.id, next).subscribe(() => this.loadTransactions());
  }

  emptyForm() {
    return { date: new Date().toISOString().slice(0,10), description: '', amount: null, type: 'EXPENSE', status: 'PENDING', categoryId: null, bankAccountId: null, creditCardId: null, notes: '', isRecurring: false };
  }

  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  typeColor(t: string) { return ({ INCOME: 'green', EXPENSE: 'red', TRANSFER: 'blue', INVESTMENT: 'purple' } as any)[t] || 'blue'; }
  statusColor(s: string) { return ({ PAID: 'green', PENDING: 'yellow', OVERDUE: 'red', CANCELLED: 'blue' } as any)[s] || 'blue'; }
  totalIncome() { return this.filtered.filter(t => t.type === 'INCOME').reduce((s, t) => s + +t.amount, 0); }
  totalExpense() { return this.filtered.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + +t.amount, 0); }
  countTransfers() { return this.filtered.filter(t => t.type === 'TRANSFER').length; }
  countPending() { return this.filtered.filter(t => t.status === 'PENDING').length; }
}
