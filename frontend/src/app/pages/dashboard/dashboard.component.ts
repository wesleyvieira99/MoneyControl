import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  summary: any = {};
  loading = true;
  selectedMonth = new Date().toISOString().slice(0, 7);

  balanceChartOption: EChartsOption = {};
  donutChartOption: EChartsOption = {};
  heatmapOption: EChartsOption = {};

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadData(); }

  loadData() {
    this.loading = true;
    this.api.getDashboardSummary(this.selectedMonth).subscribe(s => { this.summary = s; this.loading = false; });
    this.loadBalanceChart();
    this.loadDonutChart();
    this.loadHeatmap();
  }

  loadBalanceChart() {
    this.api.getBalanceHistory(12).subscribe(data => {
      this.balanceChartOption = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' } },
        legend: { data: ['Receita', 'Despesa', 'Saldo'], textStyle: { color: '#94a3b8' } },
        grid: { left: 16, right: 16, top: 40, bottom: 16, containLabel: true },
        xAxis: { type: 'category', data: data.map((d: any) => d.month), axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (v: number) => 'R$' + v.toLocaleString('pt-BR') }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [
          { name: 'Receita', type: 'bar', data: data.map((d: any) => d.income), itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] } },
          { name: 'Despesa', type: 'bar', data: data.map((d: any) => d.expense), itemStyle: { color: '#ef4444', borderRadius: [4,4,0,0] } },
          { name: 'Saldo', type: 'line', data: data.map((d: any) => d.net), smooth: true, lineStyle: { color: '#3b82f6', width: 3 }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.25)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } } }
        ]
      };
    });
  }

  loadDonutChart() {
    this.api.getCategoryBreakdown(this.selectedMonth).subscribe(data => {
      const colors = ['#3b82f6','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899'];
      this.donutChartOption = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' }, formatter: '{b}: R$ {c} ({d}%)' },
        series: [{
          type: 'pie',
          radius: ['45%', '75%'],
          data: data.map((d: any, i: number) => ({ name: d.category, value: d.amount, itemStyle: { color: colors[i % colors.length] } })),
          label: { color: '#94a3b8', fontSize: 11 },
          emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.5)' } }
        }]
      };
    });
  }

  loadHeatmap() {
    const year = this.selectedMonth.slice(0, 4);
    this.api.getHeatmap(year).subscribe(data => {
      const heatData = data.map((d: any) => [d.date, +d.value]);
      const max = Math.max(...data.map((d: any) => +d.value), 1);
      this.heatmapOption = {
        backgroundColor: 'transparent',
        tooltip: { formatter: (p: any) => `${p.data[0]}: R$ ${parseFloat(p.data[1]).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        visualMap: { min: 0, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['rgba(59,130,246,0.1)', '#3b82f6', '#8b5cf6'] }, textStyle: { color: '#94a3b8' } },
        calendar: { range: year, cellSize: ['auto', 18], itemStyle: { borderColor: 'rgba(255,255,255,0.05)' }, dayLabel: { color: '#94a3b8', nameMap: ['D','S','T','Q','Q','S','S'] }, monthLabel: { color: '#94a3b8', nameMap: 'PT' }, yearLabel: { color: '#94a3b8' }, top: 40, left: 40, right: 40 },
        series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: heatData }]
      };
    });
  }

  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'; }
}
