import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import * as echarts from 'echarts';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  @ViewChild('cashflowChart', { static: false }) cashflowRef!: ElementRef;
  @ViewChild('compChart', { static: false }) compRef!: ElementRef;
  @ViewChild('patternsChart', { static: false }) patternsRef!: ElementRef;
  @ViewChild('treemapChart', { static: false }) treemapRef!: ElementRef;

  activeTab: 'score' | 'cashflow' | 'recurring' | 'comparison' | 'patterns' | 'independence' | 'anomalies' | 'treemap' = 'score';

  score: any = null;
  cashflow: any = null;
  recurring: any[] = [];
  comparison: any[] = [];
  patterns: any = null;
  independence: any = null;
  anomalies: any[] = [];
  treemap: any[] = [];

  loading: Record<string, boolean> = {};
  private charts: echarts.ECharts[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadTab(this.activeTab); }
  ngOnDestroy() { this.charts.forEach(c => c.dispose()); }

  setTab(tab: typeof this.activeTab) {
    this.activeTab = tab;
    this.loadTab(tab);
  }

  loadTab(tab: typeof this.activeTab) {
    this.loading[tab] = true;
    const done = () => { this.loading[tab] = false; setTimeout(() => this.buildCharts(), 100); };

    switch (tab) {
      case 'score':
        this.api.getFinancialScore().subscribe({ next: d => { this.score = d; done(); }, error: done });
        break;
      case 'cashflow':
        this.api.getCashFlow().subscribe({ next: d => { this.cashflow = d; done(); }, error: done });
        break;
      case 'recurring':
        this.api.getRecurring().subscribe({ next: d => { this.recurring = d as any[]; done(); }, error: done });
        break;
      case 'comparison':
        this.api.getMonthlyComparison(6).subscribe({ next: d => { this.comparison = d as any[]; done(); }, error: done });
        break;
      case 'patterns':
        this.api.getSpendingPatterns().subscribe({ next: d => { this.patterns = d; done(); }, error: done });
        break;
      case 'independence':
        this.api.getIndependencePoint().subscribe({ next: d => { this.independence = d; done(); }, error: done });
        break;
      case 'anomalies':
        this.api.getAnomalies().subscribe({ next: d => { this.anomalies = d as any[]; done(); }, error: done });
        break;
      case 'treemap':
        this.api.getTreemap().subscribe({ next: d => { this.treemap = d as any[]; done(); }, error: done });
        break;
    }
  }

  buildCharts() {
    this.charts.forEach(c => c.dispose());
    this.charts = [];
    if (this.activeTab === 'cashflow' && this.cashflow && this.cashflowRef) this.buildCashflow();
    if (this.activeTab === 'comparison' && this.comparison.length && this.compRef) this.buildComparison();
    if (this.activeTab === 'patterns' && this.patterns && this.patternsRef) this.buildPatterns();
    if (this.activeTab === 'treemap' && this.treemap.length && this.treemapRef) this.buildTreemap();
  }

  buildCashflow() {
    const el = this.cashflowRef.nativeElement;
    const c = echarts.init(el);
    this.charts.push(c);
    const days = this.cashflow.days || [];
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p: any) => {
        const d = p[0]; return `${d.axisValue}<br/>Saldo: ${this.fmt(d.value)}`;
      }},
      grid: { top: 20, bottom: 40, left: 60, right: 20 },
      xAxis: { type: 'category', data: days.map((d: any) => d.date), axisLabel: { color: '#888', fontSize: 11 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#888', fontSize: 11, formatter: (v: number) => this.fmtK(v) }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      series: [{
        type: 'line', data: days.map((d: any) => +d.balance),
        smooth: true, symbol: 'none',
        lineStyle: { color: '#6c63ff', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(108,99,255,.35)' }, { offset: 1, color: 'rgba(108,99,255,0)' }]) }
      }]
    });
  }

  buildComparison() {
    const el = this.compRef.nativeElement;
    const c = echarts.init(el);
    this.charts.push(c);
    const labels = this.comparison.map(m => m.monthLabel);
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#888' } },
      grid: { top: 20, bottom: 50, left: 65, right: 20 },
      xAxis: { type: 'category', data: labels, axisLabel: { color: '#888', fontSize: 11 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#888', formatter: (v: number) => this.fmtK(v) }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      series: [
        { name: 'Receita', type: 'bar', data: this.comparison.map(m => +m.income), itemStyle: { color: '#00c9a7', borderRadius: [4,4,0,0] } },
        { name: 'Despesa', type: 'bar', data: this.comparison.map(m => +m.expense), itemStyle: { color: '#ff6b6b', borderRadius: [4,4,0,0] } },
        { name: 'Líquido', type: 'line', data: this.comparison.map(m => +m.net), smooth: true, lineStyle: { color: '#ffd93d', width: 2 }, symbol: 'circle' }
      ]
    });
  }

  buildPatterns() {
    const el = this.patternsRef.nativeElement;
    const c = echarts.init(el);
    this.charts.push(c);
    const dow = this.patterns.byDayOfWeek || [];
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>Média: ${this.fmt(p[0].value)}` },
      grid: { top: 20, bottom: 40, left: 65, right: 20 },
      xAxis: { type: 'category', data: dow.map((d: any) => d.day), axisLabel: { color: '#888' }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#888', formatter: (v: number) => this.fmtK(v) }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      series: [{
        type: 'bar', data: dow.map((d: any) => +d.avg),
        itemStyle: { color: (p: any) => {
          const colors = ['#6c63ff','#00c9a7','#ffd93d','#ff6b6b','#4ecdc4','#ff8b94','#a78bfa'];
          return colors[p.dataIndex % colors.length];
        }, borderRadius: [6,6,0,0] }
      }]
    });
  }

  buildTreemap() {
    const el = this.treemapRef.nativeElement;
    const c = echarts.init(el);
    this.charts.push(c);
    const colors = ['#6c63ff','#00c9a7','#ffd93d','#ff6b6b','#4ecdc4','#ff8b94','#a78bfa','#38bdf8','#fb923c','#34d399'];
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { formatter: (p: any) => `${p.name}<br/>${this.fmt(p.value)}<br/>${p.data.pct?.toFixed(1)}%` },
      series: [{
        type: 'treemap', roam: false, nodeClick: false,
        breadcrumb: { show: false },
        data: this.treemap.map((d, i) => ({
          name: d.name, value: +d.value, pct: d.pct,
          itemStyle: { color: colors[i % colors.length] + 'cc' },
          label: { color: '#fff', fontSize: 13, fontWeight: 700 }
        }))
      }]
    });
  }

  scoreTier(score: number): string {
    if (score >= 850) return 'elite';
    if (score >= 700) return 'advanced';
    if (score >= 500) return 'intermediate';
    if (score >= 300) return 'beginner';
    return 'critical';
  }

  scoreColor(score: number): string {
    if (score >= 850) return '#ffd700';
    if (score >= 700) return '#00c9a7';
    if (score >= 500) return '#6c63ff';
    if (score >= 300) return '#ffd93d';
    return '#ff6b6b';
  }

  anomalySeverityColor(s: string) { return s === 'HIGH' ? '#ff4444' : '#ffd93d'; }

  fmt(v: number) { return (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  fmtK(v: number) { return Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toString(); }
  fmtPct(v: number) { return (+v || 0).toFixed(1) + '%'; }
  dashOffset(score: number, max = 1000) {
    const circumference = 2 * Math.PI * 54;
    return circumference - (Math.min(score, max) / max) * circumference;
  }
  tabs = [
    { key: 'score', label: 'Score', icon: '🏆' },
    { key: 'cashflow', label: 'Fluxo de Caixa', icon: '📈' },
    { key: 'recurring', label: 'Recorrentes', icon: '🔁' },
    { key: 'comparison', label: 'Comparativo', icon: '📊' },
    { key: 'patterns', label: 'Padrões', icon: '🧩' },
    { key: 'independence', label: 'Independência', icon: '🔥' },
    { key: 'anomalies', label: 'Anomalias', icon: '⚠️' },
    { key: 'treemap', label: 'Treemap', icon: '🗂' },
  ];
}
