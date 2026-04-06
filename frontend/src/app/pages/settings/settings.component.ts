import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  categories: any[] = [];
  showCatModal = false;
  editCatMode = false;
  catForm: any = {};
  catTypes = ['INCOME', 'EXPENSE', 'INVESTMENT', 'TRANSFER'];
  catIcons = ['💰','💳','🏦','🛒','🚗','✈️','🎮','🏋️','💊','📱','🍔','☕','🎬','📚','🏠','⚡','💧','📡','🎓','💼','🎰','📈'];

  constructor(private api: ApiService) {}
  ngOnInit() { this.api.getCategories().subscribe(c => this.categories = c); }

  openNewCat() { this.editCatMode = false; this.catForm = { name: '', type: 'EXPENSE', color: '#ef4444', icon: '💳' }; this.showCatModal = true; }
  openEditCat(c: any) { this.editCatMode = true; this.catForm = { ...c }; this.showCatModal = true; }
  closeCatModal() { this.showCatModal = false; }

  saveCat() {
    const obs = this.editCatMode ? this.api.updateCategory(this.catForm.id, this.catForm) : this.api.createCategory(this.catForm);
    obs.subscribe(() => { this.closeCatModal(); this.api.getCategories().subscribe(c => this.categories = c); });
  }

  deleteCat(id: number) {
    if (confirm('Excluir categoria?')) this.api.deleteCategory(id).subscribe(() => this.api.getCategories().subscribe(c => this.categories = c));
  }

  byType(type: string) { return this.categories.filter(c => c.type === type); }
  typeIcon(t: string) { return { INCOME: '��', EXPENSE: '📉', INVESTMENT: '💼', TRANSFER: '🔄' }[t] || '📋'; }
  typeLabel(t: string) { return { INCOME: 'Receita', EXPENSE: 'Despesa', INVESTMENT: 'Investimento', TRANSFER: 'Transferência' }[t] || t; }
}
