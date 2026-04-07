import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, of } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-distribution',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './distribution.component.html',
  styleUrls: ['./distribution.component.scss']
})
export class DistributionComponent implements OnInit {
  rules: any[] = [];
  categories: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  chartOption: EChartsOption = {};
  simulationIncome = 10000;

  colors = ['#3b82f6','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899'];
  destTypes = ['SAVINGS','INVESTMENT','POCKET','EXPENSE','EMERGENCY','CHARITY'];
  destLabels: any = { SAVINGS: '💾 Poupança', INVESTMENT: '📈 Investimento', POCKET: '👜 Bolso', EXPENSE: '💸 Despesas', EMERGENCY: '🆘 Emergência', CHARITY: '❤️ Caridade' };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategories().pipe(catchError(() => of([]))).subscribe(c => this.categories = c);
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => this.accounts = a);
    this.loadRules();
  }

  loadRules() {
    this.api.getDistributionRules().pipe(catchError(() => of([]))).subscribe(r => { this.rules = r; this.buildChart(); });
  }

  buildChart() {
    const total = this.rules.reduce((s, r) => s + +r.percentage, 0);
    const data = this.rules.map((r, i) => ({
      name: r.name,
      value: +r.percentage,
      itemStyle: {
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 1,
          colorStops: [
            { offset: 0, color: this.colors[i % this.colors.length] },
            { offset: 1, color: this.colors[i % this.colors.length] + 'bb' }
          ]
        },
        shadowBlur: 8,
        shadowColor: this.colors[i % this.colors.length] + '44'
      }
    }));

    this.chartOption = {
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
          const amount = (this.simulationIncome * +p.value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `<div style="font-weight:700;color:#e2e8f0;margin-bottom:6px">${p.name}</div>
            <div style="color:#94a3b8">Alocação: <b style="color:${this.colors[p.dataIndex % this.colors.length]}">${p.value}%</b></div>
            <div style="color:#94a3b8;margin-top:2px">Valor simulado: <b style="color:#e2e8f0">${amount}</b></div>`;
        }
      },
      legend: {
        orient: 'vertical',
        right: '2%',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' },
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 10
      },
      graphic: this.rules.length > 0 ? [{
        type: 'text', left: '31%', top: '42%',
        style: {
          text: total + '%',
          fill: total === 100 ? '#10b981' : '#f59e0b',
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center'
        }
      }, {
        type: 'text', left: '31%', top: '54%',
        style: {
          text: total === 100 ? 'balanceado ✓' : 'desbalanceado',
          fill: total === 100 ? '#059669' : '#d97706',
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center'
        }
      }] : [],
      series: [{
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['33%', '50%'],
        data,
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
  }

  totalPct() { return this.rules.reduce((s, r) => s + +r.percentage, 0); }
  simAmount(r: any) { return (this.simulationIncome * +r.percentage / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(r: any) { this.editMode = true; this.form = { ...r, categoryId: r.category?.id, bankAccountId: r.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = { ...this.form, category: this.form.categoryId ? { id: +this.form.categoryId } : null, bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null };
    const obs = this.editMode ? this.api.updateDistributionRule(this.form.id, payload) : this.api.createDistributionRule(payload);
    obs.subscribe({ next: () => { this.closeModal(); this.loadRules(); }, error: () => this.closeModal() });
  }

  delete(id: number) {
    if (confirm('Excluir regra?')) this.api.deleteDistributionRule(id).subscribe({ next: () => this.loadRules(), error: () => {} });
  }

  emptyForm() { return { name: '', percentage: 0, destinationType: 'SAVINGS', color: '#3b82f6', sortOrder: 0, categoryId: null, bankAccountId: null }; }
}
