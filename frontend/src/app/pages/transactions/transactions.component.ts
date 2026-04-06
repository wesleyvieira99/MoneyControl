import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent implements OnInit {
  transactions: any[] = [];
  filtered: any[] = [];
  accounts: any[] = [];
  cards: any[] = [];
  categories: any[] = [];
  overdueCount = 0;
  loading = true;

  filters = { start: '', end: '', accountId: '', cardId: '', search: '', status: '', type: '' };
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();

  constructor(private api: ApiService) {}

  ngOnInit() {
    const now = new Date();
    this.filters.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    this.filters.end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    this.load();
  }

  load() {
    this.loading = true;
    Promise.all([
      this.api.getAccounts().toPromise(),
      this.api.getCards().toPromise(),
      this.api.getCategories().toPromise(),
      this.api.getOverdueTransactions().toPromise()
    ]).then(([accounts, cards, categories, overdue]: any[]) => {
      this.accounts = accounts || [];
      this.cards = cards || [];
      this.categories = categories || [];
      this.overdueCount = overdue?.length || 0;
      this.loadTransactions();
    });
  }

  loadTransactions() {
    const p: any = {};
    if (this.filters.start) p['start'] = this.filters.start;
    if (this.filters.end) p['end'] = this.filters.end;
    if (this.filters.accountId) p['accountId'] = this.filters.accountId;
    if (this.filters.cardId) p['cardId'] = this.filters.cardId;
    this.api.getTransactions(p).subscribe(txs => {
      this.transactions = txs;
      this.applyFilters();
      this.loading = false;
    });
  }

  applyFilters() {
    let list = [...this.transactions];
    if (this.filters.search) list = list.filter(t => t.description?.toLowerCase().includes(this.filters.search.toLowerCase()));
    if (this.filters.status) list = list.filter(t => t.status === this.filters.status);
    if (this.filters.type) list = list.filter(t => t.type === this.filters.type);
    this.filtered = list;
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(t: any) { this.editMode = true; this.form = { ...t, categoryId: t.category?.id, bankAccountId: t.bankAccount?.id, creditCardId: t.creditCard?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = this.buildPayload();
    const obs = this.editMode ? this.api.updateTransaction(this.form.id, payload) : this.api.createTransaction(payload);
    obs.subscribe(() => { this.closeModal(); this.loadTransactions(); });
  }

  buildPayload() {
    return {
      ...this.form,
      category: this.form.categoryId ? { id: +this.form.categoryId } : null,
      bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null,
      creditCard: this.form.creditCardId ? { id: +this.form.creditCardId } : null,
    };
  }

  delete(id: number) {
    if (confirm('Excluir transação?')) this.api.deleteTransaction(id).subscribe(() => this.loadTransactions());
  }

  toggleStatus(t: any) {
    const next = t.status === 'PAID' ? 'PENDING' : 'PAID';
    this.api.updateTransactionStatus(t.id, next).subscribe(() => this.loadTransactions());
  }

  emptyForm() {
    return { date: new Date().toISOString().slice(0,10), description: '', amount: null, type: 'EXPENSE', status: 'PENDING', categoryId: null, bankAccountId: null, creditCardId: null, notes: '', isRecurring: false };
  }

  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  typeColor(t: string) { return { INCOME: 'green', EXPENSE: 'red', TRANSFER: 'blue', INVESTMENT: 'purple' }[t] || 'blue'; }
  statusColor(s: string) { return { PAID: 'green', PENDING: 'yellow', OVERDUE: 'red', CANCELLED: 'blue' }[s] || 'blue'; }
}
