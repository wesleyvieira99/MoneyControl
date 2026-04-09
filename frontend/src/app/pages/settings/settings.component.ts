import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { catchError, forkJoin, of } from 'rxjs';
import type { EChartsOption } from 'echarts';

interface AffectedItem {
  id: number;
  type: 'TRANSACTION' | 'BUDGET';
  description: string;
  amount: number;
  date?: string;
  month?: string;
  replacementCategoryId?: number;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  categories: any[] = [];
  showCatModal = false;
  editCatMode = false;
  catForm: any = {};
  activeSection = 'categories';
  catTypes = ['INCOME', 'EXPENSE', 'INVESTMENT', 'TRANSFER'];
  catIcons = ['💰','💳','🏦','🛒','🚗','✈️','🎮','🏋️','💊','📱','🍔','☕','🎬','📚','🏠','⚡','💧','📡','🎓','💼','🎰','📈','🏥','🎁','🐾','🌿','🔧','📦','🎵','🎨'];

  // Delete modal
  showDeleteModal = false;
  deleteLoading = false;
  deleteCatTarget: any = null;
  deleteAffectedItems: AffectedItem[] = [];
  deleteReplacementId: number | null = null;
  deleteHasAffected = false;

  // System stats
  totalAccounts = 0;
  totalTransactions = 0;
  totalInvestments = 0;
  totalCards = 0;
  totalDebts = 0;
  activityChart: EChartsOption = {};

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategories().pipe(catchError(() => of([]))).subscribe(c => this.categories = c);
    this.loadStats();
  }

  loadStats() {
    forkJoin({
      accounts:     this.api.getAccounts().pipe(catchError(() => of([]))),
      transactions: this.api.getTransactions({}).pipe(catchError(() => of([]))),
      investments:  this.api.getInvestments().pipe(catchError(() => of([]))),
      cards:        this.api.getCards().pipe(catchError(() => of([]))),
      debts:        this.api.getDebts().pipe(catchError(() => of([]))),
    }).subscribe(({ accounts, transactions, investments, cards, debts }: any) => {
      this.totalAccounts     = (accounts     || []).length;
      this.totalTransactions = (transactions || []).length;
      this.totalInvestments  = (investments  || []).length;
      this.totalCards        = (cards        || []).length;
      this.totalDebts        = (debts        || []).length;
      this.buildActivityChart(transactions || []);
    });
  }

  buildActivityChart(transactions: any[]) {
    // Group transactions by month (last 12 months)
    const monthMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      monthMap[key] = 0;
    }
    transactions.forEach((t: any) => {
      if (!t.date) return;
      const d = new Date(t.date);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (key in monthMap) monthMap[key]++;
    });

    const months = Object.keys(monthMap);
    const vals   = Object.values(monthMap);

    this.activityChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1200,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,28,0.96)',
        borderColor: 'rgba(139,92,246,0.35)',
        textStyle: { color: '#f1f5f9', fontSize: 12 },
        formatter: (p: any) => `<b style="color:#e2e8f0">${p[0]?.name}</b><br/><span style="color:#94a3b8">Transações: </span><b style="color:#3b82f6">${p[0]?.value}</b>`
      },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: months, axisLabel: { color: '#64748b', fontSize: 9, rotate: 30 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }, axisLine: { show: false } },
      series: [{
        type: 'bar', data: vals, barMaxWidth: 20,
        itemStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 0.6, color: '#8b5cf6' }, { offset: 1, color: 'rgba(59,130,246,0.2)' }] },
          borderRadius: [6, 6, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 14, shadowColor: 'rgba(59,130,246,0.5)' } }
      }]
    } as EChartsOption;
  }

  openNewCat() { this.editCatMode = false; this.catForm = { name: '', type: 'EXPENSE', color: '#ef4444', icon: '💳' }; this.showCatModal = true; }
  openEditCat(c: any) { this.editCatMode = true; this.catForm = { ...c }; this.showCatModal = true; }
  closeCatModal() { this.showCatModal = false; }

  reloadCats() { this.api.getCategories().pipe(catchError(() => of([]))).subscribe(c => this.categories = c); }

  saveCat() {
    const obs = this.editCatMode ? this.api.updateCategory(this.catForm.id, this.catForm) : this.api.createCategory(this.catForm);
    obs.subscribe({ next: () => { this.closeCatModal(); this.reloadCats(); }, error: () => this.closeCatModal() });
  }

  deleteCat(id: number) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) return;
    this.deleteCatTarget = cat;
    this.deleteLoading = true;
    this.deleteAffectedItems = [];
    this.deleteReplacementId = null;
    this.deleteHasAffected = false;
    this.showDeleteModal = true;

    this.api.getCategoryUsage(id).pipe(catchError(() => of({ transactions: [], budgets: [], totalAffected: 0 })))
      .subscribe((usage: any) => {
        this.deleteLoading = false;
        const items: AffectedItem[] = [
          ...(usage.transactions || []).map((t: any) => ({ ...t, type: 'TRANSACTION' as const })),
          ...(usage.budgets || []).map((b: any) => ({ ...b, type: 'BUDGET' as const })),
        ];
        this.deleteAffectedItems = items;
        this.deleteHasAffected = items.length > 0;
      });
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteCatTarget = null;
    this.deleteAffectedItems = [];
    this.deleteReplacementId = null;
  }

  get replacementCategories(): any[] {
    if (!this.deleteCatTarget) return [];
    return this.categories.filter(c => c.id !== this.deleteCatTarget.id);
  }

  get canConfirmDelete(): boolean {
    if (!this.deleteHasAffected) return true;
    return this.deleteReplacementId !== null;
  }

  confirmDelete() {
    if (!this.deleteCatTarget) return;
    const id = this.deleteCatTarget.id;

    if (this.deleteHasAffected && this.deleteReplacementId) {
      this.deleteLoading = true;
      this.api.replaceAndDeleteCategory(id, this.deleteReplacementId).subscribe({
        next: () => { this.closeDeleteModal(); this.reloadCats(); this.deleteLoading = false; },
        error: () => { this.deleteLoading = false; }
      });
    } else {
      this.api.deleteCategory(id).subscribe({
        next: () => { this.closeDeleteModal(); this.reloadCats(); },
        error: () => this.closeDeleteModal()
      });
    }
  }

  byType(type: string) { return this.categories.filter(c => c.type === type); }
  typeIcon(t: string) { return ({ INCOME: '📈', EXPENSE: '📉', INVESTMENT: '💼', TRANSFER: '🔄' } as any)[t] || '📋'; }
  typeLabel(t: string) { return ({ INCOME: 'Receita', EXPENSE: 'Despesa', INVESTMENT: 'Investimento', TRANSFER: 'Transferência' } as any)[t] || t; }
}
