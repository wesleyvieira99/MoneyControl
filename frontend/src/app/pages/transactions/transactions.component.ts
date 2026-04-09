import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { DataSyncService, SyncEvent } from '../../core/services/data-sync.service';
import { catchError, of, forkJoin, firstValueFrom, Subscription } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent implements OnInit, OnDestroy {
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

  showRecurringModal = false;
  recurringUntil = '';
  pendingPayload: any = null;

  private _sub?: Subscription;

  constructor(private api: ApiService, private sync: DataSyncService) {}

  ngOnInit() {
    const now = new Date();
    this.filters.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    this.filters.end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
    this.load();
    // Refresh when installments are toggled (status of debt-linked transactions may change)
    this._sub = this.sync.events$.subscribe((ev: SyncEvent) => {
      if (ev.type === 'DEBT_UPDATED' || ev.type === 'TRANSACTIONS_CHANGED') {
        this.loadTransactions();
      }
    });
  }

  ngOnDestroy() { this._sub?.unsubscribe(); }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showRecurringModal) { this.showRecurringModal = false; return; }
    if (this.showModal)          { this.closeModal(); }
  }

  /** Quickly jump to a preset date range */
  setRange(preset: 'month' | '3months' | '6months' | 'year' | 'all') {
    const now = new Date();
    switch (preset) {
      case 'month':
        this.filters.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
        this.filters.end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
        break;
      case '3months':
        this.filters.start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0,10);
        this.filters.end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
        break;
      case '6months':
        this.filters.start = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0,10);
        this.filters.end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
        break;
      case 'year':
        this.filters.start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0,10);
        this.filters.end   = new Date(now.getFullYear(), 11, 31).toISOString().slice(0,10);
        break;
      case 'all':
        this.filters.start = '2020-01-01';
        this.filters.end   = '2030-12-31';
        break;
    }
    this.loadTransactions();
  }

  load() {
    this.loading = true;
    Promise.all([
      firstValueFrom(this.api.getAccounts().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getCards().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getCategories().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getOverdueTransactions().pipe(catchError(() => of([]))))
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
    // totals & chart always use ALL transactions (no type/status/search filter)
    // so the summary is never distorted by active column filters
    this.buildDailyFlowChart();
  }

  buildDailyFlowChart() {
    // Always use full transactions list (ignoring type/status/search filters)
    // so the chart always shows the real picture for the selected date range
    const source = this.transactions;
    const dayMap: { [key: string]: { income: number; expense: number } } = {};
    source.forEach(t => {
      const day = (t.date || '').slice(0, 10);
      if (!day) return;
      if (!dayMap[day]) dayMap[day] = { income: 0, expense: 0 };
      if (t.type === 'INCOME')  dayMap[day].income  += +t.amount;
      if (t.type === 'EXPENSE') dayMap[day].expense += +t.amount;
    });
    const days = Object.keys(dayMap).sort();
    if (days.length < 1) return;

    this.dailyFlowChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 12 },
        formatter: (params: any) => {
          const d = new Date(params[0]?.name + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
          const fmt = (v: number) => 'R$\u00a0' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const inc = params.find((p: any) => p.seriesName === 'Receitas');
          const exp = params.find((p: any) => p.seriesName === 'Despesas');
          const net = (inc?.value || 0) - (exp?.value || 0);
          return `<b style="color:#e2e8f0">${d}</b><br/>` +
            (inc?.value > 0 ? `<span style="color:#94a3b8">📈 Receita: </span><b style="color:#10b981">${fmt(inc.value)}</b><br/>` : '') +
            (exp?.value > 0 ? `<span style="color:#94a3b8">📉 Despesa: </span><b style="color:#ef4444">${fmt(exp.value)}</b><br/>` : '') +
            `<span style="color:#94a3b8">Saldo dia: </span><b style="${net >= 0 ? 'color:#10b981' : 'color:#f87171'}">${net >= 0 ? '+' : ''}${fmt(net)}</b>`;
        }
      },
      legend: {
        data: ['Receitas', 'Despesas'],
        textStyle: { color: '#94a3b8', fontSize: 11 }, top: 4, right: 8,
        icon: 'roundRect', itemWidth: 12, itemHeight: 6
      },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category', data: days,
        axisLabel: { color: '#64748b', fontSize: 9, rotate: 30, formatter: (v: string) => new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false }
      },
      series: [
        {
          name: 'Receitas', type: 'bar', barMaxWidth: 18, barGap: '6%',
          data: days.map(d => dayMap[d].income),
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: 'rgba(16,185,129,0.15)' }] }, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(16,185,129,0.5)' } },
          label: {
            show: true, position: 'top', color: '#34d399', fontSize: 9, fontWeight: 700,
            formatter: (p: any) => p.value > 0 ? (p.value >= 1000 ? 'R$' + (p.value/1000).toFixed(1)+'k' : 'R$'+p.value.toFixed(0)) : ''
          }
        },
        {
          name: 'Despesas', type: 'bar', barMaxWidth: 18,
          data: days.map(d => dayMap[d].expense),
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: 'rgba(239,68,68,0.15)' }] }, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(239,68,68,0.5)' } },
          label: {
            show: true, position: 'top', color: '#f87171', fontSize: 9, fontWeight: 700,
            formatter: (p: any) => p.value > 0 ? (p.value >= 1000 ? 'R$' + (p.value/1000).toFixed(1)+'k' : 'R$'+p.value.toFixed(0)) : ''
          }
        }
      ]
    } as EChartsOption;
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(t: any) { this.editMode = true; this.form = { ...t, categoryId: t.category?.id, bankAccountId: t.bankAccount?.id, creditCardId: t.creditCard?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  /** Called immediately when the recurring checkbox is ticked */
  onRecurringToggle(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      // turn off perennial if it was on
      this.form.isPerennialRecurring = false;
      this.form.isRecurring = true;
      // Pop the "until when" modal ON TOP of the main modal (keep showModal = true)
      this.pendingPayload = this.buildPayload();
      this.recurringUntil = '';
      // Do NOT close the main modal — overlay will appear on top
      this.showRecurringModal = true;
    } else {
      this.form.isRecurring = false;
    }
  }

  /** Called when the perennial checkbox is toggled */
  onPerennialToggle() {
    if (this.form.isPerennialRecurring) {
      this.form.isRecurring = false;
    }
  }

  /** How many monthly recurrences will be created */
  calcRecurringCount(): number {
    if (!this.recurringUntil || !this.pendingPayload?.date) return 0;
    const [sy, sm, sd] = (this.pendingPayload.date as string).split('-').map(Number);
    const [uy, um] = this.recurringUntil.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const until = new Date(uy, um, 0); // last day of "until" month
    let count = 0;
    let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur <= until) { count++; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()); }
    return count;
  }

  save() {
    const payload = this.buildPayload();
    if (!this.editMode && payload.isPerennialRecurring) {
      // Perennial: create 24 months silently
      const creates: any[] = [];
      const startDate = new Date(payload.date);
      startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
      for (let i = 0; i < 24; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
        creates.push(this.api.createTransaction({
          ...payload, date: d.toISOString().slice(0, 10),
          isRecurring: true,
          status: d < new Date() ? 'OVERDUE' : 'PENDING'
        }).pipe(catchError(() => of(null))));
      }
      forkJoin(creates).subscribe(() => { this.closeModal(); this.loadTransactions(); });
      return;
    }
    // Normal single or already-handled recurring (modal was shown on checkbox tick)
    this.doSave(payload);
  }

  confirmRecurring() {
    if (!this.pendingPayload || !this.recurringUntil) return;
    const payload = this.pendingPayload;
    const startDate = new Date(payload.date);
    startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
    // recurringUntil is YYYY-MM — treat as last day of that month
    const [uy, um] = this.recurringUntil.split('-').map(Number);
    const untilDate = new Date(uy, um, 0); // last day of selected month

    // Cria a primeira ocorrência + todas as futuras até a data limite
    const creates: any[] = [];
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    while (cur <= untilDate) {
      const entry = {
        ...payload,
        date: cur.toISOString().slice(0, 10),
        isRecurring: true,
        status: cur < new Date() ? 'OVERDUE' : 'PENDING',
      };
      creates.push(this.api.createTransaction(entry).pipe(catchError(() => of(null))));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()); // +1 mês
    }
    this.showRecurringModal = false;
    this.showModal = false;
    this.pendingPayload = null;
    forkJoin(creates).subscribe(() => this.loadTransactions());
  }

  cancelRecurring() {
    this.showRecurringModal = false;
    // Cria apenas uma sem recorrência, then close main modal
    if (this.pendingPayload) {
      const single = { ...this.pendingPayload, isRecurring: false };
      this.pendingPayload = null;
      this.showModal = false;
      this.api.createTransaction(single).pipe(catchError(() => of(null)))
        .subscribe(() => this.loadTransactions());
    } else {
      this.pendingPayload = null;
    }
    // Uncheck the checkbox in the form
    this.form.isRecurring = false;
  }

  doSave(payload: any) {
    const obs = this.editMode
      ? this.api.updateTransaction(this.form.id, payload)
      : this.api.createTransaction(payload);
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
    return {
      date: new Date().toISOString().slice(0,10),
      description: '', amount: null, type: 'EXPENSE', status: 'PENDING',
      categoryId: null, bankAccountId: null, creditCardId: null,
      notes: '', isRecurring: false, isPerennialRecurring: false
    };
  }

  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  typeColor(t: string) { return ({ INCOME: 'green', EXPENSE: 'red', TRANSFER: 'blue', INVESTMENT: 'purple' } as any)[t] || 'blue'; }
  statusColor(s: string) { return ({ PAID: 'green', PENDING: 'yellow', OVERDUE: 'red', CANCELLED: 'blue' } as any)[s] || 'blue'; }
  get today1st() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  }

  totalIncome()  { return this.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + +t.amount, 0); }
  totalExpense() { return this.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + +t.amount, 0); }
  netBalance()   { return this.totalIncome() - this.totalExpense(); }
  countTransfers() { return this.filtered.filter(t => t.type === 'TRANSFER').length; }
  countPending()   { return this.filtered.filter(t => t.status === 'PENDING' || t.status === 'OVERDUE').length; }
}
