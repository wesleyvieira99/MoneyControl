import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { DataSyncService } from '../../core/services/data-sync.service';
import { catchError, of, firstValueFrom } from 'rxjs';

interface Budget {
  id?: number;
  month: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  budgetAmount: number;
  spentAmount?: number;
  remainingAmount?: number;
  percentUsed?: number;
  overBudget?: boolean;
}

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.scss']
})
export class BudgetComponent implements OnInit {
  Math = Math;
  budgets: Budget[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  summary: any = null;
  loading = true;
  showModal = false;
  editMode = false;
  saving = false;
  selectedMonth: string;
  deleteConfirm: number | null = null;

  // Aporte/Retirada modal
  showMoveModal = false;
  moveBudget: Budget | null = null;
  moveMode: 'APORTE' | 'RETIRADA' = 'APORTE';
  moveForm = { accountId: '', amount: 0, description: '' };
  moveSaving = false;

  icons = ['🍔','🏠','🚗','💡','💊','📚','🎬','👗','✈️','💰','🐾','🎮','💻','⛽','🛒','🍷','💆','🏋️'];
  colors = ['#6c63ff','#00c9a7','#ffd93d','#ff6b6b','#4ecdc4','#a8e6cf','#ff8b94','#ffaaa5','#ffd3b6','#dcedc1','#c7ceea','#b5ead7'];

  form: Budget = this.emptyForm();

  constructor(private api: ApiService, private toast: ToastService, private sync: DataSyncService) {
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  ngOnInit() { this.load(); this.loadAccounts(); this.loadCategories(); }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showMoveModal) { this.closeMoveModal(); return; }
    if (this.showModal) { this.closeModal(); }
  }

  load() {
    this.loading = true;
    this.api.getBudgets(this.selectedMonth).subscribe({
      next: (budgets: any) => { this.budgets = budgets || []; this.computeSummary(); this.loading = false; },
      error: () => { this.loading = false; this.toast.error('Erro ao carregar orçamentos', 'Verifique a conexão com o backend.'); }
    });
  }

