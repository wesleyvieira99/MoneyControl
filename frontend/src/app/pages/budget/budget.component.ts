import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

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
  summary: any = null;
  loading = true;
  showModal = false;
  editMode = false;
  saving = false;
  selectedMonth: string;
  deleteConfirm: number | null = null;

  icons = ['🍔','🏠','🚗','💡','💊','📚','🎬','👗','✈️','💰','🐾','🎮','💻','⛽','🛒','🍷','💆','🏋️'];
  colors = ['#6c63ff','#00c9a7','#ffd93d','#ff6b6b','#4ecdc4','#a8e6cf','#ff8b94','#ffaaa5','#ffd3b6','#dcedc1','#c7ceea','#b5ead7'];

  form: Budget = this.emptyForm();

  constructor(private api: ApiService, private toast: ToastService) {
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getBudgets(this.selectedMonth).subscribe({
      next: (budgets: any) => {
        this.budgets = budgets || [];
        this.computeSummary();
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Erro ao carregar orçamentos', 'Verifique a conexão com o backend.'); }
    });
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
