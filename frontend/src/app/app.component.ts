import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from './core/services/api.service';

interface NavItem { path: string; label: string; icon: string; badge?: string; }
interface NavGroup { group: string; items: NavItem[]; }
interface TickerItem { label: string; value: string; change: string; up: boolean; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  sidebarOpen = true;
  isDark = true;
  currentTime = '';
  currentDate = '';
  private timer: any;
  private tickerTimer: any;
  ticker: TickerItem[] = [];

  navGroups: NavGroup[] = [
    {
      group: 'Principal',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '◈' },
        { path: '/transactions', label: 'Transações', icon: '⇄' },
        { path: '/accounts', label: 'Contas', icon: '◉' },
        { path: '/cards', label: 'Cartões', icon: '▣' },
      ]
    },
    {
      group: 'Patrimônio',
      items: [
        { path: '/investments', label: 'Investimentos', icon: '▲' },
        { path: '/debts', label: 'Dívidas', icon: '▼' },
        { path: '/distribution', label: 'Distribuição', icon: '◎' },
      ]
    },
    {
      group: 'Inteligência',
      items: [
        { path: '/forecast', label: 'Previsões ML', icon: '⬡' },
        { path: '/ir-chat', label: 'Chat IA', icon: '✦' },
        { path: '/settings', label: 'Configurações', icon: '⚙' },
      ]
    },
  ];

  constructor(private api: ApiService) {}

  ngOnInit() {
    const saved = localStorage.getItem('mc-theme');
    this.isDark = saved !== 'light';
    this.applyTheme();
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
    this.loadTicker();
    this.tickerTimer = setInterval(() => this.loadTicker(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    clearInterval(this.tickerTimer);
  }

  updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.currentDate = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  loadTicker() {
    Promise.all([
      this.api.getAccounts().toPromise(),
      this.api.getInvestments().toPromise(),
      this.api.getDebts().toPromise(),
    ]).then(([accounts, investments, debts]: any[]) => {
      const items: TickerItem[] = [];
      const totalBalance = (accounts || []).reduce((s: number, a: any) => s + +a.balance, 0);
      items.push({ label: '🏦 Saldo Consolidado', value: this.fmt(totalBalance), change: '', up: totalBalance >= 0 });
      (accounts || []).forEach((a: any) => {
        items.push({ label: `◉ ${a.name}`, value: this.fmt(+a.balance), change: a.balance >= 0 ? '▲' : '▼', up: +a.balance >= 0 });
      });
      const totalInvested = (investments || []).reduce((s: number, i: any) => s + +i.currentValue, 0);
      const totalGain = (investments || []).reduce((s: number, i: any) => s + (+i.currentValue - +i.initialAmount), 0);
      const gainPct = totalInvested > 0 ? ((totalGain / (totalInvested - totalGain)) * 100).toFixed(2) : '0.00';
      items.push({ label: '📈 Carteira Total', value: this.fmt(totalInvested), change: `${totalGain >= 0 ? '+' : ''}${gainPct}%`, up: totalGain >= 0 });
      (investments || []).slice(0, 8).forEach((inv: any) => {
        const gain = +inv.currentValue - +inv.initialAmount;
        const pct = +inv.initialAmount > 0 ? ((gain / +inv.initialAmount) * 100).toFixed(2) : '0.00';
        items.push({ label: `▲ ${inv.name}`, value: this.fmt(+inv.currentValue), change: `${gain >= 0 ? '+' : ''}${pct}%`, up: gain >= 0 });
      });
      const totalDebt = (debts || []).reduce((s: number, d: any) => s + +d.remainingAmount, 0);
      if (totalDebt > 0) items.push({ label: '⚠ Dívidas Totais', value: this.fmt(totalDebt), change: `${(debts||[]).length} pendentes`, up: false });
      this.ticker = items;
    }).catch(() => {
      this.ticker = [
        { label: '🏦 MoneyControl', value: 'Sistema Online', change: '', up: true },
        { label: '◉ Aguardando dados', value: '...', change: '', up: true },
      ];
    });
  }

  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'; }
  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
  toggleTheme() {
    this.isDark = !this.isDark;
    localStorage.setItem('mc-theme', this.isDark ? 'dark' : 'light');
    this.applyTheme();
  }
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
  }
}
