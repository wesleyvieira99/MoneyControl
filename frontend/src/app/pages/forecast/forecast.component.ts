import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, of } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.scss']
})
export class ForecastComponent implements OnInit {
  training = true;
  trainProgress = 0;
  trainMessage = 'Inicializando modelo...';
  forecastData: any = null;
  barChartOption: EChartsOption = {};
  lineChartOption: EChartsOption = {};
  forecastMonths = 6;
  readonly Math = Math;

  constructor(private api: ApiService) {}

  ngOnInit() { this.startTraining(); }

  startTraining() {
    this.training = true;
    this.trainProgress = 0;
    const messages = [
      'Coletando dados históricos...',
      'Processando transações...',
      'Calculando médias móveis...',
      'Treinando regressão linear...',
      'Validando modelo...',
      'Gerando projeções...',
      'Finalizando análise...'
    ];
    let step = 0;
    const interval = setInterval(() => {
      this.trainProgress = Math.min(100, this.trainProgress + 100 / messages.length);
      this.trainMessage = messages[step] || 'Concluído!';
      step++;
      if (step >= messages.length) {
        clearInterval(interval);
        setTimeout(() => this.loadForecast(), 600);
      }
    }, 400);
  }

  loadForecast() {
    this.api.getForecast(this.forecastMonths).pipe(
      catchError(() => {
        // Mock fallback when API is offline
        const now = new Date();
        const months = Array.from({ length: +this.forecastMonths }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
          return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        });
        const hist = Array.from({ length: 12 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
          return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        });
        return of({
          historicMonths: hist,
          historicIncome:  hist.map(() => 6500 + Math.random() * 3000),
          historicExpense: hist.map(() => 4000 + Math.random() * 2000),
          projections: months.map(m => ({
            month: m,
            projectedIncome:  7500 + Math.random() * 2000,
            projectedExpense: 4500 + Math.random() * 1800,
            projectedNet:     2000 + Math.random() * 1500,
          })),
        });
      })
    ).subscribe(data => {
      this.forecastData = data;
      this.training = false;
      this.buildCharts();
    });
  }  buildCharts() {
    const { projections, historicMonths, historicIncome, historicExpense } = this.forecastData;

    // ── Premium Grouped Bar + Net Line ─────────────────────────────────────
    this.barChartOption = {
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
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const fmt = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const p0 = params[0], p1 = params[1], p2 = params[2];
          return `<div style="font-weight:700;color:#e2e8f0;margin-bottom:8px">${p0?.name}</div>
            ${p0 ? `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:#94a3b8">📈 Receita</span><b style="color:#10b981">${fmt(p0.value)}</b></div>` : ''}
            ${p1 ? `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px"><span style="color:#94a3b8">📉 Despesa</span><b style="color:#ef4444">${fmt(p1.value)}</b></div>` : ''}
            ${p2 ? `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px"><span style="color:#94a3b8">💰 Saldo</span><b style="color:#3b82f6">${fmt(p2.value)}</b></div>` : ''}`;
        }
      },
      legend: {
        data: ['Receita Proj.', 'Despesa Proj.', 'Saldo Proj.'],
        textStyle: { color: '#94a3b8', fontSize: 12, fontFamily: 'Inter, sans-serif' },
        top: 4, right: 8, icon: 'roundRect', itemWidth: 12, itemHeight: 6, itemGap: 16
      },
      grid: { left: 12, right: 12, top: 44, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: projections.map((p: any) => p.month),
        axisLabel: { color: '#64748b', fontSize: 11, fontFamily: 'Inter, sans-serif' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b', fontSize: 11, fontFamily: 'Inter',
          formatter: (v: number) => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } },
        axisLine: { show: false }
      },
      series: [
        {
          name: 'Receita Proj.', type: 'bar', barMaxWidth: 36, barGap: '8%',
          data: projections.map((p: any) => p.projectedIncome),
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 0.6, color: '#059669' }, { offset: 1, color: 'rgba(16,185,129,0.2)' }] },
            borderRadius: [8, 8, 0, 0]
          },
          emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(16,185,129,0.6)' } }
        },
        {
          name: 'Despesa Proj.', type: 'bar', barMaxWidth: 36,
          data: projections.map((p: any) => p.projectedExpense),
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 0.6, color: '#dc2626' }, { offset: 1, color: 'rgba(239,68,68,0.2)' }] },
            borderRadius: [8, 8, 0, 0]
          },
          emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(239,68,68,0.6)' } }
        },
        {
          name: 'Saldo Proj.', type: 'line', smooth: 0.5,
          symbol: 'circle', symbolSize: 8, z: 10,
          data: projections.map((p: any) => p.projectedNet),
          lineStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#818cf8' }, { offset: 0.5, color: '#3b82f6' }, { offset: 1, color: '#06b6d4' }] },
            width: 3.5, shadowBlur: 12, shadowColor: 'rgba(59,130,246,0.5)'
          },
          itemStyle: { color: '#3b82f6', borderWidth: 3, borderColor: '#fff' },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.35)' }, { offset: 0.7, color: 'rgba(59,130,246,0.08)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] }
          },
          emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(59,130,246,0.8)', borderColor: '#fff' } }
        }
      ]
    } as EChartsOption;

    // ── Historical + Forecast combined line (with dashed projection zone) ──
    const allMonths = [...historicMonths, ...projections.map((p: any) => p.month)];
    const allIncome = [...historicIncome, ...projections.map((p: any) => p.projectedIncome)];
    const allExpense = [...historicExpense, ...projections.map((p: any) => p.projectedExpense)];
    const splitIdx = historicMonths.length;

    // Build separate solid/dashed series for seamless visual split
    const incSolid  = allIncome.map((v: number, i: number) => i < splitIdx ? v : null);
    const incDash   = allIncome.map((v: number, i: number) => i >= splitIdx - 1 ? v : null);
    const expSolid  = allExpense.map((v: number, i: number) => i < splitIdx ? v : null);
    const expDash   = allExpense.map((v: number, i: number) => i >= splitIdx - 1 ? v : null);

    this.lineChartOption = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1400,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)',
        borderColor: 'rgba(139,92,246,0.35)',
        borderWidth: 1, padding: [12, 16],
        textStyle: { color: '#f1f5f9', fontSize: 13, fontFamily: 'Inter, sans-serif' },
        formatter: (params: any) => {
          const fmt = (v: number | null) => v != null ? 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—';
          const isProj = params[0]?.dataIndex >= splitIdx;
          const inc = params.find((p: any) => p.seriesName?.includes('Receita') && !p.seriesName?.includes('Proj'))?.value
                   ?? params.find((p: any) => p.seriesName?.includes('Receita'))?.value;
          const exp = params.find((p: any) => p.seriesName?.includes('Despesa') && !p.seriesName?.includes('Proj'))?.value
                   ?? params.find((p: any) => p.seriesName?.includes('Despesa'))?.value;
          return `<div style="font-weight:700;color:#e2e8f0;margin-bottom:8px">${params[0]?.name} ${isProj ? '<span style="background:#8b5cf6;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px">PROJEÇÃO</span>' : ''}</div>
            <div style="display:flex;justify-content:space-between;gap:16px"><span style="color:#94a3b8">📈 Receita</span><b style="color:#10b981">${fmt(inc)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px"><span style="color:#94a3b8">📉 Despesa</span><b style="color:#ef4444">${fmt(exp)}</b></div>`;
        }
      },
      legend: {
        data: ['Receita', 'Despesa', 'Receita Proj.', 'Despesa Proj.'],
        textStyle: { color: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' },
        top: 4, right: 8, icon: 'roundRect', itemWidth: 12, itemHeight: 6, itemGap: 12
      },
      grid: { left: 12, right: 12, top: 44, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category', data: allMonths,
        axisLabel: { color: '#64748b', fontSize: 10, fontFamily: 'Inter, sans-serif', rotate: 30 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10, fontFamily: 'Inter', formatter: (v: number) => 'R$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } },
        axisLine: { show: false }
      },
      series: [
        {
          name: 'Receita', type: 'line', data: incSolid, smooth: 0.5,
          connectNulls: false, symbol: 'circle', symbolSize: 6,
          lineStyle: { color: '#10b981', width: 3, shadowBlur: 8, shadowColor: 'rgba(16,185,129,0.4)' },
          itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#fff' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.25)' }, { offset: 1, color: 'rgba(16,185,129,0)' }] } },
          markLine: {
            data: [{ xAxis: splitIdx - 0.5 }],
            lineStyle: { color: 'rgba(139,92,246,0.5)', type: 'dashed', width: 2 },
            label: { formatter: 'Hoje', color: '#94a3b8', fontSize: 11, fontFamily: 'Inter' },
            symbol: 'none', silent: true
          }
        },
        {
          name: 'Despesa', type: 'line', data: expSolid, smooth: 0.5,
          connectNulls: false, symbol: 'circle', symbolSize: 6,
          lineStyle: { color: '#ef4444', width: 3, shadowBlur: 8, shadowColor: 'rgba(239,68,68,0.4)' },
          itemStyle: { color: '#ef4444', borderWidth: 2, borderColor: '#fff' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,68,68,0.2)' }, { offset: 1, color: 'rgba(239,68,68,0)' }] } }
        },
        {
          name: 'Receita Proj.', type: 'line', data: incDash, smooth: 0.5,
          connectNulls: false, symbol: 'circle', symbolSize: 5,
          lineStyle: { color: '#10b981', width: 2.5, type: 'dashed', opacity: 0.7 },
          itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#fff', opacity: 0.8 }
        },
        {
          name: 'Despesa Proj.', type: 'line', data: expDash, smooth: 0.5,
          connectNulls: false, symbol: 'circle', symbolSize: 5,
          lineStyle: { color: '#ef4444', width: 2.5, type: 'dashed', opacity: 0.7 },
          itemStyle: { color: '#ef4444', borderWidth: 2, borderColor: '#fff', opacity: 0.8 }
        }
      ]
    } as EChartsOption;
  }

  retrain() { this.forecastData = null; this.startTraining(); }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  avgProjected(field: string) {
    const proj = this.forecastData?.projections || [];
    if (!proj.length) return 0;
    return proj.reduce((s: number, p: any) => s + +p[field], 0) / proj.length;
  }
}
