import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './core/services/api.service';
import { ToastComponent } from './core/components/toast/toast.component';

interface NavItem { path: string; label: string; icon: string; badge?: string; }
interface NavGroup { group: string; items: NavItem[]; }
interface TickerItem { label: string; value: string; change: string; up: boolean; }
interface CmdItem { label: string; icon: string; path: string; keywords: string; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule, ToastComponent],
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

  // Command Palette
  cmdOpen = false;
  cmdQuery = '';
  cmdSelected = 0;
  cmdItems: CmdItem[] = [
    { label: 'Dashboard',                icon: '📊', path: '/dashboard',     keywords: 'inicio home visao geral' },
    { label: 'Transações',               icon: '💳', path: '/transactions',  keywords: 'gastos receitas pagamentos' },
    { label: 'Contas',                   icon: '🏦', path: '/accounts',      keywords: 'banco saldo carteira' },
    { label: 'Cartões',                  icon: '💳', path: '/cards',         keywords: 'credito debito bandeira' },
    { label: 'Investimentos',            icon: '📈', path: '/investments',   keywords: 'acoes fii carteira bolsa' },
    { label: 'Dívidas',                  icon: '📉', path: '/debts',         keywords: 'emprestimo financiamento divida' },
    { label: 'Distribuição',             icon: '🎯', path: '/distribution',  keywords: 'alocacao percentual balanceamento' },
    { label: 'Metas Financeiras',        icon: '🏆', path: '/goals',         keywords: 'objetivos sonhos planejamento' },
    { label: 'Orçamento por Envelope',   icon: '💰', path: '/budget',        keywords: 'limite categoria gasto mensal' },
    { label: 'Analytics & Inteligência', icon: '🧠', path: '/analytics',     keywords: 'score analise padroes insights' },
    { label: 'Simulador Financeiro',     icon: '🧮', path: '/simulator',     keywords: 'juros compostos montecarlo calculos' },
    { label: 'Raio-X Financeiro',        icon: '🔍', path: '/raio-x',        keywords: 'diagnostico saude financeira analise' },
    { label: 'Modo Investidor',          icon: '💹', path: '/investor-mode', keywords: 'bloomberg carteira ativos profissional' },
    { label: 'Previsões ML',             icon: '🔮', path: '/forecast',      keywords: 'previsao machine learning ai' },
    { label: 'Chat IA',                  icon: '🤖', path: '/ir-chat',       keywords: 'imposto renda assistente ai chatbot' },
    { label: 'Configurações',            icon: '⚙️', path: '/settings',      keywords: 'preferencias tema ajustes' },
  ];

  get cmdFiltered(): CmdItem[] {
    const q = this.cmdQuery.toLowerCase().trim();
    if (!q) return this.cmdItems;
    return this.cmdItems.filter(i =>
      i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.path.includes(q));
  }

  navGroups: NavGroup[] = [
    {
      group: 'Principal',
      items: [
        { path: '/dashboard',    label: 'Dashboard',    icon: '📊' },
        { path: '/transactions', label: 'Transações',   icon: '💳' },
        { path: '/accounts',     label: 'Contas',       icon: '🏦' },
        { path: '/cards',        label: 'Cartões',      icon: '💳' },
      ]
    },
    {
      group: 'Patrimônio',
      items: [
        { path: '/investments',   label: 'Investimentos', icon: '📈' },
        { path: '/debts',         label: 'Dívidas',        icon: '📉' },
        { path: '/distribution',  label: 'Distribuição',   icon: '🎯' },
        { path: '/investor-mode', label: 'Modo Investidor', icon: '💹' },
      ]
    },
    {
      group: 'Planejamento',
      items: [
        { path: '/goals',    label: 'Metas',     icon: '🏆' },
        { path: '/budget',   label: 'Orçamento', icon: '💰' },
        { path: '/simulator', label: 'Simulador', icon: '🧮' },
      ]
    },
    {
      group: 'Inteligência',
      items: [
        { path: '/analytics', label: 'Analytics',  icon: '🧠' },
        { path: '/raio-x',    label: 'Raio-X',     icon: '🔍' },
        { path: '/forecast',  label: 'Previsões',  icon: '🔮' },
        { path: '/ir-chat',   label: 'Chat IA',    icon: '🤖' },
        { path: '/settings',  label: 'Config',     icon: '⚙️' },
      ]
    },
  ];

  constructor(private api: ApiService, private router: Router) {}

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); this.openCmd(); return; }
    if (!this.cmdOpen) return;
    if (e.key === 'Escape') { this.closeCmd(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.cmdSelected = Math.min(this.cmdSelected + 1, this.cmdFiltered.length - 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.cmdSelected = Math.max(this.cmdSelected - 1, 0); return; }
    if (e.key === 'Enter') { e.preventDefault(); this.navigateCmd(this.cmdFiltered[this.cmdSelected]); }
  }

  openCmd() { this.cmdOpen = true; this.cmdQuery = ''; this.cmdSelected = 0; }
  closeCmd() { this.cmdOpen = false; }
  navigateCmd(item?: CmdItem) {
    if (!item) return;
    this.router.navigateByUrl(item.path);
    this.closeCmd();
  }
  onCmdInput() { this.cmdSelected = 0; }

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
