import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

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
  loading = true;
  showModal = false;
  editMode = false;
  saving = false;
  deleteConfirm: number | null = null;

  icons = ['🎯','🏠','🚗','✈️','💍','🎓','💰','🏖️','🏋️','💻','🎸','🌍','⛵','🏥','👶','🐾'];
  colors = ['#6c63ff','#00c9a7','#ffd93d','#ff6b6b','#4ecdc4','#a8e6cf','#ff8b94','#ffaaa5','#ffd3b6','#dcedc1'];

  form: Goal = this.emptyForm();
  confettiParticles: any[] = [];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getGoals().subscribe({
      next: (g: any[]) => { this.goals = g; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

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

  contribute(g: Goal) {
    const amt = parseFloat(prompt(`Adicionar quanto a "${g.name}"?`, '100') || '0');
    if (!amt || isNaN(amt)) return;
    const updated = { ...g, currentAmount: Math.min(+g.currentAmount + amt, +g.targetAmount) };
    this.api.updateGoal(g.id!, updated).subscribe({
      next: () => {
        if (updated.currentAmount >= updated.targetAmount) {
          this.celebrate();
          this.toast.success('🎉 Meta atingida!', `Parabéns! Você concluiu "${g.name}".`, 6000);
        } else {
          this.toast.success('Contribuição adicionada!', `${this.fmt(amt)} adicionados à meta "${g.name}".`);
        }
        this.load();
      },
      error: () => { this.toast.error('Erro ao contribuir', 'Tente novamente.'); }
    });
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
