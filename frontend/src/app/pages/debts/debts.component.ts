import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, of } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit {
  debts: any[] = [];
  cards: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  debtProgressChart: EChartsOption = {};
  debtBreakdownChart: EChartsOption = {};

  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.getDebts().pipe(catchError(() => of([]))).subscribe(d => { this.debts = d; this.buildCharts(); });
    this.api.getCards().pipe(catchError(() => of([]))).subscribe(c => this.cards = c);
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => this.accounts = a);
  }

  buildCharts() {
    if (!this.debts.length) return;

    // ── Radial progress bars per debt (using gauge series) ─────────────────
    const top5 = [...this.debts].sort((a, b) => b.originalAmount - a.originalAmount).slice(0, 5);
    const PALETTE = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444'];

    this.debtProgressChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1200, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'item', backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 12 }
      },
      series: top5.map((d, i) => {
        const pct = d.totalInstallments > 0 ? Math.round((d.paidInstallments / d.totalInstallments) * 100) : 0;
        const col = PALETTE[i % PALETTE.length];
        const cols = 5;
        const w = 100 / cols;
        return {
          type: 'gauge',
          center: [`${w * i + w / 2}%`, '55%'],
          radius: '42%',
          startAngle: 200, endAngle: -20, min: 0, max: 100,
          progress: { show: true, width: 8, roundCap: true, itemStyle: { color: col } },
          axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(255,255,255,0.06)']] } },
          axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
          pointer: { show: false }, anchor: { show: false },
          title: { offsetCenter: [0, '68%'], fontSize: 9, color: '#64748b', fontFamily: 'Inter' },
          detail: {
            valueAnimation: true, fontSize: 13, fontWeight: 800, color: col,
            offsetCenter: [0, '18%'], formatter: '{value}%', fontFamily: 'Inter'
          },
          data: [{ value: pct, name: d.description?.slice(0, 10) || 'Dívida' }]
        };
      }) as any
    } as EChartsOption;

    // ── Horizontal bar: remaining per debt ──────────────────────────────────
    const sorted = [...this.debts].sort((a, b) => b.remainingAmount - a.remainingAmount).slice(0, 8);
    this.debtBreakdownChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (p: any) => `<b style="color:#e2e8f0">${p[0]?.name}</b><br/><span style="color:#94a3b8">Restante: </span><b style="color:#ef4444">R$ ${Number(p[0]?.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>`
      },
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      yAxis: { type: 'category', data: sorted.map(d => d.description?.slice(0, 16) || '—'), axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 22,
        data: sorted.map((d, i) => {
          const pct = d.totalInstallments > 0 ? d.paidInstallments / d.totalInstallments : 0;
          const col = pct > 0.7 ? '#10b981' : pct > 0.4 ? '#f59e0b' : '#ef4444';
          return { value: +d.remainingAmount, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: col }, { offset: 1, color: col + 'aa' }] }, borderRadius: [0, 8, 8, 0], shadowBlur: 6, shadowColor: col + '55' } };
        }),
        label: { show: true, position: 'right', color: '#64748b', fontSize: 10, formatter: (p: any) => 'R$' + (Math.abs(p.value) >= 1000 ? (p.value / 1000).toFixed(1) + 'k' : p.value.toFixed(0)) },
        emphasis: { itemStyle: { shadowBlur: 16 } }
      }]
    } as EChartsOption;
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(d: any) { this.editMode = true; this.form = { ...d, creditCardId: d.creditCard?.id, bankAccountId: d.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  reloadDebts() {
    this.api.getDebts().pipe(catchError(() => of([]))).subscribe(d => { this.debts = d; this.buildCharts(); });
  }

  save() {
    const payload = {
      ...this.form,
      creditCard: this.form.creditCardId ? { id: +this.form.creditCardId } : null,
      bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null,
    };
    const obs = this.editMode ? this.api.updateDebt(this.form.id, payload) : this.api.createDebt(payload);
    obs.subscribe({ next: () => { this.closeModal(); this.reloadDebts(); }, error: () => this.closeModal() });
  }

  delete(id: number) {
    if (confirm('Excluir dívida?')) this.api.deleteDebt(id).subscribe({ next: () => this.reloadDebts(), error: () => {} });
  }

  progress(d: any) { return d.totalInstallments > 0 ? (d.paidInstallments / d.totalInstallments) * 100 : 0; }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  totalDebt() { return this.debts.reduce((s, d) => s + +d.remainingAmount, 0); }
  countByStatus(status: string) { return this.debts.filter(d => d.status === status).length; }

  emptyForm() {
    return { description: '', originalAmount: 0, remainingAmount: 0, totalInstallments: 12, paidInstallments: 0, startDate: new Date().toISOString().slice(0,10), status: 'PENDING', notes: '', creditCardId: null, bankAccountId: null };
  }
}