  loadAccounts() {
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => this.accounts = a);
  }

  loadCategories() {
    this.api.getCategories().pipe(catchError(() => of([]))).subscribe(c => this.categories = c);
  }

  computeSummary() {
    const totalBudget = this.budgets.reduce((s, b) => s + +b.budgetAmount, 0);
    const totalSpent = this.budgets.reduce((s, b) => s + +(b.spentAmount ?? 0), 0);
    const overCount = this.budgets.filter(b => b.overBudget).length;
    this.summary = {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      overallPct: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      overBudgetCount: overCount
    };
  }

  emptyForm(): Budget {
    return {
      month: this.selectedMonth || new Date().toISOString().slice(0, 7),
      categoryName: '', categoryIcon: this.icons[0], categoryColor: this.colors[0], budgetAmount: 0
    };
  }

  openAdd() { this.form = { ...this.emptyForm(), month: this.selectedMonth }; this.editMode = false; this.showModal = true; }
  openEdit(b: Budget) { this.form = { ...b }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    this.saving = true;
    const obs = this.editMode
      ? this.api.updateBudget(this.form.id!, this.form)
      : this.api.createBudget(this.form);
    obs.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.load();
        this.toast.success(
          this.editMode ? 'Envelope atualizado!' : 'Envelope criado!',
          `Categoria "${this.form.categoryName}" ${this.editMode ? 'atualizada' : 'adicionada'}.`
        );
      },
      error: () => {
        this.saving = false;
        this.toast.error('Erro ao salvar envelope', 'Verifique os dados e tente novamente.');
      }
    });
  }

  delete(id: number) {
    if (this.deleteConfirm !== id) { this.deleteConfirm = id; return; }
    const cat = this.budgets.find(b => b.id === id)?.categoryName ?? '';
    this.api.deleteBudget(id).subscribe({
      next: () => { this.deleteConfirm = null; this.load(); this.toast.warning('Envelope removido', `"${cat}" foi excluído.`); },
      error: () => { this.toast.error('Erro ao excluir', 'Tente novamente.'); }
    });
  }

  // ── Aporte / Retirada ────────────────────────────────────────
  openMove(b: Budget, mode: 'APORTE' | 'RETIRADA') {
    this.moveBudget = b;
    this.moveMode = mode;
    this.moveForm = {
      accountId: '',
      amount: 0,
      description: mode === 'APORTE' ? `Aporte: ${b.categoryName}` : `Retirada: ${b.categoryName}`
    };
    this.showMoveModal = true;
  }

  closeMoveModal() { this.showMoveModal = false; this.moveBudget = null; }

  get moveSelectedAccount(): any {
    return this.accounts.find(a => a.id === +this.moveForm.accountId) || null;
  }

  get moveMaxAmount(): number {
    return this.moveSelectedAccount ? Math.max(0, +this.moveSelectedAccount.balance) : 999999;
  }

  get canMove(): boolean {
    return !!this.moveForm.accountId
      && this.moveForm.amount > 0
      && this.moveForm.amount <= this.moveMaxAmount
      && !!this.moveForm.description.trim();
  }

  async saveMove() {
    if (!this.canMove || !this.moveBudget) return;
    this.moveSaving = true;
    try {
      const b = this.moveBudget;
      const amt = +this.moveForm.amount;
      const accountId = +this.moveForm.accountId;
      const account = this.accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Conta não encontrada');
      const isAporte = this.moveMode === 'APORTE';

      // 1. Encontrar ou criar categoria
      let category = this.categories.find((c: any) =>
        c.name.toLowerCase() === b.categoryName.toLowerCase()
      );
      if (!category) {
        category = await firstValueFrom(
          this.api.createCategory({
            name: b.categoryName,
            type: isAporte ? 'EXPENSE' : 'INCOME',
            color: b.categoryColor || '#6c63ff',
            icon: b.categoryIcon || '💰'
          })
        );
        this.loadCategories();
      }

      // 2. Criar transação — aporte=EXPENSE (sai da conta), retirada=INCOME (entra na conta)
      await firstValueFrom(this.api.createTransaction({
        date: new Date().toISOString().slice(0, 10),
        description: this.moveForm.description.trim(),
        amount: amt,
        type: isAporte ? 'EXPENSE' : 'INCOME',
        status: 'PAID',
        category: { id: category.id },
        bankAccount: { id: accountId },
        notes: `${isAporte ? 'Aporte' : 'Retirada'} envelope "${b.categoryName}" — ${this.monthLabel(this.selectedMonth)}`
      }));

      // 3. Atualizar saldo da conta
      await firstValueFrom(this.api.updateAccount(accountId, {
        ...account,
        balance: isAporte ? +account.balance - amt : +account.balance + amt
      }));

      // 4. Sincronizar outros componentes
      this.sync.emit({ type: 'TRANSACTIONS_CHANGED' });
      this.sync.emit({ type: 'ACCOUNTS_CHANGED' });

      this.toast.success(
        isAporte ? 'Aporte realizado!' : 'Retirada realizada!',
        `${this.fmt(amt)} ${isAporte ? 'debitados de' : 'creditados em'} "${account.name}". Transação registrada em Transações.`
      );

      this.closeMoveModal();
      this.load();
      this.loadAccounts();
    } catch {
      this.toast.error('Erro ao processar', 'Verifique os dados e tente novamente.');
    } finally {
      this.moveSaving = false;
    }
  }

  totalAccountBalance(): number { return this.accounts.reduce((s, a) => s + +a.balance, 0); }

  monthLabel(m: string) {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  changeMonth(dir: number) {
    const [y, m] = this.selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    this.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.load();
  }

  statusLabel(b: Budget) {
    const p = b.percentUsed ?? 0;
    if (p >= 100) return 'critical';
    if (p >= 80) return 'warning';
    if (p >= 50) return 'caution';
    return 'good';
  }

  fmt(v: number) { return (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  fmtPct(v: number) { return Math.min(100, Math.round((+v) * 10) / 10) + '%'; }
  trackById(i: number, b: any) { return b.id ?? i; }
}
