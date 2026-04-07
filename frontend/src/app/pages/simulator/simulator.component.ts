import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as echarts from 'echarts';

interface SimScenario {
  label: string;
  color: string;
  rate: number;
  data: number[];
}

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulator.component.html',
  styleUrls: ['./simulator.component.scss']
})
export class SimulatorComponent implements OnInit, OnDestroy {
  @ViewChild('simChart', { static: false }) chartRef!: ElementRef;
  @ViewChild('monteCarlo', { static: false }) mcRef!: ElementRef;

  activeTab: 'compound' | 'montecarlo' | 'debt' = 'compound';

  // Compound interest
  principal = 10000;
  monthly = 500;
  rateYearly = 10;
  years = 10;
  scenarios: SimScenario[] = [];
  result: any = null;

  // Monte Carlo
  mc_initial = 50000;
  mc_monthly = 1000;
  mc_years = 20;
  mc_simulations = 1000;
  mc_volatility = 15;
  mc_expectedReturn = 10;
  mcResult: any = null;
  mcRunning = false;

  // Debt payoff
  debtBalance = 20000;
  debtRate = 2.5; // monthly %
  debtPayment = 800;
  debtResult: any = null;

  private chart1: echarts.ECharts | null = null;
  private chart2: echarts.ECharts | null = null;

  ngOnInit() { setTimeout(() => this.simulate(), 50); }
  ngOnDestroy() { this.chart1?.dispose(); this.chart2?.dispose(); }

  setTab(t: typeof this.activeTab) {
    this.activeTab = t;
    setTimeout(() => {
      if (t === 'compound') this.simulate();
      if (t === 'montecarlo') this.runMonteCarlo();
      if (t === 'debt') this.calcDebt();
    }, 50);
  }

  simulate() {
    const rates = [
      { label: 'Conservador (CDI ~10%)', color: '#00c9a7', rate: 10 },
      { label: `Sua Meta (${this.rateYearly}%)`, color: '#6c63ff', rate: this.rateYearly },
      { label: 'Agressivo (IBOV ~15%)', color: '#ffd93d', rate: 15 },
    ];

    const months = this.years * 12;
    const labels: string[] = [];
    const now = new Date();
    for (let m = 0; m <= months; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      labels.push(m % 12 === 0 ? d.getFullYear().toString() : '');
    }

    this.scenarios = rates.map(r => {
      const mr = Math.pow(1 + r.rate / 100, 1 / 12) - 1;
      const data: number[] = [];
      let bal = this.principal;
      for (let m = 0; m <= months; m++) {
        data.push(Math.round(bal));
        bal = bal * (1 + mr) + this.monthly;
      }
      return { ...r, data };
    });

    const target = this.scenarios[1];
    const final = target.data[target.data.length - 1];
    const totalInvested = this.principal + this.monthly * months;
    this.result = {
      finalAmount: final,
      totalInvested,
      earnings: final - totalInvested,
      earningsPct: ((final - totalInvested) / totalInvested * 100).toFixed(1),
      labels
    };

    setTimeout(() => this.buildCompoundChart(labels), 50);
  }

  buildCompoundChart(labels: string[]) {
    if (!this.chartRef) return;
    this.chart1?.dispose();
    this.chart1 = echarts.init(this.chartRef.nativeElement);
    this.chart1.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p: any) => p.map((s: any) => `${s.seriesName}: ${this.fmt(s.value)}`).join('<br/>') },
      legend: { bottom: 0, textStyle: { color: '#888' } },
      grid: { top: 20, bottom: 55, left: 70, right: 20 },
      xAxis: { type: 'category', data: labels, axisLabel: { color: '#888', interval: 11 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#888', formatter: (v: number) => this.fmtK(v) }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      series: this.scenarios.map(s => ({
        name: s.label, type: 'line', data: s.data, smooth: true, symbol: 'none',
        lineStyle: { color: s.color, width: 2.5 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: s.color + '30' }, { offset: 1, color: s.color + '00' }]) }
      }))
    });
  }

  runMonteCarlo() {
    this.mcRunning = true;
    setTimeout(() => {
      const months = this.mc_years * 12;
      const mr = this.mc_expectedReturn / 100 / 12;
      const mv = this.mc_volatility / 100 / Math.sqrt(12);
      const numSims = Math.min(this.mc_simulations, 500);

      const paths: number[][] = [];
      for (let i = 0; i < numSims; i++) {
        let bal = this.mc_initial;
        const path: number[] = [bal];
        for (let m = 0; m < months; m++) {
          const shock = (Math.random() - 0.5) * 2 * mv;
          bal = bal * (1 + mr + shock) + this.mc_monthly;
          path.push(Math.max(0, bal));
        }
        paths.push(path);
      }

      const finals = paths.map(p => p[p.length - 1]).sort((a, b) => a - b);
      const p10 = finals[Math.floor(numSims * 0.1)];
      const p50 = finals[Math.floor(numSims * 0.5)];
      const p90 = finals[Math.floor(numSims * 0.9)];
      const probPositive = finals.filter(f => f > this.mc_initial + this.mc_monthly * months).length / numSims * 100;

      this.mcResult = { p10, p50, p90, probPositive: probPositive.toFixed(1), paths, numSims };
      this.mcRunning = false;

      setTimeout(() => this.buildMCChart(paths, months), 50);
    }, 100);
  }

  buildMCChart(paths: number[][], months: number) {
    if (!this.mcRef) return;
    this.chart2?.dispose();
    this.chart2 = echarts.init(this.mcRef.nativeElement);
    const sample = paths.filter((_, i) => i % Math.max(1, Math.floor(paths.length / 80)) === 0);
    const labels = Array.from({ length: months + 1 }, (_, i) => i);

    this.chart2.setOption({
      backgroundColor: 'transparent',
      tooltip: { show: false },
      grid: { top: 20, bottom: 40, left: 70, right: 20 },
      xAxis: { type: 'category', data: labels, axisLabel: { color: '#888', formatter: (v: number) => v % 12 === 0 ? `${v / 12}a` : '' }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#888', formatter: (v: number) => this.fmtK(v) }, splitLine: { lineStyle: { color: '#333', type: 'dashed' } } },
      series: sample.map(p => ({
        type: 'line', data: p, smooth: false, symbol: 'none',
        lineStyle: { color: 'rgba(108,99,255,0.12)', width: 1 }
      }))
    });
  }

  calcDebt() {
    const mr = this.debtRate / 100;
    let balance = this.debtBalance;
    let months = 0;
    let totalPaid = 0;
    while (balance > 0 && months < 600) {
      const interest = balance * mr;
      if (this.debtPayment <= interest) { months = 9999; break; }
      balance = balance + interest - this.debtPayment;
      totalPaid += this.debtPayment;
      months++;
      if (balance < 0) { totalPaid += balance; balance = 0; }
    }
    const totalInterest = totalPaid - this.debtBalance;
    this.debtResult = {
      months: months >= 9999 ? null : months,
      years: months >= 9999 ? null : (months / 12).toFixed(1),
      totalPaid: months >= 9999 ? null : totalPaid,
      totalInterest: months >= 9999 ? null : totalInterest,
      interestPct: months >= 9999 ? null : (totalInterest / this.debtBalance * 100).toFixed(1),
      minPayment: this.debtBalance * mr,
      impossible: months >= 9999
    };
  }

  fmt(v: number) { return (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  fmtK(v: number) { return Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v).toString(); }
}
