import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import * as echarts from 'echarts';

@Component({
  selector: 'app-investor-mode',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './investor-mode.component.html',
  styleUrls: ['./investor-mode.component.scss']
})
export class InvestorModeComponent implements OnInit, OnDestroy {
  @ViewChild('allocChart', { static: false }) allocRef!: ElementRef;
  @ViewChild('perfChart', { static: false }) perfRef!: ElementRef;
  @ViewChild('riskChart', { static: false }) riskRef!: ElementRef;

  investments: any[] = [];
  loading = true;
  private charts: echarts.ECharts[] = [];

  totalInvested = 0;
  totalCurrent = 0;
  totalGain = 0;
  gainPct = 0;
  bestPerformer: any = null;
  worstPerformer: any = null;

  typeColors: Record<string, string> = {
    'ACAO': '#6c63ff', 'FII': '#00c9a7', 'RENDA_FIXA': '#ffd93d',
    'CRIPTO': '#ff6b6b', 'TESOURO': '#38bdf8', 'ETF': '#a78bfa',
    'CDB': '#fb923c', 'LCI': '#34d399', 'LCA': '#4ade80', 'FUNDO': '#f472b6'
  };

  typeLabels: Record<string, string> = {
    'ACAO': 'Ações', 'FII': 'FIIs', 'RENDA_FIXA': 'Renda Fixa',
    'CRIPTO': 'Cripto', 'TESOURO': 'Tesouro Direto', 'ETF': 'ETFs',
    'CDB': 'CDB', 'LCI': 'LCI', 'LCA': 'LCA', 'FUNDO': 'Fundos'
  };

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.charts.forEach(c => c.dispose()); }

  load() {
    this.api.getInvestments().subscribe({
      next: (data: any[]) => {
        this.investments = data || [];
        this.computeSummary();
        this.loading = false;
        setTimeout(() => { this.buildAlloc(); this.buildPerf(); this.buildRisk(); }, 100);
      },
      error: () => { this.loading = false; }
    });
  }

  computeSummary() {
    this.totalInvested = this.investments.reduce((s, i) => s + +i.initialAmount, 0);
    this.totalCurrent = this.investments.reduce((s, i) => s + +i.currentValue, 0);
    this.totalGain = this.totalCurrent - this.totalInvested;
    this.gainPct = this.totalInvested > 0 ? (this.totalGain / this.totalInvested) * 100 : 0;

    const sorted = [...this.investments].sort((a, b) =>
      (((+b.currentValue - +b.initialAmount) / +b.initialAmount) - ((+a.currentValue - +a.initialAmount) / +a.initialAmount)));
    this.bestPerformer = sorted[0];
    this.worstPerformer = sorted[sorted.length - 1];
  }

  buildAlloc() {
    if (!this.allocRef || !this.investments.length) return;
    const c = echarts.init(this.allocRef.nativeElement);
    this.charts.push(c);

    const byType: Record<string, number> = {};
    this.investments.forEach(i => {
      const t = i.type || 'OUTROS';
      byType[t] = (byType[t] || 0) + +i.currentValue;
    });

    const data = Object.entries(byType).map(([type, value]) => ({
      name: this.typeLabels[type] || type,
      value,
      itemStyle: { color: this.typeColors[type] || '#888' }
    }));

    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { formatter: (p: any) => `${p.name}<br/>${this.fmt(p.value)} (${p.percent}%)` },
      legend: { bottom: 0, textStyle: { color: '#888', fontSize: 11 }, orient: 'horizontal' },
      series: [{
        type: 'pie', radius: ['45%', '75%'], center: ['50%', '45%'],
        data,
        label: { show: false },
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: 'transparent' }
      }]
    });
  }

  buildPerf() {
    if (!this.perfRef || !this.investments.length) return;
    const c = echarts.init(this.perfRef.nativeElement);
    this.charts.push(c);

    const sorted = [...this.investments]
      .map(i => ({ name: i.name, pct: +i.initialAmount > 0 ? ((+i.currentValue - +i.initialAmount) / +i.initialAmount) * 100 : 0, type: i.type }))
      .sort((a, b) => b.pct - a.pct).slice(0, 10);

    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { formatter: (p: any) => `${p.name}: ${p.value.toFixed(2)}%` },
      grid: { top: 10, bottom: 60, left: 140, right: 40 },
      xAxis: { type: 'value', axisLabel: { color: '#888', formatter: (v: number) => v.toFixed(0) + '%' }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      yAxis: { type: 'category', data: sorted.map(s => s.name), axisLabel: { color: '#888', fontSize: 11, width: 120, overflow: 'truncate' } },
      series: [{
        type: 'bar',
        data: sorted.map(s => ({
          value: s.pct,
          itemStyle: { color: s.pct >= 0 ? (this.typeColors[s.type] || '#6c63ff') : '#ff6b6b', borderRadius: [0, 4, 4, 0] }
        })),
        label: { show: true, position: 'right', formatter: (p: any) => p.value.toFixed(1) + '%', color: '#888', fontSize: 11 }
      }]
    });
  }

  buildRisk() {
    if (!this.riskRef || !this.investments.length) return;
    const c = echarts.init(this.riskRef.nativeElement);
    this.charts.push(c);

    // Bubble: x=gain%, y=value, size=initialAmount
    const data = this.investments.map(i => {
      const pct = +i.initialAmount > 0 ? ((+i.currentValue - +i.initialAmount) / +i.initialAmount) * 100 : 0;
      return { name: i.name, value: [pct, +i.currentValue, +i.initialAmount], type: i.type };
    });

    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { formatter: (p: any) => `${p.data.name}<br/>Retorno: ${p.data.value[0].toFixed(1)}%<br/>Valor: ${this.fmt(p.data.value[1])}` },
      grid: { top: 20, bottom: 40, left: 65, right: 20 },
      xAxis: { type: 'value', name: 'Retorno %', axisLabel: { color: '#888', formatter: (v: number) => v.toFixed(0) + '%' }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } }, axisLine: { lineStyle: { color: '#555' } } },
      yAxis: { type: 'value', name: 'Valor Atual', axisLabel: { color: '#888', formatter: (v: number) => this.fmtK(v) }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      series: [{
        type: 'scatter',
        data: data.map(d => ({ ...d, symbolSize: Math.max(12, Math.sqrt(d.value[2] / 500)) })),
        itemStyle: { color: (p: any) => this.typeColors[p.data.type] || '#888', opacity: 0.8 }
      }]
    });
  }

  byType() {
    const map: Record<string, any[]> = {};
    this.investments.forEach(i => {
      const t = i.type || 'OUTROS';
      if (!map[t]) map[t] = [];
      map[t].push(i);
    });
    return Object.entries(map).map(([type, items]) => ({
      type, label: this.typeLabels[type] || type, color: this.typeColors[type] || '#888', items,
      total: items.reduce((s, i) => s + +i.currentValue, 0),
      gain: items.reduce((s, i) => s + (+i.currentValue - +i.initialAmount), 0)
    }));
  }

  invGain(i: any) { return +i.currentValue - +i.initialAmount; }
  invGainPct(i: any) { return +i.initialAmount > 0 ? ((+i.currentValue - +i.initialAmount) / +i.initialAmount) * 100 : 0; }
  fmt(v: number) { return (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  fmtPct(v: number) { return (+v || 0).toFixed(2) + '%'; }
  fmtK(v: number) { return Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v).toString(); }
  
  trackByLabel(index: number, item: any): string { return item.label; }
  trackByName(index: number, item: any): string { return item.name; }
}
