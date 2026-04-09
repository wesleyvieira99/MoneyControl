import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { DataSyncService } from '../../core/services/data-sync.service';
import { catchError, of, firstValueFrom } from 'rxjs';
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

  // Allocate modal
  showAllocateModal = false;
  allocateRule: any = null;
  allocateSaving = false;
  allocateForm = { accountId: '', amount: 0, categoryName: '' };

  colors = ['#3b82f6','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899'];
  destTypes = ['SAVINGS','INVESTMENT','POCKET','EXPENSE','EMERGENCY','CHARITY'];
  destLabels: any = { SAVINGS: '💾 Poupança', INVESTMENT: '📈 Investimento', POCKET: '👜 Bolso', EXPENSE: '💸 Despesas', EMERGENCY: '🆘 Emergência', CHARITY: '❤️ Caridade' };
  destIcons: any = { SAVINGS: '💾', INVESTMENT: '📈', POCKET: '👜', EXPENSE: '💸', EMERGENCY: '🆘', CHARITY: '❤️' };

  constructor(private api: ApiService, private toast: ToastService, private sync: DataSyncService) {}

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

  /* ─── Allocate / Separar Dinheiro ─────────────────────── */

  get expenseCategories() {
    return this.categories.filter(c => c.type === 'EXPENSE');
  }

  get selectedAllocateAccount(): any {
    return this.accounts.find(a => a.id === +this.allocateForm.accountId) || null;
  }

  get allocateMaxAmount(): number {
    const account = this.selectedAllocateAccount;
    return account ? +account.balance : 0;
  }

  get canAllocate(): boolean {
    return !!this.allocateForm.accountId
      && this.allocateForm.amount > 0
      && this.allocateForm.amount <= this.allocateMaxAmount
      && !!this.allocateForm.categoryName.trim();
  }

  openAllocate(r: any) {
    this.allocateRule = r;
    this.allocateForm = { accountId: '', amount: 0, categoryName: '' };
    this.showAllocateModal = true;
  }

  closeAllocateModal() {
    this.showAllocateModal = false;
    this.allocateRule = null;
  }

  fmt(v: number) { return (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  async saveAllocation() {
    if (!this.canAllocate || !this.allocateRule) return;
    this.allocateSaving = true;

    try {
      const r = this.allocateRule;
      const amt = this.allocateForm.amount;
      const catName = this.allocateForm.categoryName.trim();
      const accountId = +this.allocateForm.accountId;
      const account = this.accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Conta não encontrada');

      // 1. Find or create EXPENSE category
      let category = this.categories.find(c => c.type === 'EXPENSE' && c.name.toLowerCase() === catName.toLowerCase());
      if (!category) {
        category = await firstValueFrom(
          this.api.createCategory({ name: catName, type: 'EXPENSE', color: r.color || '#ef4444', icon: '📦' })
        );
        // Refresh local categories list so new category appears in autocomplete
        this.categories = await firstValueFrom(this.api.getCategories().pipe(catchError(() => of(this.categories))));
      }

      // 2. Create EXPENSE transaction
      const transaction = {
        date: new Date().toISOString().slice(0, 10),
        description: `Envelope: ${r.name}`,
        amount: amt,
        type: 'EXPENSE',
        status: 'PAID',
        category: { id: category.id },
        bankAccount: { id: accountId },
        notes: `Separação para envelope "${r.name}" (${this.destLabels[r.destinationType] || r.destinationType}) — categoria: ${catName}`
      };
      await firstValueFrom(this.api.createTransaction(transaction));

      // 3. Update account balance (deduct)
      const updatedAccount = { ...account, balance: +account.balance - amt };
      await firstValueFrom(this.api.updateAccount(accountId, updatedAccount));

      // 4. Update rule's allocatedAmount
      const newAllocated = +(r.allocatedAmount || 0) + amt;
      const updatedRule = {
        ...r,
        allocatedAmount: newAllocated,
        category: r.category?.id ? { id: r.category.id } : null,
        bankAccount: r.bankAccount?.id ? { id: r.bankAccount.id } : null
      };
      await firstValueFrom(this.api.updateDistributionRule(r.id, updatedRule));

      // 5. Emit sync events
      this.sync.emit({ type: 'TRANSACTIONS_CHANGED' });
      this.sync.emit({ type: 'ACCOUNTS_CHANGED' });

      this.toast.success('Dinheiro separado!', `${this.fmt(amt)} debitados de "${account.name}" para o envelope "${r.name}".`);

      // 6. Refresh data
      this.closeAllocateModal();
      this.loadRules();
      this.accounts = await firstValueFrom(this.api.getAccounts().pipe(catchError(() => of(this.accounts))));
    } catch {
      this.toast.error('Erro ao separar', 'Verifique os dados e tente novamente.');
    } finally {
      this.allocateSaving = false;
    }
  }
}
