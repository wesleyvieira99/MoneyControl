import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'transactions', loadComponent: () => import('./pages/transactions/transactions.component').then(m => m.TransactionsComponent) },
  { path: 'cards', loadComponent: () => import('./pages/cards/cards.component').then(m => m.CardsComponent) },
  { path: 'accounts', loadComponent: () => import('./pages/accounts/accounts.component').then(m => m.AccountsComponent) },
  { path: 'investments', loadComponent: () => import('./pages/investments/investments.component').then(m => m.InvestmentsComponent) },
  { path: 'debts', loadComponent: () => import('./pages/debts/debts.component').then(m => m.DebtsComponent) },
  { path: 'distribution', loadComponent: () => import('./pages/distribution/distribution.component').then(m => m.DistributionComponent) },
  { path: 'forecast', loadComponent: () => import('./pages/forecast/forecast.component').then(m => m.ForecastComponent) },
  { path: 'ir-chat', loadComponent: () => import('./pages/ir-chat/ir-chat.component').then(m => m.IrChatComponent) },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
];
