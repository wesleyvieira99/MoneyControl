import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, forkJoin, of } from 'rxjs';
import type { EChartsOption } from 'echarts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IsolatedIframeDirective } from '../../core/directives/isolated-iframe.directive';

interface InsightCard {
  icon: string;
  title: string;
  desc: string;
  color: 'green' | 'blue' | 'gold' | 'red' | 'purple';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, IsolatedIframeDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('tvScreen') tvScreen?: ElementRef;

  summary: any = {};
  loading = true;
  error = false;
  isMockData = false;
  selectedMonth = new Date().toISOString().slice(0, 7);
  activeTab = 'overview';
  insightIndex = 0;
  private insightTimer: any;

  // Card flip animation
  flippedCard: string | null = null;
  cardAnimating = false;

  // TV Channels
  currentChannelIndex = 0;
  tvMuted = false;
  showAddChannelModal = false;
  showEditChannelModal = false;
  editingChannelIndex = -1;
  tvReady = true;
  currentTvUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl('');
  
  tvChannels = [
    { 
      name: 'GBN', 
      url: 'https://www.youtube.com/watch?v=QliL4CGc7iY', 
      initial: 'G',
      color: '#0047AB' 
    },
    { 
      name: 'ABC News', 
      url: 'https://www.youtube.com/watch?v=w_Ma8oQLmSM', 
      initial: 'A',
      color: '#FFD500' 
    },
    { 
      name: 'France 24', 
      url: 'https://www.youtube.com/watch?v=Ap-UM1O9RBU', 
      initial: 'F',
      color: '#E4002B' 
    },
    { 
      name: 'FOX News', 
      url: 'https://www.youtube.com/watch?v=ADXWeM9wsDw', 
      initial: 'F',
      color: '#003366' 
    },
    { 
      name: 'Sky News', 
      url: 'https://www.youtube.com/watch?v=9Auq9mYxFEE',
      initial: 'S',
      color: '#0072C6' 
    },
    { 
      name: 'Bloomberg', 
      url: 'https://www.youtube.com/watch?v=dp8PhLsUcFE',
      initial: 'B',
      color: '#000000' 
    }
  ];
  newChannel = { name: '', url: '', initial: '', color: '#3b82f6' };
  editingChannel = { name: '', url: '', initial: '', color: '#3b82f6' };

  // News section
  activeNewsSource = 0;
  newsSources = [
    { label: '📡 Mercados', icon: '📡', id: 'markets' },
    { label: '🌍 Mundo', icon: '🌍', id: 'world' },
    { label: '💹 Câmbio', icon: '💹', id: 'forex' },
    { label: '📊 Cripto', icon: '📊', id: 'crypto' },
  ];
  newsWidgets = [
    { src: 'https://www.finlogix.com/widget/economic-calendar?theme=dark&lang=pt&color=%238b5cf6', label: 'Calendário Econômico' },
    { src: 'https://www.finlogix.com/widget/market-news?theme=dark&lang=pt', label: 'Notícias de Mercado' },
  ];

  insights: InsightCard[] = [];

  balanceChartOption: EChartsOption = {};
  donutChartOption: EChartsOption = {};
  heatmapOption: EChartsOption = {};
  heatmapYear = new Date().getFullYear().toString();
  heatmapMonth: string = '';          // '' = ano completo, '01'–'12' = mês
  heatmapView: 'year' | 'month' = 'year';
  private rawHeatData: any[] = [];
  incomeVsExpenseOption: EChartsOption = {};
  savingsRateOption: EChartsOption = {};
  categoryBarOption: EChartsOption = {};
  netWorthOption: EChartsOption = {};
  dailyOption: EChartsOption = {};

  constructor(private api: ApiService, private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef) {}
  
  ngOnInit() { 
    this.loadData();
    this.updateTvUrl();
  }
  
  ngOnDestroy() { clearInterval(this.insightTimer); }

  /* ── Mock fallback data ── */
  private mockSummary = {
    totalBalance: 18450.75,
    monthlyIncome: 8200.00,
    monthlyExpense: 5340.20,
    netWorth: 42800.00,
    totalInvested: 24350.00,
    netMonth: 2859.80,
  };

