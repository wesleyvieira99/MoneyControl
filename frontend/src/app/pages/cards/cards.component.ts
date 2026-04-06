import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cards.component.html',
  styleUrls: ['./cards.component.scss']
})
export class CardsComponent implements OnInit {
  cards: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  invoiceCard: any = null;
  invoiceTransactions: any[] = [];
  invoiceMonth = new Date().toISOString().slice(0,7);

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCards().subscribe(c => this.cards = c);
    this.api.getAccounts().subscribe(a => this.accounts = a);
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(c: any) { this.editMode = true; this.form = { ...c, bankAccountId: c.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = { ...this.form, bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null };
    const obs = this.editMode ? this.api.updateCard(this.form.id, payload) : this.api.createCard(payload);
    obs.subscribe(() => { this.closeModal(); this.api.getCards().subscribe(c => this.cards = c); });
  }

  delete(id: number) {
    if (confirm('Excluir cartão?')) this.api.deleteCard(id).subscribe(() => this.api.getCards().subscribe(c => this.cards = c));
  }

  openInvoice(card: any) {
    this.invoiceCard = card;
    this.loadInvoice();
  }

  loadInvoice() {
    this.api.getTransactions({ cardId: this.invoiceCard.id, start: this.invoiceMonth + '-01', end: this.invoiceMonth + '-31' })
      .subscribe(txs => this.invoiceTransactions = txs);
  }

  usedPercent(card: any) { return card.creditLimit > 0 ? Math.min(100, (card.usedLimit / card.creditLimit) * 100) : 0; }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  emptyForm() { return { name: '', bankName: '', creditLimit: 0, usedLimit: 0, closingDay: 15, dueDay: 22, color: '#820AD1', logoUrl: '', lastFourDigits: '', notes: '' }; }
  invoiceTotal() { return this.invoiceTransactions.reduce((s, t) => s + +t.amount, 0); }
}
