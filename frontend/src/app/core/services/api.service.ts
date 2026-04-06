import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const BASE = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // Accounts
  getAccounts() { return this.http.get<any[]>(`${BASE}/accounts`); }
  createAccount(a: any) { return this.http.post<any>(`${BASE}/accounts`, a); }
  updateAccount(id: number, a: any) { return this.http.put<any>(`${BASE}/accounts/${id}`, a); }
  deleteAccount(id: number) { return this.http.delete(`${BASE}/accounts/${id}`); }

  // Cards
  getCards() { return this.http.get<any[]>(`${BASE}/cards`); }
  createCard(c: any) { return this.http.post<any>(`${BASE}/cards`, c); }
  updateCard(id: number, c: any) { return this.http.put<any>(`${BASE}/cards/${id}`, c); }
  deleteCard(id: number) { return this.http.delete(`${BASE}/cards/${id}`); }

  // Categories
  getCategories() { return this.http.get<any[]>(`${BASE}/categories`); }
  createCategory(c: any) { return this.http.post<any>(`${BASE}/categories`, c); }
  updateCategory(id: number, c: any) { return this.http.put<any>(`${BASE}/categories/${id}`, c); }
  deleteCategory(id: number) { return this.http.delete(`${BASE}/categories/${id}`); }

  // Transactions
  getTransactions(params?: any) {
    let p = new HttpParams();
    if (params) Object.keys(params).forEach(k => { if (params[k]) p = p.set(k, params[k]); });
    return this.http.get<any[]>(`${BASE}/transactions`, { params: p });
  }
  getOverdueTransactions() { return this.http.get<any[]>(`${BASE}/transactions/overdue`); }
  createTransaction(t: any) { return this.http.post<any>(`${BASE}/transactions`, t); }
  updateTransaction(id: number, t: any) { return this.http.put<any>(`${BASE}/transactions/${id}`, t); }
  updateTransactionStatus(id: number, status: string) {
    return this.http.patch<any>(`${BASE}/transactions/${id}/status?status=${status}`, {});
  }
  deleteTransaction(id: number) { return this.http.delete(`${BASE}/transactions/${id}`); }

  // Investments
  getInvestments() { return this.http.get<any[]>(`${BASE}/investments`); }
  createInvestment(i: any) { return this.http.post<any>(`${BASE}/investments`, i); }
  updateInvestment(id: number, i: any) { return this.http.put<any>(`${BASE}/investments/${id}`, i); }
  deleteInvestment(id: number) { return this.http.delete(`${BASE}/investments/${id}`); }
  getInvestmentTransactions(id: number) { return this.http.get<any[]>(`${BASE}/investments/${id}/transactions`); }
  addInvestmentTransaction(id: number, t: any) { return this.http.post<any>(`${BASE}/investments/${id}/transactions`, t); }

  // Debts
  getDebts() { return this.http.get<any[]>(`${BASE}/debts`); }
  createDebt(d: any) { return this.http.post<any>(`${BASE}/debts`, d); }
  updateDebt(id: number, d: any) { return this.http.put<any>(`${BASE}/debts/${id}`, d); }
  deleteDebt(id: number) { return this.http.delete(`${BASE}/debts/${id}`); }

  // Distribution rules
  getDistributionRules() { return this.http.get<any[]>(`${BASE}/distribution-rules`); }
  createDistributionRule(r: any) { return this.http.post<any>(`${BASE}/distribution-rules`, r); }
  updateDistributionRule(id: number, r: any) { return this.http.put<any>(`${BASE}/distribution-rules/${id}`, r); }
  deleteDistributionRule(id: number) { return this.http.delete(`${BASE}/distribution-rules/${id}`); }

  // Goals
  getGoals() { return this.http.get<any[]>(`${BASE}/goals`); }
  createGoal(g: any) { return this.http.post<any>(`${BASE}/goals`, g); }
  updateGoal(id: number, g: any) { return this.http.put<any>(`${BASE}/goals/${id}`, g); }
  deleteGoal(id: number) { return this.http.delete(`${BASE}/goals/${id}`); }

  // Dashboard
  getDashboardSummary(month?: string) {
    const url = month ? `${BASE}/dashboard/summary?month=${month}` : `${BASE}/dashboard/summary`;
    return this.http.get<any>(url);
  }
  getBalanceHistory(months = 6) {
    return this.http.get<any[]>(`${BASE}/dashboard/balance-history?months=${months}`);
  }
  getHeatmap(year?: string) {
    const url = year ? `${BASE}/dashboard/heatmap?year=${year}` : `${BASE}/dashboard/heatmap`;
    return this.http.get<any[]>(url);
  }
  getCategoryBreakdown(month?: string) {
    const url = month ? `${BASE}/dashboard/category-breakdown?month=${month}` : `${BASE}/dashboard/category-breakdown`;
    return this.http.get<any[]>(url);
  }

  // Forecast
  getForecast(months = 6) {
    return this.http.get<any>(`${BASE}/forecast?months=${months}`);
  }

  // AI Chat
  aiChat(messages: any[]) {
    return this.http.post<any>(`${BASE}/ai/chat`, { messages });
  }
}