  private mockHistory = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i],
    income:  7000 + Math.random() * 3000,
    expense: 4000 + Math.random() * 2500,
    net:     1500 + Math.random() * 2000,
  }));

  private mockCategories = [
    { category: 'Alimentação',   amount: 1200 },
    { category: 'Transporte',    amount:  850 },
    { category: 'Moradia',       amount: 1600 },
    { category: 'Lazer',         amount:  430 },
    { category: 'Saúde',         amount:  320 },
    { category: 'Educação',      amount:  290 },
    { category: 'Outros',        amount:  650 },
  ];

  private mockHeatmap = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), 0, i + 1);
    return { date: d.toISOString().slice(0, 10), value: Math.random() * 800 };
  });

  loadData() {
    this.loading = true;
    this.error = false;

    forkJoin({
      summary:    this.api.getDashboardSummary(this.selectedMonth).pipe(catchError(() => of(null))),
      history:    this.api.getBalanceHistory(12).pipe(catchError(() => of(null))),
      categories: this.api.getCategoryBreakdown(this.selectedMonth).pipe(catchError(() => of(null))),
      heatmap:    this.api.getHeatmap(this.selectedMonth.slice(0, 4)).pipe(catchError(() => of(null))),
      insights:   this.api.getInsights(this.selectedMonth).pipe(catchError(() => of(null))),
    }).subscribe(({ summary, history, categories, heatmap, insights }) => {
      const usedMock = !summary || (!history?.length && !categories?.length);
      this.isMockData = usedMock;
      this.summary   = summary   ?? this.mockSummary;
      const hist     = (history   && history.length)   ? history   : this.mockHistory;
      const cats     = (categories && categories.length) ? categories : this.mockCategories;
      const heat     = (heatmap   && heatmap.length)   ? heatmap   : this.mockHeatmap;

      this.rawHeatData = heat;
      this.heatmapYear = this.selectedMonth.slice(0, 4);
      
      // Usa insights do GPT se disponíveis, senão gera localmente
      if (insights && insights.length > 0) {
        this.insights = insights;
      } else {
        this.buildInsights(hist, cats);
      }
      
      this.buildBalanceChart(hist);
      this.buildDonutChart(cats);
      this.buildHeatmap(heat);
      this.loading = false;
      this.cdr.markForCheck();

      this.insightTimer = setInterval(() => {
        this.insightIndex = (this.insightIndex + 1) % this.insights.length;
        this.cdr.markForCheck();
      }, 4500);
    });
  }

  /* ── Insights carousel ── */
  buildInsights(hist: any[], cats: any[]) {
    const last = hist[hist.length - 1] || { income: 0, expense: 0, net: 0 };
    const savPct = last.income > 0 ? Math.round(((last.income - last.expense) / last.income) * 100) : 0;
    const topCat = [...cats].sort((a, b) => b.amount - a.amount)[0];
    const avgExp = cats.reduce((s: number, c: any) => s + c.amount, 0);
    const months = hist.length;
    const trend  = hist.length >= 2
      ? hist[hist.length - 1].net - hist[hist.length - 2].net
      : 0;

    this.insights = [
      {
        icon: savPct >= 20 ? '🏆' : savPct >= 10 ? '📊' : '⚠️',
        title: `Taxa de poupança: ${savPct}%`,
        desc: savPct >= 20
          ? 'Excelente! Você está acima da meta recomendada de 20%.'
          : savPct >= 10
          ? 'Bom ritmo! Tente aumentar gradualmente para 20%.'
          : 'Atenção: tente reduzir despesas ou aumentar receitas.',
        color: savPct >= 20 ? 'green' : savPct >= 10 ? 'gold' : 'red',
      },
      {
        icon: '🏷️',
        title: `Maior gasto: ${topCat?.category ?? '—'}`,
        desc: `R$ ${(topCat?.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no mês — verifique oportunidades de redução nesta categoria.`,
        color: 'blue',
      },
      {
        icon: trend >= 0 ? '📈' : '📉',
        title: trend >= 0 ? 'Tendência positiva 🎉' : 'Tendência de queda ⚠️',
        desc: `Seu saldo ${trend >= 0 ? 'cresceu' : 'caiu'} R$ ${Math.abs(trend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em relação ao mês anterior.`,
        color: trend >= 0 ? 'green' : 'red',
      },
      {
        icon: '🔮',
        title: 'Projeção anual',
        desc: `Mantendo o ritmo atual, você poupará cerca de R$ ${(last.net * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} este ano.`,
        color: 'purple',
      },
      {
        icon: '💡',
        title: 'Dica financeira',
        desc: 'Automatize suas transferências para a reserva de emergência logo após receber seu salário.',
        color: 'gold',
      },
    ];
  }

  nextInsight() { this.insightIndex = (this.insightIndex + 1) % this.insights.length; }
  prevInsight() { this.insightIndex = (this.insightIndex - 1 + this.insights.length) % this.insights.length; }

  buildBalanceChart(data: any[]) {
    // ── Ultra-premium Income vs Expense bar + net line ──────────────────────
    this.balanceChartOption = {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)',
        borderColor: 'rgba(139,92,246,0.35)',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: '#f1f5f9', fontSize: 13, fontFamily: 'Inter, sans-serif' },
        axisPointer: { type: 'cross', crossStyle: { color: 'rgba(139,92,246,0.25)', width: 1 }, lineStyle: { color: 'rgba(139,92,246,0.25)', type: 'dashed' } },
        formatter: (params: any) => {
          const p0 = params[0], p1 = params[1], p2 = params[2];
          const fmt = (v: number) => 'R$ ' + (v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          return `<div style="font-weight:700;margin-bottom:8px;color:#e2e8f0">${p0?.name}</div>
            ${p0 ? `<div style="display:flex;gap:8px;align-items:center"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981"></span><span style="color:#94a3b8">Receita</span><b style="margin-left:auto;color:#10b981">${fmt(p0.value)}</b></div>` : ''}
            ${p1 ? `<div style="display:flex;gap:8px;align-items:center;margin-top:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444"></span><span style="color:#94a3b8">Despesa</span><b style="margin-left:auto;color:#ef4444">${fmt(p1.value)}</b></div>` : ''}
            ${p2 ? `<div style="display:flex;gap:8px;align-items:center;margin-top:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3b82f6"></span><span style="color:#94a3b8">Saldo</span><b style="margin-left:auto;color:#3b82f6">${fmt(p2.value)}</b></div>` : ''}`;
        }
      },
      legend: {
        data: ['Receita', 'Despesa', 'Saldo Líquido'],
        textStyle: { color: '#94a3b8', fontSize: 12, fontFamily: 'Inter, sans-serif' },
        top: 4, right: 8, icon: 'roundRect', itemWidth: 12, itemHeight: 6, itemGap: 16
      },
      grid: { left: 12, right: 12, top: 44, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((d: any) => d.month),
        axisLabel: { color: '#64748b', fontSize: 11, fontFamily: 'Inter, sans-serif' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 11, fontFamily: 'Inter', formatter: (v: number) => v >= 1000 ? 'R$' + (v/1000).toFixed(0) + 'k' : 'R$' + v },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } },
        axisLine: { show: false }
      },
      series: [
        {
          name: 'Receita', type: 'bar',
          data: data.map((d: any) => d.income),
          barMaxWidth: 32, barGap: '8%',
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 0.6, color: '#059669' }, { offset: 1, color: 'rgba(16,185,129,0.25)' }] },
            borderRadius: [8, 8, 0, 0]
          },
          emphasis: { itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#34d399' }, { offset: 1, color: 'rgba(52,211,153,0.3)' }] }, shadowBlur: 20, shadowColor: 'rgba(16,185,129,0.6)' } }
        },
        {
          name: 'Despesa', type: 'bar',
          data: data.map((d: any) => d.expense),
          barMaxWidth: 32,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 0.6, color: '#dc2626' }, { offset: 1, color: 'rgba(239,68,68,0.25)' }] },
            borderRadius: [8, 8, 0, 0]
          },
          emphasis: { itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#f87171' }, { offset: 1, color: 'rgba(248,113,113,0.3)' }] }, shadowBlur: 20, shadowColor: 'rgba(239,68,68,0.6)' } }
        },
        {
          name: 'Saldo Líquido', type: 'line',
          data: data.map((d: any) => d.net),
          smooth: 0.5, symbol: 'circle', symbolSize: 8, z: 10,
          lineStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#818cf8' }, { offset: 0.5, color: '#3b82f6' }, { offset: 1, color: '#06b6d4' }] }, width: 3.5, shadowBlur: 12, shadowColor: 'rgba(59,130,246,0.5)' },
          itemStyle: { color: '#3b82f6', borderWidth: 3, borderColor: '#fff' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.35)' }, { offset: 0.7, color: 'rgba(59,130,246,0.08)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } },
          emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(59,130,246,0.8)', color: '#60a5fa', borderColor: '#fff', borderWidth: 3 } }
        }
      ]
    } as EChartsOption;

    // ── Gauge: taxa de poupança ─────────────────────────────────────────────
    const lastMonth = data[data.length - 1] || { income: 1, expense: 0 };
    const savRate = lastMonth.income > 0 ? Math.round((1 - lastMonth.expense / lastMonth.income) * 100) : 0;
    const gaugeColor = savRate >= 20 ? '#10b981' : savRate >= 10 ? '#f59e0b' : '#ef4444';
    const gaugeGrad = savRate >= 20
      ? [{ offset: 0, color: '#34d399' }, { offset: 1, color: '#059669' }]
      : savRate >= 10
      ? [{ offset: 0, color: '#fde68a' }, { offset: 1, color: '#f59e0b' }]
      : [{ offset: 0, color: '#fca5a5' }, { offset: 1, color: '#ef4444' }];

    this.savingsRateOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1600, animationEasing: 'cubicOut' as any,
      series: [{
        type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, splitNumber: 5,
        radius: '88%', center: ['50%', '58%'],
        progress: {
          show: true, width: 16, roundCap: true,
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: gaugeGrad } }
        },
        axisLine: { lineStyle: { width: 16, color: [[1, 'rgba(255,255,255,0.06)']], shadowBlur: 0 } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        pointer: { show: false }, anchor: { show: false },
        title: { offsetCenter: [0, '48%'], fontSize: 11, color: '#64748b', fontFamily: 'Inter, sans-serif' },
        detail: {
          valueAnimation: true, fontSize: 30, fontWeight: 800,
          formatter: (v: number) => `{val|${v}%}\n{sub|poupança}`,
          rich: {
            val: { fontSize: 30, fontWeight: 800, color: gaugeColor, fontFamily: 'Inter, sans-serif' },
            sub: { fontSize: 11, color: '#64748b', fontFamily: 'Inter, sans-serif', lineHeight: 22 }
          },
          offsetCenter: [0, '8%'], color: gaugeColor
        },
        data: [{ value: savRate, name: '' }]
      }]
    } as EChartsOption;

    // ── Sparkline: tendência do saldo ──────────────────────────────────────
    const netVals = data.map((d: any) => d.net);
    const isUp = netVals[netVals.length - 1] >= netVals[0];
    this.dailyOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1200,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.3)',
        textStyle: { color: '#f1f5f9', fontSize: 12 },
        formatter: (p: any) => `<b style="color:#e2e8f0">${p[0]?.name}</b><br/>Saldo: <b style="color:${isUp ? '#10b981' : '#ef4444'}">R$ ${(p[0]?.value||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>`
      },
      grid: { left: 0, right: 0, top: 4, bottom: 0, containLabel: false },
      xAxis: { type: 'category', data: data.map((d: any) => d.month), show: false },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line', data: netVals, smooth: 0.6, symbol: 'none',
        lineStyle: { color: isUp ? '#10b981' : '#ef4444', width: 2.5, shadowBlur: 8, shadowColor: isUp ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: isUp
          ? [{ offset: 0, color: 'rgba(16,185,129,0.35)' }, { offset: 1, color: 'rgba(16,185,129,0)' }]
          : [{ offset: 0, color: 'rgba(239,68,68,0.35)' }, { offset: 1, color: 'rgba(239,68,68,0)' }]
        } }
      }]
    } as EChartsOption;

    // ── Net Worth accumulation line ─────────────────────────────────────────
    let cumulative = 0;
    const netWorthData = data.map((d: any) => { cumulative += d.net; return +(cumulative.toFixed(2)); });
    this.netWorthOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1400,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.3)',
        textStyle: { color: '#f1f5f9', fontSize: 12 },
        formatter: (p: any) => `<b style="color:#e2e8f0">${p[0]?.name}</b><br/>Patrimônio: <b style="color:#8b5cf6">R$ ${(p[0]?.value||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>`
      },
      grid: { left: 12, right: 12, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d: any) => d.month), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      series: [{
        type: 'line', data: netWorthData, smooth: 0.5, symbol: 'circle', symbolSize: 5,
        lineStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#ec4899' }] }, width: 3, shadowBlur: 12, shadowColor: 'rgba(139,92,246,0.5)' },
        itemStyle: { color: '#8b5cf6', borderWidth: 2, borderColor: '#fff' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.35)' }, { offset: 0.6, color: 'rgba(139,92,246,0.1)' }, { offset: 1, color: 'rgba(139,92,246,0)' }] } }
      }]
    } as EChartsOption;
  }

  buildDonutChart(data: any[]) {
    const palette = ['#3b82f6','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899','#f97316','#a3e635','#818cf8'];
    const total = data.reduce((s: number, d: any) => s + +d.amount, 0);

    // ── Premium Donut ───────────────────────────────────────────────────────
    this.donutChartOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1200, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)', borderWidth: 1,
        padding: [12, 16], textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (p: any) => `<div style="font-weight:700;color:#e2e8f0;margin-bottom:6px">${p.name}</div>
          <div style="color:#94a3b8">Valor: <b style="color:${palette[p.dataIndex % palette.length]}">R$ ${Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></div>
          <div style="color:#94a3b8;margin-top:2px">Participação: <b style="color:#e2e8f0">${p.percent}%</b></div>`
      },
      legend: {
        orient: 'vertical', right: '2%', top: 'center',
        icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 10,
        formatter: (name: string) => {
          const item = data.find((d: any) => d.category === name);
          if (!item) return name;
          const pct = total > 0 ? ((+item.amount / total) * 100).toFixed(0) : 0;
          return `{name|${name}} {pct|${pct}%}`;
        },
        textStyle: {
          color: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif',
          rich: {
            name: { color: '#94a3b8', fontSize: 11, width: 80 },
            pct: { color: '#64748b', fontSize: 10 }
          }
        } as any
      },
      graphic: [{
        type: 'text', left: '34%', top: '43%',
        style: { text: `R$ ${(total/1000).toFixed(0)}k`, fill: '#e2e8f0', fontSize: 18, fontWeight: 800, fontFamily: 'Inter, sans-serif', textAlign: 'center' }
      }, {
        type: 'text', left: '34%', top: '55%',
        style: { text: 'total gasto', fill: '#64748b', fontSize: 10, fontFamily: 'Inter, sans-serif', textAlign: 'center' }
      }],
      series: [{
        type: 'pie', radius: ['44%', '72%'], center: ['36%', '50%'],
        data: data.slice(0, 10).map((d: any, i: number) => ({
          name: d.category, value: d.amount,
          itemStyle: { color: palette[i % palette.length], shadowBlur: 6, shadowColor: palette[i % palette.length] + '44' }
        })),
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 28, shadowColor: 'rgba(0,0,0,0.6)', shadowOffsetY: 4 },
          scaleSize: 6, scale: true
        },
        animationType: 'scale', animationEasing: 'elasticOut' as any, animationDelay: 200
      }]
    } as EChartsOption;

    // ── Horizontal bar: top categorias ─────────────────────────────────────
    const sorted = [...data].sort((a: any, b: any) => b.amount - a.amount).slice(0, 8);
    this.categoryBarOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1000, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)', borderColor: 'rgba(139,92,246,0.35)',
        textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (p: any) => `<b style="color:#e2e8f0">${p[0].name}</b><br/>
          <span style="color:#94a3b8">Gasto: </span><b style="color:#f59e0b">R$ ${Number(p[0].value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b><br/>
          <span style="color:#94a3b8">Part.: </span><b style="color:#e2e8f0">${total > 0 ? ((p[0].value / total) * 100).toFixed(1) : 0}%</b>`
      },
      grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      yAxis: {
        type: 'category', data: sorted.map((d: any) => d.category),
        axisLabel: { color: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' },
        axisLine: { show: false }, axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        data: sorted.map((d: any, i: number) => ({
          value: d.amount,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: palette[i % palette.length] }, { offset: 1, color: palette[i % palette.length] + 'aa' }] },
            borderRadius: [0, 8, 8, 0],
            shadowBlur: 6, shadowColor: palette[i % palette.length] + '55'
          }
        })),
        barMaxWidth: 24,
        label: { show: true, position: 'right', color: '#64748b', fontSize: 10, fontFamily: 'Inter', formatter: (p: any) => 'R$' + (p.value >= 1000 ? (p.value/1000).toFixed(1) + 'k' : p.value) },
        emphasis: { itemStyle: { shadowBlur: 16 } }
      }]
    } as EChartsOption;
  }

  buildHeatmap(data: any[]) {
    this.rawHeatData = data.length ? data : this.rawHeatData;
    this._rebuildHeatmapOption();
  }

  private _rebuildHeatmapOption() {
    const year = this.heatmapYear;
    const month = this.heatmapMonth;

    let filtered = this.rawHeatData;
    if (month) {
      filtered = this.rawHeatData.filter((d: any) => (d.date as string).startsWith(`${year}-${month}`));
    } else {
      filtered = this.rawHeatData.filter((d: any) => (d.date as string).startsWith(year));
    }

    const heatData = filtered.map((d: any) => [d.date, +d.value]);
    const max = Math.max(...filtered.map((d: any) => +d.value), 100);
    const vals = filtered.map((d: any) => +d.value).filter(v => v > 0);
    const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    const p75 = avg * 1.5;

    const range = month ? `${year}-${month}` : year;
    const isMonthView = !!month;
    const cellSize = isMonthView ? [40, 40] : [18, 18];

    // Color palette: dark→blue→indigo→violet→pink→orange (hot scale)
    const colorScale = [
      'rgba(15,23,42,0.15)',
      'rgba(30,58,138,0.4)',
      'rgba(67,56,202,0.65)',
      '#7c3aed',
      '#db2777',
      '#ea580c',
      '#fbbf24'
    ];

    this.heatmapOption = {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut' as any,
      tooltip: {
        backgroundColor: 'rgba(6,9,20,0.97)',
        borderColor: 'rgba(139,92,246,0.45)',
        borderWidth: 1,
        borderRadius: 16,
        padding: [16, 20],
        textStyle: { color: '#f1f5f9', fontSize: 13, fontFamily: 'Inter, sans-serif' },
        extraCssText: 'box-shadow:0 20px 60px rgba(0,0,0,0.7);backdrop-filter:blur(20px);',
        formatter: (p: any) => {
          const dateStr = Array.isArray(p.data) ? p.data[0] : p.value?.[0];
          const rawVal  = Array.isArray(p.data) ? p.data[1] : null;
          const d = new Date(dateStr + 'T12:00:00');
          const dayFmt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
          const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase();
          const dayNum  = d.getDate();

          if (rawVal == null || rawVal === 0) {
            return `<div style="min-width:200px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1">
                  <span style="font-size:15px;font-weight:800;color:#e2e8f0">${dayNum}</span>
                  <span style="font-size:8px;color:#475569">${weekday}</span>
                </div>
                <div>
                  <div style="font-weight:700;color:#e2e8f0;font-size:13px;text-transform:capitalize">${dayFmt}</div>
                  <div style="color:#475569;font-size:11px;margin-top:2px">Sem transações</div>
                </div>
              </div>
              <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;text-align:center;color:#334155;font-size:11px">Dia livre 🌿</div>
            </div>`;
          }

          const val  = parseFloat(rawVal);
          const pct  = max > 0 ? (val / max) * 100 : 0;
          const pctFmt = pct.toFixed(0);
          const intensity = val >= p75 ? { label: 'Muito Alto', color: '#f59e0b', emoji: '🔴' }
                          : val >= avg ? { label: 'Moderado',   color: '#ec4899', emoji: '🟡' }
                                       : { label: 'Baixo',       color: '#10b981', emoji: '🟢' };
          const barGrad = `linear-gradient(90deg,#8b5cf6,#ec4899 60%,#f59e0b)`;

          return `<div style="min-width:220px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#ec4899);display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1;flex-shrink:0">
                <span style="font-size:16px;font-weight:800;color:#fff">${dayNum}</span>
                <span style="font-size:8px;color:rgba(255,255,255,0.7)">${weekday}</span>
              </div>
              <div style="flex:1">
                <div style="font-weight:700;color:#e2e8f0;font-size:13px;text-transform:capitalize">${dayFmt}</div>
                <div style="display:inline-flex;align-items:center;gap:4px;margin-top:3px;background:rgba(255,255,255,0.06);border-radius:99px;padding:2px 8px">
                  <span style="font-size:10px">${intensity.emoji}</span>
                  <span style="font-size:10px;color:${intensity.color};font-weight:600">${intensity.label}</span>
                </div>
              </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:12px 14px;margin-bottom:8px">
              <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Total gasto</div>
              <div style="font-size:22px;font-weight:800;color:#f1f5f9;font-family:Inter,sans-serif">R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
            </div>
            <div style="margin-bottom:4px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span style="color:#64748b;font-size:10px">vs maior dia</span>
                <span style="color:#e2e8f0;font-size:10px;font-weight:600">${pctFmt}%</span>
              </div>
              <div style="background:rgba(255,255,255,0.06);border-radius:99px;height:6px;overflow:hidden">
                <div style="height:100%;width:${pctFmt}%;background:${barGrad};border-radius:99px;transition:width .3s"></div>
              </div>
            </div>
          </div>`;
        }
      },
      visualMap: {
        min: 0, max,
        calculable: false,
        show: true,
        orient: 'horizontal' as any,
        left: 'center',
        bottom: isMonthView ? 6 : 4,
        inRange: { color: colorScale },
        outOfRange: { color: ['rgba(255,255,255,0.03)'] },
        textStyle: { color: '#475569', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        itemHeight: 180,
        itemWidth: 12,
        text: ['Máx', 'Zero'],
        precision: 0,
        formatter: (v: number) => v === 0 ? 'R$ 0' : v >= 1000 ? 'R$ '+(v/1000).toFixed(1)+'k' : 'R$ '+v.toFixed(0)
      },
      calendar: {
        range,
        cellSize,
        itemStyle: {
          borderColor: isMonthView ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          borderWidth: isMonthView ? 3 : 2,
          color: 'rgba(255,255,255,0.02)',
          borderRadius: isMonthView ? 10 : 4,
        },
        dayLabel: {
          color: '#475569',
          fontSize: isMonthView ? 12 : 9,
          nameMap: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] as any,
          firstDay: 0,
          margin: isMonthView ? 12 : 8
        },
        monthLabel: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          nameMap: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as any,
          margin: isMonthView ? 0 : 10
        },
        yearLabel: { show: !isMonthView, color: '#334155', fontSize: 12, fontWeight: 700 },
        top: isMonthView ? 14 : 32,
        left: isMonthView ? 56 : 44,
        right: isMonthView ? 20 : 40,
        bottom: isMonthView ? 46 : 50,
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(255,255,255,0.06)', width: isMonthView ? 2 : 1 }
        }
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: heatData,
        itemStyle: { borderRadius: isMonthView ? 10 : 3 },
        emphasis: {
          disabled: false,
          itemStyle: {
            shadowBlur: 32,
            shadowColor: 'rgba(139,92,246,0.8)',
            borderRadius: isMonthView ? 12 : 5,
            borderColor: 'rgba(245,158,11,0.6)',
            borderWidth: 2
          }
        }
      }]
    } as EChartsOption;
  }

  setHeatmapYear(y: string) {
    this.heatmapYear = y;
    this.heatmapMonth = '';
    this._rebuildHeatmapOption();
  }

  setHeatmapMonth(m: string) {
    this.heatmapMonth = m === this.heatmapMonth ? '' : m;
    this._rebuildHeatmapOption();
  }

  heatmapMonths = [
    { label: 'Jan', value: '01' }, { label: 'Fev', value: '02' },
    { label: 'Mar', value: '03' }, { label: 'Abr', value: '04' },
    { label: 'Mai', value: '05' }, { label: 'Jun', value: '06' },
    { label: 'Jul', value: '07' }, { label: 'Ago', value: '08' },
    { label: 'Set', value: '09' }, { label: 'Out', value: '10' },
    { label: 'Nov', value: '11' }, { label: 'Dez', value: '12' },
  ];

  get heatmapYears(): string[] {
    const cy = new Date().getFullYear();
    return [cy - 2, cy - 1, cy].map(y => y.toString());
  }

  get heatmapStats() {
    const year = this.heatmapYear;
    const month = this.heatmapMonth;
    let filtered = this.rawHeatData;
    if (month) filtered = this.rawHeatData.filter((d: any) => (d.date as string).startsWith(`${year}-${month}`));
    else filtered = this.rawHeatData.filter((d: any) => (d.date as string).startsWith(year));
    const days = filtered.filter((d: any) => +d.value > 0);
    const total = days.reduce((s: number, d: any) => s + +d.value, 0);
    const max = days.length ? Math.max(...days.map((d: any) => +d.value)) : 0;
    const avg = days.length ? total / days.length : 0;
    const maxDay = days.find((d: any) => +d.value === max);
    return { total, max, avg, activeDays: days.length, maxDay: maxDay?.date ?? null };
  }

  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'; }
  savingsPct() {
    if (!this.summary.monthlyIncome || this.summary.monthlyIncome <= 0) return 0;
    return Math.round(((this.summary.monthlyIncome - this.summary.monthlyExpense) / this.summary.monthlyIncome) * 100);
  }
  expensePct() {
    if (!this.summary.monthlyIncome || this.summary.monthlyIncome <= 0) return 0;
    return Math.round((this.summary.monthlyExpense / this.summary.monthlyIncome) * 100);
  }

  // ═══ TV METHODS ════════════════════════════════════════════
  private updateTvUrl() {
    const ch = this.tvChannels[this.currentChannelIndex];
    if (!ch) return;
    
    let videoId = '';
    const url = ch.url;
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1]?.split('&')[0] || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1]?.split('?')[0] || '';
    }
    
    const muteParam = this.tvMuted ? 1 : 0;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muteParam}&controls=1&rel=0&modestbranding=1&iv_load_policy=3`;
    this.currentTvUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  onTvLoad() {
    this.tvReady = true;
  }

  switchChannel(index: number) {
    if (index !== this.currentChannelIndex) {
      this.tvReady = false;
      this.currentChannelIndex = index;
      setTimeout(() => {
        this.updateTvUrl();
        this.tvReady = true;
        this.cdr.detectChanges();
      }, 100);
    }
  }

  toggleTvMute() {
    this.tvMuted = !this.tvMuted;
    this.tvReady = false;
    setTimeout(() => {
      this.updateTvUrl();
      this.tvReady = true;
      this.cdr.detectChanges();
    }, 100);
  }

  toggleTvFullscreen() {
    const elem = this.tvScreen?.nativeElement;
    if (elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
    }
  }

  openAddChannelModal() {
    this.showAddChannelModal = true;
    this.newChannel = { name: '', url: '', initial: '', color: '#3b82f6' };
    this.cdr.markForCheck();
  }

  closeAddChannelModal() {
    this.showAddChannelModal = false;
    this.cdr.markForCheck();
  }

  addNewChannel() {
    if (this.newChannel.name && this.newChannel.url) {
      this.tvChannels.push({ ...this.newChannel });
      this.newChannel = { name: '', url: '', initial: '', color: '#3b82f6' };
      this.closeAddChannelModal();
      localStorage.setItem('customTvChannels', JSON.stringify(this.tvChannels));
      this.cdr.markForCheck();
    }
  }

  // ═══ EDIT CHANNEL MODAL ═══════════════════════════════════
  openEditChannelModal(index: number) {
    this.editingChannelIndex = index;
    this.editingChannel = { ...this.tvChannels[index] };
    this.showEditChannelModal = true;
    this.cdr.markForCheck();
  }

  closeEditChannelModal() {
    this.showEditChannelModal = false;
    this.editingChannelIndex = -1;
    this.cdr.markForCheck();
  }

  saveEditedChannel() {
    if (this.editingChannel.name && this.editingChannel.url && this.editingChannelIndex >= 0) {
      this.tvChannels[this.editingChannelIndex] = { ...this.editingChannel };
      
      // Se estava assistindo o canal editado, atualiza a URL
      if (this.currentChannelIndex === this.editingChannelIndex) {
        this.tvReady = false;
        setTimeout(() => {
          this.updateTvUrl();
          this.tvReady = true;
          this.cdr.detectChanges();
        }, 100);
      }
      
      this.closeEditChannelModal();
      localStorage.setItem('customTvChannels', JSON.stringify(this.tvChannels));
      this.cdr.markForCheck();
    }
  }

  deleteChannel() {
    if (this.editingChannelIndex >= 0 && confirm(`Tem certeza que deseja excluir o canal "${this.tvChannels[this.editingChannelIndex].name}"?`)) {
      this.tvChannels.splice(this.editingChannelIndex, 1);
      
      // Ajusta o índice do canal atual se necessário
      if (this.currentChannelIndex === this.editingChannelIndex) {
        this.currentChannelIndex = 0;
        this.updateTvUrl();
      } else if (this.currentChannelIndex > this.editingChannelIndex) {
        this.currentChannelIndex--;
      }
      
      this.closeEditChannelModal();
      localStorage.setItem('customTvChannels', JSON.stringify(this.tvChannels));
      this.cdr.markForCheck();
    }
  }

  // ═══ TRACKBY FUNCTIONS (Performance) ══════════════════════
  trackByIndex(index: number): number {
    return index;
  }

  trackByChannelName(index: number, channel: any): string {
    return channel.name + index;
  }
}
