import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, of } from 'rxjs';
import type { EChartsOption } from 'echarts';

const PORTFOLIO_PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './investments.component.html',
  styleUrls: ['./investments.component.scss']
})
export class InvestmentsComponent implements OnInit {
  Math = Math;
  investments: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  detailInvestment: any = null;
  detailTxs: any[] = [];
  showTxModal = false;
  txForm: any = {};
  portfolioChart: EChartsOption = {};
  gainChart: EChartsOption = {};

  types = ['STOCKS', 'CRYPTO', 'FIXED_INCOME', 'REAL_ESTATE', 'BETTING', 'OTHER'];
  typeIcons: any = { STOCKS: '📈', CRYPTO: '₿', FIXED_INCOME: '🏛️', REAL_ESTATE: '🏠', BETTING: '🎰', OTHER: '💼' };
  typeLabels: any = { STOCKS: 'Ações', CRYPTO: 'Cripto', FIXED_INCOME: 'Renda Fixa', REAL_ESTATE: 'FIIs', BETTING: 'Apostas', OTHER: 'Outros' };

  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.getAccounts().subscribe(a => this.accounts = a);
    this.loadInvestments();
  }

  loadInvestments() {
    this.api.getInvestments().pipe(catchError(() => of([]))).subscribe(inv => {
      this.investments = inv;
      this.buildPortfolioChart();
    });
  }

  buildPortfolioChart() {
    const typeGroups: any = {};
    this.investments.forEach(i => { typeGroups[i.type] = (typeGroups[i.type] || 0) + +i.currentValue; });
    const total = Object.values(typeGroups).reduce((s: any, v: any) => s + v, 0) as number;
    const entries = Object.entries(typeGroups);

    this.portfolioChart = {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8,12,28,0.96)',
        borderColor: 'rgba(139,92,246,0.35)',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#f1f5f9', fontSize: 13, fontFamily: 'Inter, sans-serif' },
        formatter: (p: any) => {
          const val = Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `<div style="font-weight:700;color:#e2e8f0;margin-bottom:6px">${p.name}</div>
            <div style="color:#94a3b8">Valor: <b style="color:${PORTFOLIO_PALETTE[p.dataIndex % PORTFOLIO_PALETTE.length]}">${val}</b></div>
            <div style="color:#94a3b8;margin-top:2px">Part.: <b style="color:#e2e8f0">${p.percent}%</b></div>`;
        }
      },
      legend: {
        orient: 'vertical', right: '2%', top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' },
        icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 10
      },
      graphic: total > 0 ? [{
        type: 'text', left: '31%', top: '42%',
        style: {
          text: 'R$ ' + (total >= 1000 ? (total / 1000).toFixed(0) + 'k' : total.toFixed(0)),
          fill: '#e2e8f0', fontSize: 16, fontWeight: 800, fontFamily: 'Inter, sans-serif', textAlign: 'center'
        }
      }, {
        type: 'text', left: '31%', top: '54%',
        style: { text: 'portfólio', fill: '#64748b', fontSize: 10, fontFamily: 'Inter, sans-serif', textAlign: 'center' }
      }] : [],
      series: [{
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['33%', '50%'],
        data: entries.map(([name, value], i) => ({
          name: this.typeLabels[name] || name,
          value: +(value as number),
          itemStyle: {
            color: {
              type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 1,
              colorStops: [
                { offset: 0, color: PORTFOLIO_PALETTE[i % PORTFOLIO_PALETTE.length] },
                { offset: 1, color: PORTFOLIO_PALETTE[i % PORTFOLIO_PALETTE.length] + 'bb' }
              ]
            },
            shadowBlur: 8,
            shadowColor: PORTFOLIO_PALETTE[i % PORTFOLIO_PALETTE.length] + '44'
          }
        })),
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 28, shadowColor: 'rgba(0,0,0,0.6)', shadowOffsetY: 4 },
          scaleSize: 6, scale: true
        },
        animationType: 'scale' as any,
        animationEasing: 'elasticOut' as any,
        animationDelay: 150
      }]
    } as EChartsOption;

    // ── Gain/Loss bar chart per asset ──────────────────────────────────────
    const sorted = [...this.investments]
      .sort((a, b) => (this.gain(b) - this.gain(a)));
    const top8 = sorted.slice(0, 8);

    this.gainChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)',
        borderColor: 'rgba(139,92,246,0.35)',
        borderWidth: 1, padding: [12, 16],
        textStyle: { color: '#f1f5f9', fontSize: 13, fontFamily: 'Inter, sans-serif' },
        formatter: (p: any) => {
          const g = p[0]?.value ?? 0;
          const color = g >= 0 ? '#10b981' : '#ef4444';
          return `<b style="color:#e2e8f0">${p[0]?.name}</b><br/>
            <span style="color:#94a3b8">Resultado: </span><b style="color:${color}">R$ ${Number(g).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>`;
        }
      },
      grid: { left: 8, right: 20, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      yAxis: {
        type: 'category',
        data: top8.map(i => i.ticker || i.name),
        axisLabel: { color: '#94a3b8', fontSize: 11, fontFamily: 'Inter' },
        axisLine: { show: false }, axisTick: { show: false }
      },
      series: [{
        type: 'bar', barMaxWidth: 24,
        data: top8.map(i => {
          const g = this.gain(i);
          const color = g >= 0 ? '#10b981' : '#ef4444';
          const colorFade = g >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';
          return {
            value: g,
            itemStyle: {
              color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color }, { offset: 1, color: colorFade }] },
              borderRadius: g >= 0 ? [0, 8, 8, 0] : [8, 0, 0, 8],
              shadowBlur: 6, shadowColor: color + '55'
            }
          };
        }),
        label: {
          show: true, position: 'right', fontFamily: 'Inter', fontSize: 10,
          color: '#64748b',
          formatter: (p: any) => (p.value >= 0 ? '+' : '') + 'R$' + (Math.abs(p.value) >= 1000 ? (Math.abs(p.value)/1000).toFixed(1)+'k' : Math.abs(p.value).toFixed(0))
        },
        emphasis: { itemStyle: { shadowBlur: 16 } }
      }]
    } as EChartsOption;
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(i: any) { this.editMode = true; this.form = { ...i, bankAccountId: i.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = { ...this.form, bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null };
    const obs = this.editMode ? this.api.updateInvestment(this.form.id, payload) : this.api.createInvestment(payload);
    obs.subscribe({ next: () => { this.closeModal(); this.loadInvestments(); }, error: () => this.closeModal() });
  }

  delete(id: number) {
    if (confirm('Excluir investimento?')) this.api.deleteInvestment(id).subscribe({ next: () => this.loadInvestments(), error: () => {} });
  }

  openDetail(inv: any) {
    this.detailInvestment = inv;
    this.api.getInvestmentTransactions(inv.id).pipe(catchError(() => of([]))).subscribe(txs => this.detailTxs = txs);
  }

  openTxModal() { this.txForm = { date: new Date().toISOString().slice(0,10), amount: 0, type: 'YIELD', notes: '' }; this.showTxModal = true; }
  closeTxModal() { this.showTxModal = false; }

  saveTx() {
    this.api.addInvestmentTransaction(this.detailInvestment.id, this.txForm).pipe(catchError(() => of(null))).subscribe(() => {
      this.closeTxModal();
      this.api.getInvestmentTransactions(this.detailInvestment.id).pipe(catchError(() => of([]))).subscribe(txs => this.detailTxs = txs);
    });
  }

  gain(inv: any) { return +inv.currentValue - +inv.initialAmount; }
  gainPct(inv: any) { return inv.initialAmount > 0 ? ((+inv.currentValue - +inv.initialAmount) / +inv.initialAmount * 100).toFixed(1) : '0.0'; }
  totalPortfolio() { return this.investments.reduce((s, i) => s + +i.currentValue, 0); }
  totalGain() { return this.investments.reduce((s, i) => s + (+i.currentValue - +i.initialAmount), 0); }
  typeTotal(type: string) { return this.getByType(type).reduce((s: number, i: any) => s + +i.currentValue, 0); }
  getProgressWidth(inv: any) { const pct = inv.initialAmount > 0 ? (+inv.currentValue / +inv.initialAmount) * 100 : 0; return Math.min(100, Math.max(0, pct)); }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  emptyForm() { return { name: '', ticker: '', type: 'STOCKS', isActive: true, initialAmount: 0, currentValue: 0, startDate: new Date().toISOString().slice(0,10), notes: '', logoUrl: '', bankAccountId: null }; }
  getByType(type: string) { return this.investments.filter((i: any) => i.type === type); }
}