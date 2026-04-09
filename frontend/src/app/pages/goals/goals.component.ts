import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { DataSyncService } from '../../core/services/data-sync.service';
import { catchError, of, firstValueFrom } from 'rxjs';

interface Goal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  notes: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './goals.component.html',
  styleUrls: ['./goals.component.scss']
})
export class GoalsComponent implements OnInit {
  goals: Goal[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  loading = true;
  showModal = false;
  editMode = false;
  saving = false;
  deleteConfirm: number | null = null;

  // Contribute modal
  showContributeModal = false;
  contributeGoal: Goal | null = null;
  contributeSaving = false;
  contributeMode: 'APORTE' | 'RETIRADA' = 'APORTE';
  contributeForm = { accountId: '', amount: 0, categoryName: '' };

  icons = ['🎯','🏠','🚗','✈️','💍','🎓','💰','🏖️','🏋️','💻','🎸','🌍','⛵','🏥','👶','🐾'];
  colors = ['#6c63ff','#00c9a7','#ffd93d','#ff6b6b','#4ecdc4','#a8e6cf','#ff8b94','#ffaaa5','#ffd3b6','#dcedc1'];

  form: Goal = this.emptyForm();
  confettiParticles: any[] = [];

  constructor(private api: ApiService, private toast: ToastService, private sync: DataSyncService) {}

  ngOnInit() { this.load(); this.loadAccounts(); this.loadCategories(); }

  load() {
    this.loading = true;
    this.api.getGoals().subscribe({
      next: (g: any[]) => { this.goals = g; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadAccounts() {
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => this.accounts = a);
  }

  loadCategories() {
    this.api.getCategories().pipe(catchError(() => of([]))).subscribe(c => this.categories = c);
  }

  get expenseCategories() {
    return this.categories.filter(c => c.type === 'EXPENSE' || c.type === 'INCOME');
  }

  totalAccountBalance(): number { return this.accounts.reduce((s, a) => s + +a.balance, 0); }

  emptyForm(): Goal {
    return { name:'', targetAmount:0, currentAmount:0, deadline:'', notes:'', color: this.colors[0], icon: this.icons[0] };
  }

  openAdd() { this.form = this.emptyForm(); this.editMode = false; this.showModal = true; }
  openEdit(g: Goal) { this.form = { ...g }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    this.saving = true;
    const obs = this.editMode
      ? this.api.updateGoal(this.form.id!, this.form)
      : this.api.createGoal(this.form);
    obs.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.load();
        this.toast.success(
          this.editMode ? 'Meta atualizada!' : 'Meta criada!',
          `"${this.form.name}" foi ${this.editMode ? 'atualizada' : 'adicionada'} com sucesso.`
        );
      },
      error: () => {
        this.saving = false;
        this.toast.error('Erro ao salvar', 'Verifique os dados e tente novamente.');
      }
    });
  }

  delete(id: number) {
    if (this.deleteConfirm !== id) { this.deleteConfirm = id; return; }
    const name = this.goals.find(g => g.id === id)?.name ?? '';
    this.api.deleteGoal(id).subscribe({
      next: () => { this.deleteConfirm = null; this.load(); this.toast.warning('Meta removida', `"${name}" foi excluída.`); },
      error: () => { this.toast.error('Erro ao excluir', 'Tente novamente.'); }
    });
  }

  /** Open the contribute modal */
  contribute(g: Goal, mode: 'APORTE' | 'RETIRADA' = 'APORTE') {
    this.contributeGoal = g;
    this.contributeMode = mode;
    this.contributeForm = { accountId: '', amount: 0, categoryName: mode === 'APORTE' ? 'Aporte Meta' : 'Retirada Meta' };
    this.showContributeModal = true;
  }

  closeContributeModal() {
    this.showContributeModal = false;
    this.contributeGoal = null;
  }

  /** Max amount permitido */
  get contributeMaxAmount(): number {
    if (!this.contributeGoal) return 0;
    const account = this.accounts.find(a => a.id === +this.contributeForm.accountId);
    if (this.contributeMode === 'APORTE') {
      const remaining = Math.max(0, +this.contributeGoal.targetAmount - +this.contributeGoal.currentAmount);
      return account ? Math.min(remaining, Math.max(0, +account.balance)) : remaining;
    } else {
      // Retirada: máximo é o acumulado na meta
      return Math.max(0, +this.contributeGoal.currentAmount);
    }
  }

  get selectedContributeAccount(): any {
    return this.accounts.find(a => a.id === +this.contributeForm.accountId) || null;
  }

  get canContribute(): boolean {
    return !!this.contributeForm.accountId
      && this.contributeForm.amount > 0
      && this.contributeForm.amount <= this.contributeMaxAmount
      && !!this.contributeForm.categoryName.trim();
  }

  /** Execute aporte ou retirada */
  async saveContribution() {
    if (!this.canContribute || !this.contributeGoal) return;
    this.contributeSaving = true;
    const isAporte = this.contributeMode === 'APORTE';

    try {
      const g = this.contributeGoal;
      const amt = this.contributeForm.amount;
      const catName = this.contributeForm.categoryName.trim();
      const accountId = +this.contributeForm.accountId;
      const account = this.accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Conta não encontrada');

      // 1. Encontrar ou criar categoria (aporte=EXPENSE, retirada=INCOME)
      let category = this.categories.find(c =>
        c.type === (isAporte ? 'EXPENSE' : 'INCOME') &&
        c.name.toLowerCase() === catName.toLowerCase()
      );
      if (!category) {
        category = await firstValueFrom(
          this.api.createCategory({ name: catName, type: isAporte ? 'EXPENSE' : 'INCOME', color: g.color || '#ef4444', icon: g.icon || '🎯' })
        );
        this.loadCategories();
      }

      // 2. Criar transação
      await firstValueFrom(this.api.createTransaction({
        date: new Date().toISOString().slice(0, 10),
        description: `${isAporte ? 'Aporte' : 'Retirada'}: ${g.name}`,
        amount: amt,
        type: isAporte ? 'EXPENSE' : 'INCOME',
        status: 'PAID',
        category: { id: category.id },
        bankAccount: { id: accountId },
        notes: `${isAporte ? 'Aporte' : 'Retirada'} meta "${g.name}" — categoria: ${catName}`
      }));

      // 3. Atualizar saldo da conta
      await firstValueFrom(this.api.updateAccount(accountId, {
        ...account,
        balance: isAporte ? +account.balance - amt : +account.balance + amt
      }));

      // 4. Atualizar currentAmount da meta
      const newCurrent = isAporte
        ? Math.min(+g.currentAmount + amt, +g.targetAmount)
        : Math.max(0, +g.currentAmount - amt);
      await firstValueFrom(this.api.updateGoal(g.id!, { ...g, currentAmount: newCurrent }));

      // 5. Sincronizar
      this.sync.emit({ type: 'TRANSACTIONS_CHANGED' });
      this.sync.emit({ type: 'ACCOUNTS_CHANGED' });

      // 6. Toast / confete
      if (isAporte && newCurrent >= +g.targetAmount) {
        this.celebrate();
        this.toast.success('🎉 Meta atingida!', `Parabéns! Você concluiu "${g.name}".`, 6000);
      } else {
        this.toast.success(
          isAporte ? 'Aporte realizado!' : 'Retirada realizada!',
          `${this.fmt(amt)} ${isAporte ? 'debitados de' : 'creditados em'} "${account.name}". Transação registrada.`
        );
      }

      this.closeContributeModal();
      this.load();
      this.loadAccounts();
    } catch {
      this.toast.error('Erro ao processar', 'Verifique os dados e tente novamente.');
    } finally {
      this.contributeSaving = false;
    }
  }

  celebrate() {
    this.confettiParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      size: 6 + Math.random() * 10,
      delay: Math.random() * 1.5
    }));
    setTimeout(() => this.confettiParticles = [], 4000);
  }

  pct(g: Goal) {
    const p = +g.targetAmount > 0 ? (+g.currentAmount / +g.targetAmount) * 100 : 0;
    return Math.min(100, Math.round(p * 10) / 10);
  }

  remaining(g: Goal) { return Math.max(0, +g.targetAmount - +g.currentAmount); }

  daysLeft(g: Goal) {
    if (!g.deadline) return null;
    const d = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000);
    return d;
  }

  urgency(g: Goal): string {
    const d = this.daysLeft(g);
    if (d === null) return 'normal';
    if (d < 0) return 'overdue';
    if (d <= 30) return 'urgent';
    if (d <= 90) return 'soon';
    return 'normal';
  }

  fmt(v: number) { return (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  trackById(i: number, g: any) { return g.id ?? i; }
}
