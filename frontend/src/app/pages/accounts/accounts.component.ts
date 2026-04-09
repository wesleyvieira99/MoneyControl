import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { DataSyncService, SyncEvent } from '../../core/services/data-sync.service';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit, OnDestroy {
  accounts: any[] = [];
  accountSummaries: { [id: number]: { cards: any[], investments: any[], debts: any[] } } = {};
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  historyAccount: any = null;
  historyTxs: any[] = [];
  historyCardTxs: any[] = [];
  historyTab: 'account' | 'cards' = 'account';
  balancePieOption: EChartsOption = {};
  balanceBarOption: EChartsOption = {};

  private readonly PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];
  private _sub?: Subscription;

  constructor(private api: ApiService, private sync: DataSyncService) {}

  ngOnInit() {
    this.reload();
    // Refresh summaries when a debt changes
    this._sub = this.sync.events$.subscribe((ev: SyncEvent) => {
      if (ev.type === 'DEBT_UPDATED' || ev.type === 'DEBTS_RELOADED') {
        this.loadAllSummaries();
      }
    });
  }

  ngOnDestroy() { this._sub?.unsubscribe(); }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.historyAccount) { this.historyAccount = null; return; }
    if (this.showModal)      { this.closeModal(); }
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(a: any) { this.editMode = true; this.form = { ...a }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  reload() {
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => {
      this.accounts = a;
      this.buildCharts();
      this.loadAllSummaries();
    });
  }

  loadAllSummaries() {
    this.accountSummaries = {};
    if (!this.accounts.length) return;
    const calls = this.accounts.map(acc =>
      this.api.getAccountSummary(acc.id).pipe(catchError(() => of({ cards: [], investments: [], debts: [] })))
    );
    forkJoin(calls).subscribe(results => {
      results.forEach((summary, i) => {
        this.accountSummaries[this.accounts[i].id] = summary;
      });
    });
  }

  getSummary(accountId: number) {
    return this.accountSummaries[accountId] || { cards: [], investments: [], debts: [] };
  }

  buildCharts() {
    if (!this.accounts.length) return;
    const total = this.totalBalance();

    // ── Donut: participação por conta ───────────────────────────────────────
    this.balancePieOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1200, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (p: any) => {
          const val = Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `<b style="color:#e2e8f0">${p.name}</b><br/><span style="color:#94a3b8">Saldo: </span><b style="color:${this.PALETTE[p.dataIndex % this.PALETTE.length]}">${val}</b><br/><span style="color:#94a3b8">Part.: </span><b>${p.percent}%</b>`;
        }
      },
      legend: { orient: 'vertical', right: '2%', top: 'center', textStyle: { color: '#94a3b8', fontSize: 11 }, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 8 },
      graphic: [{
        type: 'text', left: '31%', top: '43%',
        style: { text: total >= 0 ? '✅' : '⚠️', fontSize: 20, textAlign: 'center' }
      }, {
        type: 'text', left: '31%', top: '54%',
        style: { text: 'saldo total', fill: '#64748b', fontSize: 10, fontFamily: 'Inter', textAlign: 'center' }
      }],
      series: [{
        type: 'pie', radius: ['44%', '70%'], center: ['33%', '50%'],
        data: this.accounts.map((a, i) => ({
          name: a.name,
          value: +a.balance,
          itemStyle: {
            color: { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 1, colorStops: [{ offset: 0, color: a.color || this.PALETTE[i % this.PALETTE.length] }, { offset: 1, color: (a.color || this.PALETTE[i % this.PALETTE.length]) + 'bb' }] },
            shadowBlur: 8, shadowColor: (a.color || this.PALETTE[i % this.PALETTE.length]) + '44'
          }
        })),
        label: { show: false }, labelLine: { show: false },
        emphasis: { itemStyle: { shadowBlur: 28, shadowColor: 'rgba(0,0,0,0.6)' }, scaleSize: 6, scale: true },
        animationType: 'scale' as any, animationEasing: 'elasticOut' as any
      }]
    } as EChartsOption;

    // ── Bar: saldo por conta ─────────────────────────────────────────────────
    const sorted = [...this.accounts].sort((a, b) => b.balance - a.balance);
    this.balanceBarOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (p: any) => `<b style="color:#e2e8f0">${p[0]?.name}</b><br/><span style="color:#94a3b8">Saldo: </span><b style="color:#3b82f6">R$ ${Number(p[0]?.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>`
      },
      grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      yAxis: { type: 'category', data: sorted.map(a => a.name), axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 24,
        data: sorted.map((a, i) => {
          const c = a.color || this.PALETTE[i % this.PALETTE.length];
          return { value: +a.balance, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: c }, { offset: 1, color: c + 'aa' }] }, borderRadius: [0, 8, 8, 0], shadowBlur: 6, shadowColor: c + '44' } };
        }),
        label: { show: true, position: 'right', color: '#64748b', fontSize: 10, formatter: (p: any) => 'R$' + (Math.abs(p.value) >= 1000 ? (p.value / 1000).toFixed(1) + 'k' : p.value.toFixed(0)) },
        emphasis: { itemStyle: { shadowBlur: 16 } }
      }]
    } as EChartsOption;
  }

  save() {
    const obs = this.editMode ? this.api.updateAccount(this.form.id, this.form) : this.api.createAccount(this.form);
    obs.subscribe({ next: () => { this.closeModal(); this.reload(); }, error: () => { this.closeModal(); } });
  }
  delete(id: number) {
    if (confirm('Excluir esta conta? As transações vinculadas a ela também serão removidas.')) {
      this.api.deleteAccount(id).subscribe({
        next: () => this.reload(),
        error: (err) => alert('Erro ao excluir conta: ' + (err?.error?.message || err?.status || 'tente novamente'))
      });
    }
  }
  openHistory(a: any) {
    this.historyAccount = a;
    this.historyTxs = [];
    this.historyCardTxs = [];
    this.historyTab = 'account';
    this.api.getAccountTransactions(a.id).pipe(catchError(() => of([]))).subscribe(txs => this.historyTxs = txs);
    this.api.getAccountCardTransactions(a.id).pipe(catchError(() => of([]))).subscribe(txs => this.historyCardTxs = txs);
  }
  totalBalance() { return this.accounts.reduce((s, a) => s + +a.balance, 0); }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  countDebts(debts: any[], status: string): number { return debts?.filter(d => d.status === status).length || 0; }
  emptyForm() { return { name: '', bankName: '', balance: 0, color: '#3b82f6', logoUrl: '', accountNumber: '', notes: '' }; }
}
