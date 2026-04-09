import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',     loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'transactions',  loadComponent: () => import('./pages/transactions/transactions.component').then(m => m.TransactionsComponent) },
      { path: 'cards',         loadComponent: () => import('./pages/cards/cards.component').then(m => m.CardsComponent) },
      { path: 'accounts',      loadComponent: () => import('./pages/accounts/accounts.component').then(m => m.AccountsComponent) },
      { path: 'investments',   loadComponent: () => import('./pages/investments/investments.component').then(m => m.InvestmentsComponent) },
      { path: 'debts',         loadComponent: () => import('./pages/debts/debts.component').then(m => m.DebtsComponent) },
      { path: 'distribution',  loadComponent: () => import('./pages/distribution/distribution.component').then(m => m.DistributionComponent) },
      { path: 'forecast',      loadComponent: () => import('./pages/forecast/forecast.component').then(m => m.ForecastComponent) },
      { path: 'ir-chat',       loadComponent: () => import('./pages/ir-chat/ir-chat.component').then(m => m.IrChatComponent) },
      { path: 'settings',      loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'goals',         loadComponent: () => import('./pages/goals/goals.component').then(m => m.GoalsComponent) },
      { path: 'budget',        loadComponent: () => import('./pages/budget/budget.component').then(m => m.BudgetComponent) },
      { path: 'analytics',     loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent) },
      { path: 'simulator',     loadComponent: () => import('./pages/simulator/simulator.component').then(m => m.SimulatorComponent) },
      { path: 'raio-x',        loadComponent: () => import('./pages/raio-x/raio-x.component').then(m => m.RaioXComponent) },
      { path: 'investor-mode', loadComponent: () => import('./pages/investor-mode/investor-mode.component').then(m => m.InvestorModeComponent) },
      { path: 'calendar',      loadComponent: () => import('./pages/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: '**', redirectTo: 'dashboard' },
    ]
  },
  { path: '**', redirectTo: 'login' },
];
