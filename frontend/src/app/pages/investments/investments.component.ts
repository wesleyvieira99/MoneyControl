import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './investments.component.html',
  styleUrls: ['./investments.component.scss']
})
export class InvestmentsComponent implements OnInit {
  Math = Math;
  investments: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  detailInvestment: any = null;
  detailTxs: any[] = [];
  showTxModal = false;
  txForm: any = {};
  portfolioChart: EChartsOption = {};

  types = ['STOCKS', 'CRYPTO', 'FIXED_INCOME', 'REAL_ESTATE', 'BETTING', 'OTHER'];
  typeIcons: any = { STOCKS: '📈', CRYPTO: '₿', FIXED_INCOME: '🏛️', REAL_ESTATE: '🏠', BETTING: '🎰', OTHER: '💼' };
  typeLabels: any = { STOCKS: 'Ações', CRYPTO: 'Cripto', FIXED_INCOME: 'Renda Fixa', REAL_ESTATE: 'FIIs', BETTING: 'Apostas', OTHER: 'Outros' };

  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.getAccounts().subscribe(a => this.accounts = a);
    this.loadInvestments();
  }

  loadInvestments() {
    this.api.getInvestments().subscribe(inv => {
      this.investments = inv;
      this.buildPortfolioChart();
    });
  }

  buildPortfolioChart() {
    const typeGroups: any = {};
    this.investments.forEach(i => { typeGroups[i.type] = (typeGroups[i.type] || 0) + +i.currentValue; });
    const colors = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4'];
    this.portfolioChart = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' }, formatter: '{b}: R$ {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['40%','70%'],
        data: Object.entries(typeGroups).map(([name, value], i) => ({ name: this.typeLabels[name] || name, value: +(value as number), itemStyle: { color: colors[i % colors.length] } })),
        label: { color: '#94a3b8', fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    };
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(i: any) { this.editMode = true; this.form = { ...i, bankAccountId: i.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = { ...this.form, bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null };
    const obs = this.editMode ? this.api.updateInvestment(this.form.id, payload) : this.api.createInvestment(payload);
    obs.subscribe(() => { this.closeModal(); this.loadInvestments(); });
  }

  delete(id: number) {
    if (confirm('Excluir investimento?')) this.api.deleteInvestment(id).subscribe(() => this.loadInvestments());
  }

  openDetail(inv: any) {
    this.detailInvestment = inv;
    this.api.getInvestmentTransactions(inv.id).subscribe(txs => this.detailTxs = txs);
  }

  openTxModal() { this.txForm = { date: new Date().toISOString().slice(0,10), amount: 0, type: 'YIELD', notes: '' }; this.showTxModal = true; }
  closeTxModal() { this.showTxModal = false; }

  saveTx() {
    this.api.addInvestmentTransaction(this.detailInvestment.id, this.txForm).subscribe(() => {
      this.closeTxModal();
      this.api.getInvestmentTransactions(this.detailInvestment.id).subscribe(txs => this.detailTxs = txs);
    });
  }

  gain(inv: any) { return +inv.currentValue - +inv.initialAmount; }
  gainPct(inv: any) { return inv.initialAmount > 0 ? ((+inv.currentValue - +inv.initialAmount) / +inv.initialAmount * 100).toFixed(1) : '0.0'; }
  totalPortfolio() { return this.investments.reduce((s, i) => s + +i.currentValue, 0); }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  emptyForm() { return { name: '', ticker: '', type: 'STOCKS', isActive: true, initialAmount: 0, currentValue: 0, startDate: new Date().toISOString().slice(0,10), notes: '', logoUrl: '', bankAccountId: null }; }
  getByType(type: string) { return this.investments.filter((i: any) => i.type === type); }
}