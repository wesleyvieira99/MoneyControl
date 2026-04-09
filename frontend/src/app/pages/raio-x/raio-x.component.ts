import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { catchError, firstValueFrom, of } from 'rxjs';
import * as echarts from 'echarts';

@Component({
  selector: 'app-raio-x',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './raio-x.component.html',
  styleUrls: ['./raio-x.component.scss']
})
export class RaioXComponent implements OnInit, OnDestroy {
  Math = Math;
  @ViewChild('radarChart', { static: false }) radarRef!: ElementRef;
  @ViewChild('gaugeChart', { static: false }) gaugeRef!: ElementRef;

  score: any = null;
  independence: any = null;
  anomalies: any[] = [];
  comparison: any[] = [];
  loading = true;

  private charts: echarts.ECharts[] = [];

  pillars = [
    { key: 'savingsScore',    label: 'Poupança',     icon: '💰', max: 250 },
    { key: 'debtScore',       label: 'Dívidas',       icon: '🏦', max: 250 },
    { key: 'investmentScore', label: 'Investimentos', icon: '📈', max: 250 },
    { key: 'emergencyScore',  label: 'Reserva',       icon: '🛡',  max: 250 },
  ];

  benchmarks = [
    { label: 'Taxa de Poupança', target: 20, icon: '💰', key: 'savingsRate', suffix: '%', good: (v: number) => v >= 20 },
    { label: 'Dívida/Renda',    target: 30, icon: '📊', key: 'debtRatio',   suffix: '%', good: (v: number) => v <= 30 },
    { label: 'Score FIRE',      target: 70, icon: '🔥', key: 'fireProgress', suffix: '%', good: (v: number) => v >= 70 },
    { label: 'Anomalias',       target: 0,  icon: '⚠️', key: 'anomalyCount', suffix: '', good: (v: number) => v === 0 },
  ];

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadAll(); }
  ngOnDestroy() { this.charts.forEach(c => c.dispose()); }

  loadAll() {
    this.loading = true;
    Promise.all([
      firstValueFrom(this.api.getFinancialScore().pipe(catchError(() => of(null)))),
      firstValueFrom(this.api.getIndependencePoint().pipe(catchError(() => of(null)))),
      firstValueFrom(this.api.getAnomalies().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getMonthlyComparison(3).pipe(catchError(() => of([])))),
    ]).then(([score, independence, anomalies, comparison]: any[]) => {
      this.score = score;
      this.independence = independence;
      this.anomalies = anomalies || [];
      this.comparison = comparison || [];
      this.loading = false;
      setTimeout(() => { this.buildRadar(); this.buildGauge(); }, 100);
    }).catch(() => { this.loading = false; });
  }

  buildRadar() {
    if (!this.radarRef || !this.score) return;
    const c = echarts.init(this.radarRef.nativeElement);
    this.charts.push(c);
    const pillars = this.pillars.map(p => ({ name: p.label, max: p.max }));
    const vals = this.pillars.map(p => this.score[p.key] ?? 0);
    c.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: pillars,
        shape: 'polygon',
        axisNameGap: 8,
        axisName: { color: '#888', fontSize: 12 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,.02)', 'rgba(255,255,255,.04)'] } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,.1)' } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{ value: vals, name: 'Seu Score', areaStyle: { color: 'rgba(108,99,255,.25)' }, lineStyle: { color: '#6c63ff', width: 2 }, itemStyle: { color: '#6c63ff' } }]
      }],
      tooltip: { trigger: 'item' }
    });
  }

  buildGauge() {
    if (!this.gaugeRef || !this.score) return;
    const c = echarts.init(this.gaugeRef.nativeElement);
    this.charts.push(c);
    const pct = (this.score.total / 1000) * 100;
    c.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        min: 0, max: 1000,
        startAngle: 200, endAngle: -20,
        pointer: { show: true, length: '60%', width: 4, itemStyle: { color: this.scoreColor(this.score.total) } },
        progress: { show: true, width: 16, itemStyle: { color: this.scoreColor(this.score.total) } },
        axisLine: { lineStyle: { width: 16, color: [[1, 'rgba(255,255,255,.08)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `${Math.round(v)}\n${this.score?.tier ?? ''}`,
          color: this.scoreColor(this.score.total),
          fontSize: 24, fontWeight: 700,
          offsetCenter: [0, '30%']
        },
        data: [{ value: this.score.total }]
      }]
    });
  }

  scoreColor(s: number) {
    if (s >= 850) return '#ffd700';
    if (s >= 700) return '#00c9a7';
    if (s >= 500) return '#6c63ff';
    if (s >= 300) return '#ffd93d';
    return '#ff6b6b';
  }

  getBenchmarkValue(key: string): number {
    if (!this.score && !this.independence) return 0;
    if (key === 'savingsRate') return +(this.score?.savingsRate ?? 0);
    if (key === 'debtRatio') return +(this.score?.debtRatio ?? 0);
    if (key === 'fireProgress') return +(this.independence?.progressPct ?? 0);
    if (key === 'anomalyCount') return this.anomalies.length;
    return 0;
  }

  getTrend(): string {
    if (this.comparison.length < 2) return 'neutral';
    const prev = +(this.comparison[this.comparison.length - 2]?.net || 0);
    const curr = +(this.comparison[this.comparison.length - 1]?.net || 0);
    return curr > prev ? 'up' : curr < prev ? 'down' : 'neutral';
  }

  fmt(v: number) { return (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  fmtPct(v: number) { return (+v || 0).toFixed(1) + '%'; }
  pillarPct(key: string, max: number) { return Math.round(((this.score?.[key] ?? 0) / max) * 100); }
}
