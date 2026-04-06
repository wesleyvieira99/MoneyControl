import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
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
    this.api.getForecast(this.forecastMonths).subscribe(data => {
      this.forecastData = data;
      this.training = false;
      this.buildCharts();
    });
  }

  buildCharts() {
    const { projections, historicMonths, historicIncome, historicExpense } = this.forecastData;

    this.barChartOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' } },
      legend: { data: ['Receita Proj.', 'Despesa Proj.', 'Saldo Proj.'], textStyle: { color: '#94a3b8' } },
      grid: { left: 16, right: 16, top: 50, bottom: 16, containLabel: true },
      xAxis: { type: 'category', data: projections.map((p: any) => p.month), axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (v: number) => 'R$' + v.toLocaleString('pt-BR') }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [
        { name: 'Receita Proj.', type: 'bar', data: projections.map((p: any) => p.projectedIncome), itemStyle: { color: 'rgba(16,185,129,0.7)', borderRadius: [4,4,0,0] } },
        { name: 'Despesa Proj.', type: 'bar', data: projections.map((p: any) => p.projectedExpense), itemStyle: { color: 'rgba(239,68,68,0.7)', borderRadius: [4,4,0,0] } },
        { name: 'Saldo Proj.', type: 'line', data: projections.map((p: any) => p.projectedNet), smooth: true, lineStyle: { color: '#3b82f6', width: 3 }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } } }
      ]
    };

    const allMonths = [...historicMonths, ...projections.map((p: any) => p.month)];
    const allIncome = [...historicIncome, ...projections.map((p: any) => p.projectedIncome)];
    const allExpense = [...historicExpense, ...projections.map((p: any) => p.projectedExpense)];
    const splitIdx = historicMonths.length;

    this.lineChartOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' } },
      legend: { data: ['Receita (histórico + projeção)', 'Despesa (histórico + projeção)'], textStyle: { color: '#94a3b8' } },
      grid: { left: 16, right: 16, top: 50, bottom: 16, containLabel: true },
      xAxis: { type: 'category', data: allMonths, axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (v: number) => 'R$' + v.toLocaleString('pt-BR') }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [
        { name: 'Receita (histórico + projeção)', type: 'line', data: allIncome, smooth: true, markPoint: { data: [{ type: 'max', name: 'Máx' }] }, itemStyle: { color: '#10b981' }, lineStyle: { color: '#10b981' }, markLine: { data: [{ xAxis: splitIdx, lineStyle: { color: 'rgba(255,255,255,0.3)', type: 'dashed' }, label: { formatter: 'Hoje', color: '#94a3b8' } }] } },
        { name: 'Despesa (histórico + projeção)', type: 'line', data: allExpense, smooth: true, itemStyle: { color: '#ef4444' }, lineStyle: { color: '#ef4444' } }
      ]
    };
  }

  retrain() { this.forecastData = null; this.startTraining(); }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
}
