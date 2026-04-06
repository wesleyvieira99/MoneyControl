import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
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
    this.api.getCategories().subscribe(c => this.categories = c);
    this.api.getAccounts().subscribe(a => this.accounts = a);
    this.loadRules();
  }

  loadRules() {
    this.api.getDistributionRules().subscribe(r => { this.rules = r; this.buildChart(); });
  }

  buildChart() {
    const data = this.rules.map((r, i) => ({ name: r.name, value: +r.percentage, itemStyle: { color: this.colors[i % this.colors.length] } }));
    this.chartOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' }, formatter: '{b}: {c}%' },
      series: [{
        type: 'pie', radius: ['40%','70%'],
        data,
        label: { color: '#94a3b8', fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 15 } }
      }]
    };
  }

  totalPct() { return this.rules.reduce((s, r) => s + +r.percentage, 0); }
  simAmount(r: any) { return (this.simulationIncome * +r.percentage / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(r: any) { this.editMode = true; this.form = { ...r, categoryId: r.category?.id, bankAccountId: r.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = { ...this.form, category: this.form.categoryId ? { id: +this.form.categoryId } : null, bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null };
    const obs = this.editMode ? this.api.updateDistributionRule(this.form.id, payload) : this.api.createDistributionRule(payload);
    obs.subscribe(() => { this.closeModal(); this.loadRules(); });
  }

  delete(id: number) {
    if (confirm('Excluir regra?')) this.api.deleteDistributionRule(id).subscribe(() => this.loadRules());
  }

  emptyForm() { return { name: '', percentage: 0, destinationType: 'SAVINGS', color: '#3b82f6', sortOrder: 0, categoryId: null, bankAccountId: null }; }
}
