import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit {
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  historyAccount: any = null;
  historyTxs: any[] = [];

  constructor(private api: ApiService) {}
  ngOnInit() { this.api.getAccounts().subscribe(a => this.accounts = a); }

  openNew() { this.editMode = false; this.form = this.emptyForm(); this.showModal = true; }
  openEdit(a: any) { this.editMode = true; this.form = { ...a }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    const obs = this.editMode ? this.api.updateAccount(this.form.id, this.form) : this.api.createAccount(this.form);
    obs.subscribe(() => { this.closeModal(); this.api.getAccounts().subscribe(a => this.accounts = a); });
  }
  delete(id: number) {
    if (confirm('Excluir conta?')) this.api.deleteAccount(id).subscribe(() => this.api.getAccounts().subscribe(a => this.accounts = a));
  }
  openHistory(a: any) {
    this.historyAccount = a;
    this.api.getTransactions({ accountId: a.id }).subscribe(txs => this.historyTxs = txs);
  }
  totalBalance() { return this.accounts.reduce((s, a) => s + +a.balance, 0); }
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''; }
  emptyForm() { return { name: '', bankName: '', balance: 0, color: '#3b82f6', logoUrl: '', accountNumber: '', notes: '' }; }
}
