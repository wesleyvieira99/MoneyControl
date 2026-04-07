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
  private static readonly SPLASH_DURATION_MS = 2800;

  showSplash = true;
  showClosing = false;
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
    { label: 'Calendário de Parcelas',   icon: '📅', path: '/calendar',      keywords: 'calendario vencimentos parcelas datas agenda alarme whatsapp' },
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
        { path: '/goals',     label: 'Metas',       icon: '🏆' },
        { path: '/budget',    label: 'Orçamento',   icon: '💰' },
        { path: '/simulator', label: 'Simulador',   icon: '🧮' },
        { path: '/calendar',  label: 'Calendário',  icon: '📅' },
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
    setTimeout(() => { this.showSplash = false; }, AppComponent.SPLASH_DURATION_MS);
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

  generatePDF() {
    const fmt = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00';
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR');

    Promise.all([
      this.api.getAccounts().toPromise(),
      this.api.getCards().toPromise(),
      this.api.getInvestments().toPromise(),
      this.api.getDebts().toPromise(),
      this.api.getTransactions().toPromise(),
      this.api.getGoals().toPromise(),
      this.api.getDistributionRules().toPromise(),
      this.api.getDashboardSummary().toPromise(),
    ]).then(([accounts, cards, investments, debts, transactions, goals, rules, summary]: any[]) => {
      accounts = accounts || [];
      cards = cards || [];
      investments = investments || [];
      debts = debts || [];
      transactions = transactions || [];
      goals = goals || [];
      rules = rules || [];
      summary = summary || {};

      const totalBalance = accounts.reduce((s: number, a: any) => s + +a.balance, 0);
      const totalInvested = investments.reduce((s: number, i: any) => s + +i.currentValue, 0);
      const totalDebt = debts.reduce((s: number, d: any) => s + +d.remainingAmount, 0);
      const totalGoals = goals.reduce((s: number, g: any) => s + +g.targetAmount, 0);
      const totalGoalsSaved = goals.reduce((s: number, g: any) => s + +g.currentAmount, 0);
      const patrimony = totalBalance + totalInvested - totalDebt;

      const recentTx = transactions.slice(0, 30);

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>MoneyControl — Relatório Financeiro Completo</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 40px; font-size: 12px; line-height: 1.6; }
  .header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #3b82f6; }
  .header h1 { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; }
  .header p { color: #64748b; font-size: 13px; margin-top: 4px; }
  .header .date { font-size: 11px; color: #94a3b8; margin-top: 8px; }
  h2 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 28px 0 14px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
  h3 { font-size: 13px; font-weight: 700; color: #334155; margin: 16px 0 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
  .kpi .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; }
  .kpi .value { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; }
  .kpi .sub { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .kpi.blue .value { color: #3b82f6; }
  .kpi.green .value { color: #10b981; }
  .kpi.red .value { color: #ef4444; }
  .kpi.purple .value { color: #8b5cf6; }
  .kpi.gold .value { color: #f59e0b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
  th { background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:hover td { background: #f8fafc; }
  .text-green { color: #10b981; }
  .text-red { color: #ef4444; }
  .text-blue { color: #3b82f6; }
  .text-right { text-align: right; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-green { background: #ecfdf5; color: #10b981; }
  .badge-red { background: #fef2f2; color: #ef4444; }
  .badge-blue { background: #eff6ff; color: #3b82f6; }
  .badge-yellow { background: #fffbeb; color: #f59e0b; }
  .progress-bar { background: #e2e8f0; border-radius: 99px; height: 6px; overflow: hidden; margin-top: 6px; }
  .progress-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
  @page { margin: 1.5cm; }
</style>
</head>
<body>
<div class="header">
  <h1>💰 MoneyControl — Relatório Financeiro</h1>
  <p>Relatório completo e detalhado do seu patrimônio</p>
  <div class="date">Gerado em ${dateStr} às ${timeStr}</div>
</div>

<div class="kpi-grid">
  <div class="kpi blue"><div class="label">Patrimônio Líquido</div><div class="value">${fmt(patrimony)}</div><div class="sub">Saldo + Investimentos - Dívidas</div></div>
  <div class="kpi green"><div class="label">Saldo em Contas</div><div class="value">${fmt(totalBalance)}</div><div class="sub">${accounts.length} conta(s) ativa(s)</div></div>
  <div class="kpi purple"><div class="label">Total Investido</div><div class="value">${fmt(totalInvested)}</div><div class="sub">${investments.length} ativo(s)</div></div>
  <div class="kpi red"><div class="label">Dívidas Pendentes</div><div class="value">${fmt(totalDebt)}</div><div class="sub">${debts.length} dívida(s)</div></div>
</div>

<h2>🏦 Contas Bancárias</h2>
<table>
  <thead><tr><th>Conta</th><th>Tipo</th><th>Banco</th><th class="text-right">Saldo</th></tr></thead>
  <tbody>
    ${accounts.map((a: any) => '<tr><td><strong>' + a.name + '</strong></td><td>' + (a.type || '—') + '</td><td>' + (a.bank || '—') + '</td><td class="text-right ' + (+a.balance >= 0 ? 'text-green' : 'text-red') + '"><strong>' + fmt(+a.balance) + '</strong></td></tr>').join('')}
    ${accounts.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Nenhuma conta cadastrada</td></tr>' : ''}
  </tbody>
</table>

<h2>💳 Cartões de Crédito</h2>
<table>
  <thead><tr><th>Cartão</th><th>Bandeira</th><th class="text-right">Limite</th><th class="text-right">Fatura Atual</th><th>Vencimento</th></tr></thead>
  <tbody>
    ${cards.map((c: any) => '<tr><td><strong>' + c.name + '</strong></td><td>' + (c.brand || '—') + '</td><td class="text-right">' + fmt(+c.cardLimit || 0) + '</td><td class="text-right text-red">' + fmt(+c.currentBill || 0) + '</td><td>' + (c.dueDay ? 'Dia ' + c.dueDay : '—') + '</td></tr>').join('')}
    ${cards.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhum cartão cadastrado</td></tr>' : ''}
  </tbody>
</table>

<h2>📈 Investimentos</h2>
<table>
  <thead><tr><th>Ativo</th><th>Tipo</th><th class="text-right">Valor Investido</th><th class="text-right">Valor Atual</th><th class="text-right">Rendimento</th></tr></thead>
  <tbody>
    ${investments.map((i: any) => {
      const gain = +i.currentValue - +i.initialAmount;
      const pct = +i.initialAmount > 0 ? ((gain / +i.initialAmount) * 100).toFixed(2) : '0.00';
      return '<tr><td><strong>' + i.name + '</strong></td><td>' + (i.type || '—') + '</td><td class="text-right">' + fmt(+i.initialAmount) + '</td><td class="text-right">' + fmt(+i.currentValue) + '</td><td class="text-right ' + (gain >= 0 ? 'text-green' : 'text-red') + '"><strong>' + (gain >= 0 ? '+' : '') + pct + '%</strong> (' + fmt(gain) + ')</td></tr>';
    }).join('')}
    ${investments.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhum investimento cadastrado</td></tr>' : ''}
  </tbody>
</table>

<h2>📉 Dívidas e Financiamentos</h2>
<table>
  <thead><tr><th>Dívida</th><th>Credor</th><th class="text-right">Valor Original</th><th class="text-right">Saldo Restante</th><th>Progresso</th></tr></thead>
  <tbody>
    ${debts.map((d: any) => {
      const progress = +d.totalAmount > 0 ? Math.round(((+d.totalAmount - +d.remainingAmount) / +d.totalAmount) * 100) : 0;
      return '<tr><td><strong>' + d.name + '</strong></td><td>' + (d.creditor || '—') + '</td><td class="text-right">' + fmt(+d.totalAmount) + '</td><td class="text-right text-red">' + fmt(+d.remainingAmount) + '</td><td><div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%"></div></div><span style="font-size:10px;color:#64748b;">' + progress + '% pago</span></td></tr>';
    }).join('')}
    ${debts.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhuma dívida cadastrada</td></tr>' : ''}
  </tbody>
</table>

<h2>🏆 Metas Financeiras</h2>
<table>
  <thead><tr><th>Meta</th><th class="text-right">Objetivo</th><th class="text-right">Atual</th><th>Progresso</th><th>Prazo</th></tr></thead>
  <tbody>
    ${goals.map((g: any) => {
      const pct = +g.targetAmount > 0 ? Math.round((+g.currentAmount / +g.targetAmount) * 100) : 0;
      return '<tr><td><strong>' + g.name + '</strong></td><td class="text-right">' + fmt(+g.targetAmount) + '</td><td class="text-right text-blue">' + fmt(+g.currentAmount) + '</td><td><div class="progress-bar"><div class="progress-fill" style="width:' + Math.min(pct, 100) + '%"></div></div><span style="font-size:10px;color:#64748b;">' + pct + '%</span></td><td>' + (g.deadline || '—') + '</td></tr>';
    }).join('')}
    ${goals.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhuma meta cadastrada</td></tr>' : ''}
  </tbody>
</table>

<h2>🎯 Regras de Distribuição</h2>
<table>
  <thead><tr><th>Categoria</th><th class="text-right">Percentual</th><th>Descrição</th></tr></thead>
  <tbody>
    ${rules.map((r: any) => '<tr><td><strong>' + (r.category || r.name) + '</strong></td><td class="text-right text-blue">' + r.percentage + '%</td><td>' + (r.description || '—') + '</td></tr>').join('')}
    ${rules.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">Nenhuma regra cadastrada</td></tr>' : ''}
  </tbody>
</table>

<h2>💳 Últimas Transações</h2>
<table>
  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="text-right">Valor</th><th>Status</th></tr></thead>
  <tbody>
    ${recentTx.map((t: any) => {
      const isIncome = t.type === 'INCOME' || t.type === 'RECEITA';
      return '<tr><td>' + (t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—') + '</td><td>' + t.description + '</td><td>' + (t.categoryName || t.category || '—') + '</td><td class="text-right ' + (isIncome ? 'text-green' : 'text-red') + '">' + (isIncome ? '+' : '-') + fmt(Math.abs(+t.amount)) + '</td><td><span class="badge ' + (t.status === 'PAID' || t.status === 'PAGO' ? 'badge-green' : t.status === 'OVERDUE' ? 'badge-red' : 'badge-yellow') + '">' + (t.status || 'PENDENTE') + '</span></td></tr>';
    }).join('')}
    ${recentTx.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhuma transação encontrada</td></tr>' : ''}
  </tbody>
</table>

<div class="kpi-grid" style="margin-top:30px;">
  <div class="kpi gold"><div class="label">Metas</div><div class="value">${fmt(totalGoalsSaved)}</div><div class="sub">de ${fmt(totalGoals)} objetivo</div></div>
  <div class="kpi blue"><div class="label">Transações</div><div class="value">${transactions.length}</div><div class="sub">registradas no sistema</div></div>
  <div class="kpi green"><div class="label">Distribuição</div><div class="value">${rules.length}</div><div class="sub">regra(s) ativa(s)</div></div>
  <div class="kpi purple"><div class="label">Cartões</div><div class="value">${cards.length}</div><div class="sub">cadastrado(s)</div></div>
</div>

<div class="footer">
  <p><strong>MoneyControl</strong> — Financial Intelligence OS v2.0</p>
  <p>Relatório gerado automaticamente em ${dateStr} às ${timeStr}</p>
  <p>Este documento é confidencial e de uso pessoal.</p>
</div>

<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    }).catch(err => {
      console.error('Error generating PDF:', err);
      alert('Erro ao gerar relatório. Verifique a conexão com o servidor.');
    });
  }
}
