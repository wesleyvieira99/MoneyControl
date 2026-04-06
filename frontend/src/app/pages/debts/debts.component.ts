import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit {
  debts: any[] = [];
  cards: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();

  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.getDebts().subscribe(d => this.debts = d);
    this.api.getCards().subscribe(c => this.cards = c);
    this.api.getAccounts().subscribe(a => this.accounts = a);
  }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(d: any) { this.editMode = true; this.form = { ...d, creditCardId: d.creditCard?.id, bankAccountId: d.bankAccount?.id }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const payload = {
      ...this.form,
      creditCard: this.form.creditCardId ? { id: +this.form.creditCardId } : null,
      bankAccount: this.form.bankAccountId ? { id: +this.form.bankAccountId } : null,
    };
    const obs = this.editMode ? this.api.updateDebt(this.form.id, payload) : this.api.createDebt(payload);
    obs.subscribe(() => { this.closeModal(); this.api.getDebts().subscribe(d => this.debts = d); });
  }

  delete(id: number) {
    if (confirm('Excluir dívida?')) this.api.deleteDebt(id).subscribe(() => this.api.getDebts().subscribe(d => this.debts = d));
  }

  progress(d: any) { return d.totalInstallments > 0 ? (d.paidInstallments / d.totalInstallments) * 100 : 0; }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  totalDebt() { return this.debts.reduce((s, d) => s + +d.remainingAmount, 0); }

  emptyForm() {
    return { description: '', originalAmount: 0, remainingAmount: 0, totalInstallments: 12, paidInstallments: 0, startDate: new Date().toISOString().slice(0,10), status: 'PENDING', notes: '', creditCardId: null, bankAccountId: null };
  }
}
