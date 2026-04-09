import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { DataSyncService, SyncEvent } from '../../core/services/data-sync.service';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './cards.component.html',
  styleUrls: ['./cards.component.scss']
})
export class CardsComponent implements OnInit, OnDestroy {
  cards: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  invoiceCard: any = null;
  invoiceTransactions: any[] = [];
  invoiceDebts: any[] = [];
  invoiceDebtsWithInstallments: any[] = [];
  invoiceTab: 'transactions' | 'debts' = 'transactions';
  invoiceMonth = new Date().toISOString().slice(0,7);
  invoiceLoading = false;
  limitChart: EChartsOption = {};

  private readonly PALETTE = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
  private _sub?: Subscription;

  constructor(private api: ApiService, private sync: DataSyncService) {}

  ngOnInit() {
    this.api.getCards().pipe(catchError(() => of([]))).subscribe(c => { this.cards = c; this.buildChart(); });
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => this.accounts = a);
    // Listen for debt updates from debts page
    this._sub = this.sync.events$.subscribe((ev: SyncEvent) => {
      if (ev.type === 'DEBT_UPDATED' && this.invoiceCard) {
        // Update in-memory invoice debt if it's the one that changed
        const idx = this.invoiceDebtsWithInstallments.findIndex(d => d.id === ev.payload.debtId);
        if (idx !== -1) {
          const d = this.invoiceDebtsWithInstallments[idx];
          this.invoiceDebtsWithInstallments[idx] = {
            ...d,
            paidInstallments: ev.payload.paidInstallments,
            remainingAmount:  ev.payload.remainingAmount,
            status:           ev.payload.debtStatus
          };
          this.syncUsedLimit(this.invoiceCard.id, this.invoiceDebtsWithInstallments);
        }
      }
    });
  }

  ngOnDestroy() { this._sub?.unsubscribe(); }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.invoiceCard) { this.invoiceCard = null; return; }
    if (this.showModal)   { this.closeModal(); }
  }

  buildChart() {
    if (!this.cards.length) return;
    const sorted = [...this.cards].sort((a, b) => b.creditLimit - a.creditLimit);

    this.limitChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (p: any) => {
          const used = p[0]?.value ?? 0, limit = p[1]?.value ?? 0;
          const pct = limit > 0 ? ((used / limit) * 100).toFixed(0) : 0;
          return `<b style="color:#e2e8f0">${p[0]?.name}</b><br/>
            <span style="color:#94a3b8">Usado: </span><b style="color:#ef4444">R$ ${Number(used).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b><br/>
            <span style="color:#94a3b8">Limite: </span><b style="color:#10b981">R$ ${Number(limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b><br/>
            <span style="color:#94a3b8">Utilização: </span><b style="color:${+pct > 70 ? '#ef4444' : '#f59e0b'}">${pct}%</b>`;
        }
      },
      legend: { data: ['Utilizado', 'Limite'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 4, right: 8, icon: 'roundRect', itemWidth: 12, itemHeight: 6 },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: sorted.map(c => c.name), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      series: [
        {
          name: 'Utilizado', type: 'bar', barMaxWidth: 36, barGap: '-100%', z: 2,
          data: sorted.map((c, i) => {
            const col = c.color || this.PALETTE[i % this.PALETTE.length];
            const pct = c.creditLimit > 0 ? c.usedLimit / c.creditLimit : 0;
            const barCol = pct > 0.8 ? '#ef4444' : pct > 0.5 ? '#f59e0b' : col;
            return { value: +c.usedLimit, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: barCol }, { offset: 1, color: barCol + '66' }] }, borderRadius: [6,6,0,0], shadowBlur: 8, shadowColor: barCol + '55' } };
          }),
          emphasis: { itemStyle: { shadowBlur: 20 } }
        },
        {
          name: 'Limite', type: 'bar', barMaxWidth: 36, z: 1,
          data: sorted.map(() => ({ value: 0, itemStyle: { color: 'transparent' } })),
          markLine: {
            data: sorted.map((c, i) => ({ yAxis: +c.creditLimit, lineStyle: { color: this.PALETTE[i % this.PALETTE.length] + '44', width: 1, type: 'dashed' } })),
            symbol: 'none', silent: true
          }
        }
      ]
    } as EChartsOption;
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(c: any) { this.editMode = true; this.form = { ...c, bankAccountId: c.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  reloadCards() {
    this.api.getCards().pipe(catchError(() => of([]))).subscribe(c => { this.cards = c; this.buildChart(); });
  }

  save() {
    const payload = { ...this.form, bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null };
    const obs = this.editMode ? this.api.updateCard(this.form.id, payload) : this.api.createCard(payload);
    obs.subscribe({ next: () => { this.closeModal(); this.reloadCards(); }, error: () => this.closeModal() });
  }

  delete(id: number) {
    if (confirm('Excluir cartão?')) this.api.deleteCard(id).subscribe({ next: () => this.reloadCards(), error: () => {} });
  }

  openInvoice(card: any) {
    this.invoiceCard = card;
    this.invoiceTab = 'transactions';
    this.invoiceDebts = [];
    this.invoiceDebtsWithInstallments = [];
    this.invoiceLoading = true;
    this.loadInvoice();
    this.loadDebtsForCard(card.id);
  }

  loadInvoice() {
    this.api.getTransactions({ cardId: this.invoiceCard.id, start: this.invoiceMonth + '-01', end: this.invoiceMonth + '-31' })
      .pipe(catchError(() => of([]))).subscribe(txs => {
        this.invoiceTransactions = txs;
        this.invoiceLoading = false;
      });
  }

  loadDebtsForCard(cardId: number) {
    this.api.getDebtsByCard(cardId).pipe(catchError(() => of([]))).subscribe(debts => {
      this.invoiceDebts = debts;

      // Enrich each debt with its next pending installment
      if (debts.length === 0) {
        this.invoiceDebtsWithInstallments = [];
        this.syncUsedLimit(cardId, debts);
        return;
      }
      const requests = debts.map((d: any) =>
        this.api.getDebtInstallments(d.id).pipe(catchError(() => of([])))
      );
      forkJoin(requests).subscribe((allInstallments: any[]) => {
        this.invoiceDebtsWithInstallments = debts.map((d: any, i: number) => {
          const installments: any[] = allInstallments[i] || [];
          const pending = installments.filter((ins: any) => ins.status === 'PENDING' || ins.status === 'OVERDUE')
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
          const nextInstallment = pending[0] || null;
          const paid   = installments.filter((ins: any) => ins.status === 'PAID').length;
          const total  = installments.length || d.totalInstallments || 1;
          const overdue = installments.filter((ins: any) => ins.status === 'OVERDUE').length;
          return { ...d, _installments: installments, _nextInstallment: nextInstallment, _paidCount: paid, _total: total, _overdueCount: overdue };
        });
        this.syncUsedLimit(cardId, this.invoiceDebtsWithInstallments);
      });
    });
  }

  /** Recompute usedLimit on the card object from active debts */
  syncUsedLimit(cardId: number, debts: any[]) {
    const activeTotal = debts
      .filter((d: any) => d.status !== 'PAID')
      .reduce((sum: number, d: any) => sum + (+d.remainingAmount || 0), 0);

    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.usedLimit = activeTotal;
      if (this.invoiceCard?.id === cardId) this.invoiceCard = { ...card };
      this.buildChart();
    }
  }

  usedPercent(card: any) { return card.creditLimit > 0 ? Math.min(100, (card.usedLimit / card.creditLimit) * 100) : 0; }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  emptyForm() { return { name: '', bankName: '', creditLimit: 0, usedLimit: 0, closingDay: 15, dueDay: 22, color: '#820AD1', logoUrl: '', lastFourDigits: '', notes: '' }; }
  invoiceTotal() { return this.invoiceTransactions.reduce((s, t) => s + +t.amount, 0); }
  invoiceDebtMonthly() {
    return this.invoiceDebtsWithInstallments
      .filter(d => d.status !== 'PAID')
      .reduce((s: number, d: any) => {
        const inst = d._nextInstallment?.amount ?? (d.totalInstallments > 0 ? d.originalAmount / d.totalInstallments : 0);
        return s + +inst;
      }, 0);
  }
  invoiceTotalThisMonth() { return this.invoiceTotal() + this.invoiceDebtMonthly(); }
  totalUsed() { return this.cards.reduce((s, c) => s + +c.usedLimit, 0); }
  totalLimit() { return this.cards.reduce((s, c) => s + +c.creditLimit, 0); }

  debtStatusLabel(d: any): string {
    if (d.status === 'PAID')    return '✅ Quitada';
    if (d.status === 'OVERDUE' || d._overdueCount > 0) return '🔴 Atrasada';
    return '⏳ Pendente';
  }
  debtStatusClass(d: any): string {
    if (d.status === 'PAID')    return 'badge-green';
    if (d.status === 'OVERDUE' || d._overdueCount > 0) return 'badge-red';
    return 'badge-yellow';
  }
  nextDueLabel(d: any): string {
    if (!d._nextInstallment) return '—';
    const date = new Date(d._nextInstallment.dueDate + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  progressPct(d: any): number {
    const total = d._total || d.totalInstallments || 1;
    return Math.round(((d._paidCount || d.paidInstallments || 0) / total) * 100);
  }
}
