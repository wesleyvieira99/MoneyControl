import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const BASE = 'http://localhost:8081/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // Accounts
  getAccounts() { return this.http.get<any[]>(`${BASE}/accounts`); }
  createAccount(a: any) { return this.http.post<any>(`${BASE}/accounts`, a); }
  updateAccount(id: number, a: any) { return this.http.put<any>(`${BASE}/accounts/${id}`, a); }
  deleteAccount(id: number) { return this.http.delete(`${BASE}/accounts/${id}`); }
  getAccountTransactions(id: number) { return this.http.get<any[]>(`${BASE}/accounts/${id}/transactions`); }
  getAccountCardTransactions(id: number) { return this.http.get<any[]>(`${BASE}/accounts/${id}/card-transactions`); }
  getAccountSummary(id: number) { return this.http.get<any>(`${BASE}/accounts/${id}/summary`); }
  getDebtsByAccount(accountId: number) { return this.http.get<any[]>(`${BASE}/debts/by-account/${accountId}`); }

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
  getCategoryUsage(id: number) { return this.http.get<any>(`${BASE}/categories/${id}/usage`); }
  replaceAndDeleteCategory(id: number, replacementCategoryId: number) {
    return this.http.post(`${BASE}/categories/${id}/replace-and-delete`, { replacementCategoryId });
  }

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
  getDebtsByCard(cardId: number) { return this.http.get<any[]>(`${BASE}/debts/by-card/${cardId}`); }
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
  getDashboardPillars(month?: string) {
    const url = month ? `${BASE}/dashboard/pillars?month=${month}` : `${BASE}/dashboard/pillars`;
    return this.http.get<any>(url);
  }
  getInsights(month?: string) {
    const url = month ? `${BASE}/dashboard/insights?month=${month}` : `${BASE}/dashboard/insights`;
    return this.http.get<any[]>(url);
  }

  // Data export/import
  exportData(): Observable<Blob> {
    return this.http.get(`${BASE}/data/export`, { responseType: 'blob' });
  }
  importData(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${BASE}/data/import`, formData);
  }

  // Debt WhatsApp reminders
  sendDebtReminders() { return this.http.post<any>(`${BASE}/debts/send-reminders`, {}); }
  syncDebtTransactions() { return this.http.post<any>(`${BASE}/debts/sync-transactions`, {}); }
  recomputeDebtStatus() { return this.http.post<any>(`${BASE}/debts/recompute-status`, {}); }
  patchDebtCategories() { return this.http.post<any>(`${BASE}/debts/patch-categories`, {}); }
  getDebtInstallments(id: number) { return this.http.get<any[]>(`${BASE}/debts/${id}/installments`); }
  patchDebtInstallment(debtId: number, installNum: number, status: string) {
    return this.http.patch<any>(`${BASE}/debts/${debtId}/installments/${installNum}`, { status });
  }

  // Forecast
  getForecast(months = 6) {
    return this.http.get<any>(`${BASE}/forecast?months=${months}`);
  }

  // AI Chat
  aiChat(messages: any[]) {
    return this.http.post<any>(`${BASE}/ai/chat`, { messages });
  }
  aiPdfAnalysis() {
    return this.http.get<any>(`${BASE}/ai/pdf-analysis`);
  }

  // Analytics
  getFinancialScore() { return this.http.get<any>(`${BASE}/analytics/score`); }
  getCashFlow() { return this.http.get<any>(`${BASE}/analytics/cashflow`); }
  getRecurring() { return this.http.get<any[]>(`${BASE}/analytics/recurring`); }
  getMonthlyComparison(months = 6) { return this.http.get<any[]>(`${BASE}/analytics/monthly-comparison?months=${months}`); }
  getSpendingPatterns() { return this.http.get<any>(`${BASE}/analytics/patterns`); }
  getIndependencePoint() { return this.http.get<any>(`${BASE}/analytics/independence`); }
  getAnomalies() { return this.http.get<any[]>(`${BASE}/analytics/anomalies`); }
  getTreemap(month?: string) {
    const url = month ? `${BASE}/analytics/treemap?month=${month}` : `${BASE}/analytics/treemap`;
    return this.http.get<any[]>(url);
  }

  // Budget
  getBudgets(month?: string) {
    const url = month ? `${BASE}/budget?month=${month}` : `${BASE}/budget`;
    return this.http.get<any[]>(url);
  }
  createBudget(b: any) { return this.http.post<any>(`${BASE}/budget`, b); }
  updateBudget(id: number, b: any) { return this.http.put<any>(`${BASE}/budget/${id}`, b); }
  deleteBudget(id: number) { return this.http.delete(`${BASE}/budget/${id}`); }
}
