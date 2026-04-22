import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './core/services/api.service';
import { ToastComponent } from './core/components/toast/toast.component';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/services/toast.service';

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
  private static readonly ANIMATION_DURATION_MS = 420;

  showSplash = true;
  showClosing = false;
  sidebarOpen = true;
  isDark = true;
  currentTime = '';
  currentDate = '';
  private timer: any;
  private tickerTimer: any;
  ticker: TickerItem[] = [];

  // JSON Export/Import
  showImportModal = false;
  importLoading = false;
  importSuccess = false;
  importError = '';
  savingPosition = false;

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
    { label: 'Ajuda & Guia',              icon: '📖', path: '/help',          keywords: 'ajuda guia tutorial como funciona help' },
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
        { path: '/help',      label: 'Ajuda',      icon: '📖' },
      ]
    },
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

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
      firstValueFrom(this.api.getAccounts().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getInvestments().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getDebts().pipe(catchError(() => of([])))),
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

  logout() {
    this.showClosing = true;
    setTimeout(() => {
      this.auth.logout();
      this.cmdOpen = false;
      this.showImportModal = false;
      this.showClosing = false;
      this.toast.info('Logout realizado', 'Sessão encerrada com segurança.');
      this.router.navigateByUrl('/login');
    }, AppComponent.ANIMATION_DURATION_MS);
  }

  // ── JSON EXPORT ─────────────────────────────────────────────────────────
  exportJSON() {
    this.api.exportData().subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `moneycontrol-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => alert('Erro ao exportar dados. Verifique a conexão com o servidor.')
    });
  }

  saveCurrentPosition() {
    if (this.savingPosition) return;
    this.savingPosition = true;
    this.toast.info('Salvando posição...', 'Criando backup em history e enviando para o GitHub.');

    this.api.saveCurrentPosition().subscribe({
      next: (result: any) => {
        this.savingPosition = false;
        const backupFile = result?.backupFile || 'history/moneycontrol-backup-*.json';
        this.toast.success('Posição salva com sucesso', `Backup criado em ${backupFile} e push para main concluído.`);
      },
      error: (err: any) => {
        this.savingPosition = false;
        const msg = err?.error?.error || err?.error?.output || err?.message || 'Falha ao salvar posição.';
        this.toast.error('Erro ao salvar posição', msg);
      }
    });
  }

  openImportModal() {
    this.showImportModal = true;
    this.importSuccess = false;
    this.importError = '';
    this.importLoading = false;
  }
  closeImportModal() { this.showImportModal = false; }

  onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      this.importError = 'Selecione um arquivo .json válido.';
      return;
    }
    this.importLoading = true;
    this.importError = '';
    this.api.importData(file).subscribe({
      next: () => {
        this.importLoading = false;
        this.importSuccess = true;
        setTimeout(() => { this.showImportModal = false; window.location.reload(); }, 1800);
      },
      error: (err: any) => {
        this.importLoading = false;
        this.importError = 'Erro ao importar: ' + (err?.error?.message || err?.message || 'verifique o arquivo.');
      }
    });
  }

  generatePDF() {
    this.toast.info('Gerando PDF...', 'Buscando análise da IA. Aguarde...');
    const fmt = (v: number) => {
      const n = Number(v);
      if (isNaN(n)) return 'R$ 0,00';
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const fmtPct = (v: number) => {
      const n = Number(v);
      return (isNaN(n) ? 0 : n).toFixed(1) + '%';
    };
    const safeStr = (v: any) => v != null ? String(v) : '—';
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR');
    const monthStr = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const pdfStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const pdfEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    Promise.all([
      firstValueFrom(this.api.getAccounts().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getCards().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getInvestments().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getDebts().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getTransactions({ start: pdfStart, end: pdfEnd }).pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getGoals().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getDistributionRules().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getDashboardSummary().pipe(catchError(() => of({})))),
      firstValueFrom(this.api.getBalanceHistory(12).pipe(catchError(() => of([])))),
      firstValueFrom(this.api.getCategoryBreakdown().pipe(catchError(() => of([])))),
      firstValueFrom(this.api.aiPdfAnalysis().pipe(catchError(() => of({ analysis: null })))),
    ]).then(([accounts, cards, investments, debts, transactions, goals, rules, summary, history, catBreakdown, aiResult]: any[]) => {
      accounts     = accounts     || [];
      cards        = cards        || [];
      investments  = investments  || [];
      debts        = debts        || [];
      transactions = transactions || [];
      goals        = goals        || [];
      rules        = rules        || [];
      summary      = summary      || {};
      history      = history      || [];
      catBreakdown = catBreakdown || [];
      const aiAnalysis = aiResult?.analysis || null;

      const totalBalance   = accounts.reduce((s: number, a: any) => s + (+a.balance || 0), 0);
      const totalInvested  = investments.reduce((s: number, i: any) => s + (+i.currentValue || 0), 0);
      const totalInitial   = investments.reduce((s: number, i: any) => s + (+i.initialAmount || 0), 0);
      const totalGain      = totalInvested - totalInitial;
      const gainPct        = totalInitial > 0 ? (totalGain / totalInitial) * 100 : 0;
      const totalDebt      = debts.reduce((s: number, d: any) => s + (+d.remainingAmount || 0), 0);
      const totalGoals     = goals.reduce((s: number, g: any) => s + (+g.targetAmount || 0), 0);
      const totalGoalsSaved= goals.reduce((s: number, g: any) => s + (+g.currentAmount || 0), 0);
      const patrimony      = totalBalance + totalInvested - totalDebt;
      const monthlyIncome  = +summary.monthlyIncome  || 0;
      const monthlyExpense = +summary.monthlyExpense || 0;
      const netMonth       = monthlyIncome - monthlyExpense;
      const savingsRate    = monthlyIncome > 0 ? (netMonth / monthlyIncome) * 100 : 0;

      const totalCardLimit = cards.reduce((s: number, c: any) => s + +(c.creditLimit || 0), 0);
      const totalCardBill  = cards.reduce((s: number, c: any) => s + +(c.usedLimit || 0), 0);

      const recentTx   = [...transactions].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 40);
      const incTx      = recentTx.filter((t: any) => t.type === 'INCOME' || t.type === 'RECEITA');
      const expTx      = recentTx.filter((t: any) => t.type !== 'INCOME' && t.type !== 'RECEITA');
      const overdueTx  = recentTx.filter((t: any) => t.status === 'OVERDUE' || t.status === 'ATRASADA');
      const catTotal   = catBreakdown.reduce((s: number, c: any) => s + (+c.amount || 0), 0);
      const topCats    = [...catBreakdown].sort((a: any, b: any) => (+b.amount || 0) - (+a.amount || 0)).slice(0, 8);

      const avgIncome  = history.length ? history.reduce((s: number, h: any) => s + (+h.income || 0),  0) / history.length : monthlyIncome;
      const avgExpense = history.length ? history.reduce((s: number, h: any) => s + (+h.expense || 0), 0) / history.length : monthlyExpense;

      const perennialDebts    = debts.filter((d: any) => d.perennial);
      const installmentDebts  = debts.filter((d: any) => !d.perennial);
      const overdueDebts      = debts.filter((d: any) => d.status === 'OVERDUE');
      const paidDebts         = debts.filter((d: any) => d.status === 'PAID');

      const debtScore = patrimony > 0 ? Math.max(0, Math.min(100, 100 - (totalDebt / Math.max(patrimony, 1)) * 100)) : 50;
      const savScore  = Math.max(0, Math.min(100, savingsRate * 2));
      const invScore  = patrimony > 0 ? Math.min(100, (totalInvested / Math.max(patrimony, 1)) * 100) : 0;
      const overallScore = Math.round((debtScore * 0.35 + savScore * 0.40 + invScore * 0.25));

      const scoreColor = overallScore >= 70 ? '#10b981' : overallScore >= 40 ? '#f59e0b' : '#ef4444';
      const scoreLabel = overallScore >= 70 ? 'Saudável' : overallScore >= 40 ? 'Atenção' : 'Crítico';
      const debtIncomePercentage = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 0;
      const monthsOfEmergencyCoverage = monthlyExpense > 0 ? (Math.max(totalBalance, 0) / monthlyExpense) : 0;
      const investmentsShare = patrimony > 0 ? (totalInvested / patrimony) * 100 : 0;
      const goalProgressPercentage = goals.length > 0 ? (totalGoalsSaved / Math.max(totalGoals, 1)) * 100 : 0;
      const totalPerennialMonthly = perennialDebts.reduce((s: number, d: any) => s + (+d.remainingAmount || 0), 0);
      const totalInstallmentDebt = installmentDebts.reduce((s: number, d: any) => s + (+d.remainingAmount || 0), 0);

      // Build AI OpenAI section HTML
      const buildAiSection = () => {
        if (!aiAnalysis) return '';
        const situacao = aiAnalysis.situacaoAtual || '';
        const pontosFortes: string[] = aiAnalysis.pontosFortes || [];
        const pontosAtencao: string[] = aiAnalysis.pontosAtencao || [];
        const dicasCurto: string[] = aiAnalysis.dicasCurto || [];
        const dicasMedio: string[] = aiAnalysis.dicasMedio || [];
        const dicasLongo: string[] = aiAnalysis.dicasLongo || [];
        const previsao = aiAnalysis.previsaoFuturo || '';
        const nota = aiAnalysis.notaConsultor || '';
        return `
<div class="section page-break">
  <div class="section-title"><span class="s-icon">🧠</span> Análise do Consultor IA — OpenAI GPT-4o</div>
  <div class="ai-openai-panel">
    <div class="ai-openai-badge-row">
      <span class="ai-openai-badge">🤖 Powered by OpenAI</span>
      <span class="ai-openai-badge ai-openai-badge-date">📅 ${dateStr}</span>
    </div>

    <!-- Situação Atual -->
    <div class="ai-openai-block">
      <div class="ai-openai-block-title">📊 Diagnóstico da Situação Atual</div>
      <p class="ai-openai-text">${situacao}</p>
    </div>

    <!-- Pontos Fortes & Atenção -->
    <div class="ai-openai-two-col">
      <div class="ai-openai-col ai-openai-col-green">
        <div class="ai-openai-col-title">✅ Pontos Fortes</div>
        <ul class="ai-openai-ul">${pontosFortes.map((p: string) => '<li>' + p + '</li>').join('')}</ul>
      </div>
      <div class="ai-openai-col ai-openai-col-red">
        <div class="ai-openai-col-title">⚠️ Pontos de Atenção</div>
        <ul class="ai-openai-ul">${pontosAtencao.map((p: string) => '<li>' + p + '</li>').join('')}</ul>
      </div>
    </div>

    <!-- Dicas por prazo -->
    <div class="ai-openai-block">
      <div class="ai-openai-block-title">🎯 Plano de Ação Personalizado</div>
      <div class="ai-openai-tips-grid">
        <div class="ai-openai-tip-card ai-tip-short">
          <div class="ai-tip-header">🚀 Curto Prazo <span class="ai-tip-badge">30 dias</span></div>
          <ul class="ai-openai-ul">${dicasCurto.map((d: string) => '<li>' + d + '</li>').join('')}</ul>
        </div>
        <div class="ai-openai-tip-card ai-tip-medium">
          <div class="ai-tip-header">📈 Médio Prazo <span class="ai-tip-badge">3-6 meses</span></div>
          <ul class="ai-openai-ul">${dicasMedio.map((d: string) => '<li>' + d + '</li>').join('')}</ul>
        </div>
        <div class="ai-openai-tip-card ai-tip-long">
          <div class="ai-tip-header">🏆 Longo Prazo <span class="ai-tip-badge">1-5 anos</span></div>
          <ul class="ai-openai-ul">${dicasLongo.map((d: string) => '<li>' + d + '</li>').join('')}</ul>
        </div>
      </div>
    </div>

    <!-- Previsão Futuro -->
    <div class="ai-openai-block ai-openai-forecast">
      <div class="ai-openai-block-title">🔮 Previsão & Projeção Futura</div>
      <p class="ai-openai-text">${previsao}</p>
    </div>

    <!-- Nota do Consultor -->
    <div class="ai-openai-note">
      <div class="ai-openai-note-icon">💬</div>
      <div>
        <div class="ai-openai-note-title">Nota do Consultor IA</div>
        <p class="ai-openai-note-text">${nota}</p>
      </div>
    </div>
  </div>
</div>`;
      };

      const html = this.buildPdfHtml({
        fmt, fmtPct, safeStr, dateStr, timeStr, monthStr,
        overallScore, scoreColor, scoreLabel,
        patrimony, totalBalance, accounts, totalInvested, investments,
        gainPct, totalGain, totalDebt, debts, overdueDebts, paidDebts,
        monthlyIncome, monthlyExpense, netMonth, savingsRate, avgIncome, avgExpense,
        totalCardLimit, totalCardBill, cards,
        savScore, debtScore, invScore,
        totalGoals, totalGoalsSaved, goals, goalProgressPercentage,
        incTx, expTx, overdueTx, recentTx,
        catTotal, topCats, catBreakdown,
        perennialDebts, installmentDebts, totalInitial,
        rules, history, transactions,
        totalPerennialMonthly, totalInstallmentDebt,
        debtIncomePercentage, monthsOfEmergencyCoverage, investmentsShare,
        aiSectionHtml: buildAiSection(),
      });

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
      this.toast.success('PDF gerado!', 'O relatório foi aberto em uma nova aba.');
    }).catch(err => {
      console.error('Error generating PDF:', err?.message || 'Unknown error');
      this.toast.error('Erro ao gerar PDF', 'Verifique a conexão com o servidor e tente novamente.');
    });
  }

  private buildPdfHtml(d: any): string {
    const { fmt, fmtPct, safeStr, dateStr, timeStr, monthStr,
      overallScore, scoreColor, scoreLabel,
      patrimony, totalBalance, accounts, totalInvested, investments,
      gainPct, totalGain, totalDebt, debts, overdueDebts, paidDebts,
      monthlyIncome, monthlyExpense, netMonth, savingsRate, avgIncome, avgExpense,
      totalCardLimit, totalCardBill, cards,
      savScore, debtScore, invScore,
      totalGoals, totalGoalsSaved, goals, goalProgressPercentage,
      incTx, expTx, overdueTx, recentTx,
      catTotal, topCats,
      perennialDebts, installmentDebts, totalInitial,
      rules, history, transactions,
      totalPerennialMonthly, totalInstallmentDebt,
      debtIncomePercentage, monthsOfEmergencyCoverage, investmentsShare,
      aiSectionHtml } = d;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>MoneyControl — Relatório Financeiro Premium</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;color:#1e293b;background:#f8fafc;font-size:12px;line-height:1.6}
  .page-wrap{max-width:1100px;margin:0 auto;padding:36px 32px}

  /* ── COVER ── */
  .cover{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 40%,#312e81 70%,#0f172a 100%);color:#fff;padding:56px 48px 48px;border-radius:24px;margin-bottom:32px;position:relative;overflow:hidden;page-break-after:always}
  .cover::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 70% 30%,rgba(139,92,246,0.3) 0%,transparent 60%)}
  .cover::after{content:'';position:absolute;bottom:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,0.15) 0%,transparent 70%)}
  .cover-logo{font-size:48px;margin-bottom:12px;position:relative}
  .cover-title{font-size:38px;font-weight:900;letter-spacing:-0.04em;line-height:1.1;position:relative}
  .cover-title span{background:linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .cover-sub{font-size:14px;color:#94a3b8;margin-top:10px;position:relative}
  .cover-stats{display:flex;gap:16px;margin-top:20px;position:relative}
  .cover-stat{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;min-width:120px}
  .cover-stat-val{font-size:16px;font-weight:900;color:#fff}
  .cover-stat-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px}
  .cover-date{margin-top:24px;font-size:11px;color:#64748b;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;position:relative;display:flex;gap:20px;align-items:center;flex-wrap:wrap}
  .cover-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);padding:4px 14px;border-radius:99px;font-size:10px;color:#c4b5fd;font-weight:700;letter-spacing:0.06em}
  .cover-score{position:absolute;right:48px;top:56px;text-align:center}
  .score-circle{width:110px;height:110px;border-radius:50%;background:conic-gradient(${scoreColor} 0% ${overallScore}%,rgba(255,255,255,0.08) ${overallScore}% 100%);display:flex;align-items:center;justify-content:center;margin:0 auto;box-shadow:0 0 30px rgba(139,92,246,0.2)}
  .score-inner{width:82px;height:82px;border-radius:50%;background:rgba(15,23,42,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center}
  .score-val{font-size:24px;font-weight:900;color:${scoreColor};line-height:1}
  .score-lbl{font-size:9px;color:#94a3b8;margin-top:2px;font-weight:700;letter-spacing:0.05em}
  .score-title{font-size:10px;color:#64748b;margin-top:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em}

  /* ── SECTIONS ── */
  .section{background:#fff;border-radius:16px;padding:24px 28px;margin-bottom:20px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
  .section-title{font-size:15px;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:2px solid #f1f5f9}
  .section-title .s-icon{font-size:18px}

  /* ── KPI GRID ── */
  .kpi-grid{display:grid;gap:12px;margin-bottom:0}
  .kpi-4{grid-template-columns:repeat(4,1fr)}
  .kpi-3{grid-template-columns:repeat(3,1fr)}
  .kpi-2{grid-template-columns:repeat(2,1fr)}
  .kpi{border-radius:12px;padding:16px 18px;position:relative;overflow:hidden}
  .kpi::before{content:'';position:absolute;inset:0;opacity:0.06;border-radius:12px}
  .kpi.blue{background:#eff6ff;border:1px solid #bfdbfe}.kpi.blue .kpi-val{color:#2563eb}.kpi.blue::before{background:#2563eb}
  .kpi.green{background:#f0fdf4;border:1px solid #bbf7d0}.kpi.green .kpi-val{color:#16a34a}.kpi.green::before{background:#16a34a}
  .kpi.red{background:#fef2f2;border:1px solid #fecaca}.kpi.red .kpi-val{color:#dc2626}.kpi.red::before{background:#dc2626}
  .kpi.purple{background:#faf5ff;border:1px solid #e9d5ff}.kpi.purple .kpi-val{color:#7c3aed}.kpi.purple::before{background:#7c3aed}
  .kpi.gold{background:#fffbeb;border:1px solid #fde68a}.kpi.gold .kpi-val{color:#d97706}.kpi.gold::before{background:#d97706}
  .kpi.teal{background:#f0fdfa;border:1px solid #99f6e4}.kpi.teal .kpi-val{color:#0d9488}.kpi.teal::before{background:#0d9488}
  .kpi-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:6px}
  .kpi-val{font-size:20px;font-weight:900;letter-spacing:-0.03em;line-height:1.1}
  .kpi-sub{font-size:10px;color:#94a3b8;margin-top:4px}
  .kpi-trend{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px}
  .trend-up{background:#dcfce7;color:#16a34a}.trend-down{background:#fee2e2;color:#dc2626}

  /* ── BALANCETE ── */
  .balancete{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
  .bal-col{padding:16px 20px}
  .bal-col.income-col{background:#f0fdf4;border-right:1px solid #e2e8f0}
  .bal-col.expense-col{background:#fef2f2}
  .bal-col-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:12px}
  .bal-item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);font-size:11px}
  .bal-item:last-child{border-bottom:none}
  .bal-item-name{color:#475569;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bal-item-val.income-val{color:#16a34a;font-weight:700}
  .bal-item-val.expense-val{color:#dc2626;font-weight:700}
  .bal-total{display:flex;justify-content:space-between;font-weight:900;font-size:13px;margin-top:10px;padding-top:10px;border-top:2px solid}
  .bal-total.inc-total{border-color:#16a34a;color:#16a34a}
  .bal-total.exp-total{border-color:#dc2626;color:#dc2626}
  .net-row{background:linear-gradient(135deg,#0f172a,#1e1b4b);color:#fff;padding:14px 20px;border-radius:0 0 12px 12px;display:flex;justify-content:space-between;align-items:center;margin-top:0}
  .net-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8}
  .net-value{font-size:18px;font-weight:900}
  .net-positive{color:#34d399}.net-negative{color:#f87171}

  /* ── PILLAR BARS ── */
  .pillar-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .pillar{padding:14px 18px;border-radius:12px;border:1px solid #e2e8f0;background:#fff}
  .pillar-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .pillar-name{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#64748b}
  .pillar-score{font-size:13px;font-weight:900}
  .pillar-bar{background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden}
  .pillar-fill{height:100%;border-radius:99px}
  .pillar-meta{font-size:10px;color:#94a3b8;margin-top:6px}

  /* ── TABLES ── */
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f8fafc;color:#475569;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#fafbff}
  .text-green{color:#16a34a;font-weight:700}.text-red{color:#dc2626;font-weight:700}.text-blue{color:#2563eb;font-weight:700}.text-purple{color:#7c3aed;font-weight:700}.text-gold{color:#d97706;font-weight:700}
  .text-right{text-align:right}.text-center{text-align:center}
  .fw-bold{font-weight:700}.fw-900{font-weight:900}

  /* ── BADGES ── */
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap}
  .badge-green{background:#dcfce7;color:#16a34a}.badge-red{background:#fee2e2;color:#dc2626}
  .badge-blue{background:#dbeafe;color:#2563eb}.badge-yellow{background:#fef9c3;color:#d97706}
  .badge-purple{background:#ede9fe;color:#7c3aed}.badge-gray{background:#f1f5f9;color:#64748b}

  /* ── PROGRESS ── */
  .prog-bar{background:#e2e8f0;border-radius:99px;height:6px;overflow:hidden}
  .prog-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6366f1,#8b5cf6)}
  .prog-fill.green{background:linear-gradient(90deg,#10b981,#059669)}
  .prog-fill.red{background:linear-gradient(90deg,#ef4444,#dc2626)}

  /* ── HIGHLIGHT CARDS ── */
  .highlight-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}
  .highlight-card{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px}
  .hl-icon{font-size:22px;margin-bottom:6px}
  .hl-val{font-size:16px;font-weight:900;color:#0f172a}
  .hl-lbl{font-size:10px;color:#64748b;font-weight:600;margin-top:2px}

  /* ── CATEGORY ROW ── */
  .cat-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f1f5f9}
  .cat-row:last-child{border-bottom:none}
  .cat-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .cat-name{flex:1;font-size:11px;color:#334155;font-weight:600}
  .cat-bar-wrap{width:120px;background:#f1f5f9;border-radius:99px;height:6px;overflow:hidden}
  .cat-bar-fill{height:100%;border-radius:99px}
  .cat-pct{width:36px;text-align:right;font-size:10px;color:#64748b;font-weight:700}
  .cat-amt{width:80px;text-align:right;font-size:11px;font-weight:700;color:#dc2626}

  /* ── FOOTER ── */
  .footer{text-align:center;margin-top:32px;padding:20px;border-top:2px solid #e2e8f0;font-size:10px;color:#94a3b8}
  .footer strong{color:#64748b}
  .divider{height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);margin:20px 0}
  .page-break{page-break-before:always}

  /* ── IR SECTION ── */
  .ir-section{background:linear-gradient(135deg,#fefce8,#fffbeb);border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin-bottom:16px}
  .ir-title{font-size:13px;font-weight:800;color:#92400e;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .ir-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .ir-item{background:#fff;border-radius:8px;padding:12px;border:1px solid #fde68a}
  .ir-item-lbl{font-size:9px;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:0.07em;margin-bottom:4px}
  .ir-item-val{font-size:14px;font-weight:900;color:#0f172a}

  /* ── AI SUGGESTIONS ── */
  .ai-panel{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe;border-radius:14px;padding:18px 20px}
  .ai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
  .ai-title{font-size:13px;font-weight:900;color:#3730a3;display:flex;align-items:center;gap:8px}
  .ai-badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;background:#4338ca;color:#e0e7ff;border-radius:999px;padding:3px 8px}
  .ai-sub{font-size:11px;color:#6366f1;margin-bottom:10px}
  .ai-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .ai-item{background:#fff;border:1px solid #ddd6fe;border-radius:10px;padding:10px 12px;font-size:11px;color:#312e81}
  .ai-prio{font-size:9px;font-weight:900;color:#4c1d95;background:#ede9fe;border-radius:999px;padding:2px 7px;margin-right:8px}

  /* ── AI OPENAI PANEL ── */
  .ai-openai-panel{border-radius:16px;overflow:hidden}
  .ai-openai-badge-row{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
  .ai-openai-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border-radius:99px;padding:5px 14px;font-size:10px;font-weight:800;letter-spacing:0.05em}
  .ai-openai-badge-date{background:linear-gradient(135deg,#0f172a,#1e293b)}
  .ai-openai-block{background:#fff;border:1px solid #e0e7ff;border-radius:14px;padding:18px 20px;margin-bottom:14px}
  .ai-openai-block-title{font-size:13px;font-weight:800;color:#312e81;margin-bottom:10px;display:flex;align-items:center;gap:8px}
  .ai-openai-text{font-size:12px;color:#334155;line-height:1.8}
  .ai-openai-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .ai-openai-col{border-radius:14px;padding:16px 18px}
  .ai-openai-col-green{background:#f0fdf4;border:1px solid #bbf7d0}
  .ai-openai-col-red{background:#fff7ed;border:1px solid #fed7aa}
  .ai-openai-col-title{font-size:12px;font-weight:800;color:#334155;margin-bottom:10px}
  .ai-openai-ul{list-style:none;padding:0;margin:0}
  .ai-openai-ul li{font-size:11px;color:#475569;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.04);line-height:1.6}
  .ai-openai-ul li:last-child{border-bottom:none}
  .ai-openai-ul li::before{content:'▸ ';color:#6366f1;font-weight:700}
  .ai-openai-tips-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .ai-openai-tip-card{border-radius:12px;padding:14px 16px}
  .ai-tip-short{background:#eff6ff;border:1px solid #bfdbfe}
  .ai-tip-medium{background:#faf5ff;border:1px solid #e9d5ff}
  .ai-tip-long{background:#f0fdf4;border:1px solid #bbf7d0}
  .ai-tip-header{font-size:11px;font-weight:800;color:#334155;margin-bottom:8px;display:flex;align-items:center;gap:6px}
  .ai-tip-badge{font-size:8px;font-weight:800;background:rgba(0,0,0,0.06);color:#64748b;border-radius:99px;padding:2px 8px}
  .ai-openai-forecast{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe}
  .ai-openai-note{display:flex;gap:14px;background:linear-gradient(135deg,#0f172a,#1e1b4b);border-radius:14px;padding:18px 20px;margin-top:14px;color:#fff}
  .ai-openai-note-icon{font-size:28px;flex-shrink:0}
  .ai-openai-note-title{font-size:12px;font-weight:800;color:#c4b5fd;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em}
  .ai-openai-note-text{font-size:12px;color:#cbd5e1;line-height:1.8}

  @media print{body{background:#fff}.page-wrap{padding:16px 12px}.cover{border-radius:0}.no-print{display:none}}
  @page{margin:1cm;size:A4}
</style>
</head>
<body>
<div class="page-wrap">

<!-- ══ COVER PAGE ══════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-score">
    <div class="score-circle">
      <div class="score-inner">
        <div class="score-val">${overallScore}</div>
        <div class="score-lbl">${scoreLabel}</div>
      </div>
    </div>
    <div class="score-title">Score Financeiro</div>
  </div>
  <div class="cover-logo">💰</div>
  <div class="cover-title">MoneyControl<br><span>Relatório Financeiro</span></div>
  <div class="cover-sub">Financial Intelligence OS — Relatório Premium Completo</div>
  <div class="cover-stats">
    <div class="cover-stat"><div class="cover-stat-val">${fmt(patrimony)}</div><div class="cover-stat-lbl">Patrimônio Líquido</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${fmt(totalInvested)}</div><div class="cover-stat-lbl">Investido</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${fmt(totalBalance)}</div><div class="cover-stat-lbl">Saldo em Contas</div></div>
    <div class="cover-stat"><div class="cover-stat-val" style="color:${totalDebt > 0 ? '#f87171' : '#34d399'}">${fmt(totalDebt)}</div><div class="cover-stat-lbl">Dívidas</div></div>
  </div>
  <div class="cover-date">
    <div class="cover-badge">📅 ${dateStr}</div>
    <div class="cover-badge">🕐 ${timeStr}</div>
    <div class="cover-badge">📊 ${monthStr}</div>
    <div class="cover-badge">🏦 ${accounts.length} contas · ${investments.length} investimentos · ${debts.length} dívidas</div>
  </div>
</div>

<!-- ══ PATRIMÔNIO GERAL ════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">🏛️</span> Visão Patrimonial Consolidada</div>
  <div class="kpi-grid kpi-4" style="margin-bottom:16px">
    <div class="kpi blue">
      <div class="kpi-lbl">Patrimônio Líquido</div>
      <div class="kpi-val">${fmt(patrimony)}</div>
      <div class="kpi-sub">Ativos − Passivos</div>
      <span class="kpi-trend ${patrimony >= 0 ? 'trend-up' : 'trend-down'}">${patrimony >= 0 ? '▲ Positivo' : '▼ Negativo'}</span>
    </div>
    <div class="kpi green">
      <div class="kpi-lbl">Saldo em Contas</div>
      <div class="kpi-val">${fmt(totalBalance)}</div>
      <div class="kpi-sub">${accounts.length} conta(s) ativa(s)</div>
    </div>
    <div class="kpi purple">
      <div class="kpi-lbl">Total Investido</div>
      <div class="kpi-val">${fmt(totalInvested)}</div>
      <div class="kpi-sub">${investments.length} ativo(s) · ${gainPct >= 0 ? '+' : ''}${fmtPct(gainPct)} rendimento</div>
      <span class="kpi-trend ${gainPct >= 0 ? 'trend-up' : 'trend-down'}">${fmt(totalGain)}</span>
    </div>
    <div class="kpi red">
      <div class="kpi-lbl">Dívidas Pendentes</div>
      <div class="kpi-val">${fmt(totalDebt)}</div>
      <div class="kpi-sub">${debts.length} dívida(s) · ${overdueDebts.length} atrasada(s)</div>
    </div>
  </div>
  <div class="kpi-grid kpi-4">
    <div class="kpi teal">
      <div class="kpi-lbl">Receita do Mês</div>
      <div class="kpi-val">${fmt(monthlyIncome)}</div>
      <div class="kpi-sub">Média 12m: ${fmt(avgIncome)}</div>
    </div>
    <div class="kpi gold">
      <div class="kpi-lbl">Despesas do Mês</div>
      <div class="kpi-val">${fmt(monthlyExpense)}</div>
      <div class="kpi-sub">Média 12m: ${fmt(avgExpense)}</div>
    </div>
    <div class="kpi ${netMonth >= 0 ? 'green' : 'red'}">
      <div class="kpi-lbl">Saldo Líquido</div>
      <div class="kpi-val">${fmt(netMonth)}</div>
      <div class="kpi-sub">Taxa de poupança: ${fmtPct(savingsRate)}</div>
      <span class="kpi-trend ${savingsRate >= 20 ? 'trend-up' : savingsRate >= 10 ? '' : 'trend-down'}">${fmtPct(savingsRate)} poupança</span>
    </div>
    <div class="kpi blue">
      <div class="kpi-lbl">Cartões — Fatura</div>
      <div class="kpi-val">${fmt(totalCardBill)}</div>
      <div class="kpi-sub">${cards.length} cartão(ões) · Limite: ${fmt(totalCardLimit)}</div>
    </div>
  </div>
</div>

<!-- ══ INDICADORES ESTRATÉGICOS ═══════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">📐</span> Indicadores Estratégicos</div>
  <div class="kpi-grid kpi-4">
    <div class="kpi ${monthsOfEmergencyCoverage >= 6 ? 'green' : monthsOfEmergencyCoverage >= 3 ? 'gold' : 'red'}">
      <div class="kpi-lbl">Reserva de Emergência</div>
      <div class="kpi-val">${monthsOfEmergencyCoverage.toFixed(1)} meses</div>
      <div class="kpi-sub">Meta: 6 meses de despesas</div>
    </div>
    <div class="kpi ${debtIncomePercentage <= 30 ? 'green' : debtIncomePercentage <= 50 ? 'gold' : 'red'}">
      <div class="kpi-lbl">Dívida / Renda</div>
      <div class="kpi-val">${fmtPct(debtIncomePercentage)}</div>
      <div class="kpi-sub">Meta: abaixo de 30%</div>
    </div>
    <div class="kpi ${investmentsShare >= 50 ? 'green' : investmentsShare >= 20 ? 'blue' : 'gold'}">
      <div class="kpi-lbl">Investimentos / Patrimônio</div>
      <div class="kpi-val">${fmtPct(investmentsShare)}</div>
      <div class="kpi-sub">Participação dos investimentos</div>
    </div>
    <div class="kpi ${goalProgressPercentage >= 70 ? 'green' : goalProgressPercentage >= 30 ? 'blue' : 'gold'}">
      <div class="kpi-lbl">Progresso das Metas</div>
      <div class="kpi-val">${fmtPct(goalProgressPercentage)}</div>
      <div class="kpi-sub">${goals.length} meta(s) cadastrada(s)</div>
    </div>
  </div>
</div>

<!-- ══ PILARES FINANCEIROS ════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">🎯</span> Saúde Financeira por Pilar</div>
  <div class="pillar-grid">
    <div class="pillar">
      <div class="pillar-header">
        <div class="pillar-name">💰 Poupança</div>
        <div class="pillar-score" style="color:${savingsRate >= 20 ? '#16a34a' : savingsRate >= 10 ? '#d97706' : '#dc2626'}">${Math.round(savScore)}/100</div>
      </div>
      <div class="pillar-bar"><div class="pillar-fill" style="width:${Math.min(savScore, 100)}%;background:${savingsRate >= 20 ? '#10b981' : savingsRate >= 10 ? '#f59e0b' : '#ef4444'}"></div></div>
      <div class="pillar-meta">Taxa ${fmtPct(savingsRate)} · ${savingsRate >= 20 ? '✅ Excelente (meta ≥ 20%)' : savingsRate >= 10 ? '⚠️ Moderado (meta ≥ 20%)' : '❌ Insuficiente'}</div>
    </div>
    <div class="pillar">
      <div class="pillar-header">
        <div class="pillar-name">📉 Endividamento</div>
        <div class="pillar-score" style="color:${debtScore >= 70 ? '#16a34a' : debtScore >= 40 ? '#d97706' : '#dc2626'}">${Math.round(debtScore)}/100</div>
      </div>
      <div class="pillar-bar"><div class="pillar-fill" style="width:${Math.min(debtScore, 100)}%;background:${debtScore >= 70 ? '#10b981' : debtScore >= 40 ? '#f59e0b' : '#ef4444'}"></div></div>
      <div class="pillar-meta">Dívidas: ${fmt(totalDebt)} · ${paidDebts.length} quitada(s) · ${overdueDebts.length} atrasada(s)</div>
    </div>
    <div class="pillar">
      <div class="pillar-header">
        <div class="pillar-name">📈 Investimentos</div>
        <div class="pillar-score" style="color:${invScore >= 70 ? '#16a34a' : invScore >= 40 ? '#d97706' : '#dc2626'}">${Math.round(invScore)}/100</div>
      </div>
      <div class="pillar-bar"><div class="pillar-fill" style="width:${Math.min(invScore, 100)}%;background:${invScore >= 70 ? '#10b981' : invScore >= 40 ? '#f59e0b' : '#ef4444'}"></div></div>
      <div class="pillar-meta">Total: ${fmt(totalInvested)} · Rendimento: ${gainPct >= 0 ? '+' : ''}${fmtPct(gainPct)}</div>
    </div>
    <div class="pillar">
      <div class="pillar-header">
        <div class="pillar-name">🏆 Metas</div>
        <div class="pillar-score" style="color:#7c3aed">${goals.length > 0 ? Math.round(goalProgressPercentage) : 0}/100</div>
      </div>
      <div class="pillar-bar"><div class="pillar-fill" style="width:${goals.length > 0 ? Math.min(goalProgressPercentage, 100) : 0}%;background:#8b5cf6"></div></div>
      <div class="pillar-meta">${fmt(totalGoalsSaved)} de ${fmt(totalGoals)} · ${goals.length} meta(s)</div>
    </div>
  </div>
</div>

<!-- ══ BALANCETE DO MÊS ═══════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">⚖️</span> Balancete Mensal — ${monthStr}</div>
  <div class="balancete">
    <div class="bal-col income-col">
      <div class="bal-col-title">✅ Receitas</div>
      ${incTx.slice(0, 15).map((t: any) => '<div class="bal-item"><span class="bal-item-name">' + safeStr(t.description) + '</span><span class="bal-item-val income-val">' + fmt(Math.abs(+t.amount || 0)) + '</span></div>').join('')}
      ${incTx.length === 0 ? '<div style="color:#94a3b8;font-size:11px;padding:8px 0">Nenhuma receita encontrada</div>' : ''}
      <div class="bal-total inc-total"><span>TOTAL RECEITAS</span><span>${fmt(monthlyIncome)}</span></div>
    </div>
    <div class="bal-col expense-col">
      <div class="bal-col-title">❌ Despesas</div>
      ${expTx.slice(0, 15).map((t: any) => '<div class="bal-item"><span class="bal-item-name">' + safeStr(t.description) + '</span><span class="bal-item-val expense-val">' + fmt(Math.abs(+t.amount || 0)) + '</span></div>').join('')}
      ${expTx.length === 0 ? '<div style="color:#94a3b8;font-size:11px;padding:8px 0">Nenhuma despesa encontrada</div>' : ''}
      <div class="bal-total exp-total"><span>TOTAL DESPESAS</span><span>${fmt(monthlyExpense)}</span></div>
    </div>
  </div>
  <div class="net-row">
    <div>
      <div class="net-label">Resultado Líquido do Mês</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">Taxa de poupança: ${fmtPct(savingsRate)}</div>
    </div>
    <div class="net-value ${netMonth >= 0 ? 'net-positive' : 'net-negative'}">${netMonth >= 0 ? '+' : ''}${fmt(netMonth)}</div>
  </div>
</div>

<!-- ══ GASTOS POR CATEGORIA ═══════════════════════════════════════════════ -->
${topCats.length > 0 ? `
<div class="section">
  <div class="section-title"><span class="s-icon">🏷️</span> Distribuição de Gastos por Categoria</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div>
      ${topCats.map((c: any, i: number) => {
        const colors = ['#3b82f6','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899','#f97316'];
        const pct = catTotal > 0 ? ((+c.amount || 0) / catTotal) * 100 : 0;
        return '<div class="cat-row">' +
          '<div class="cat-dot" style="background:' + colors[i % colors.length] + '"></div>' +
          '<div class="cat-name">' + safeStr(c.category) + '</div>' +
          '<div class="cat-bar-wrap"><div class="cat-bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + colors[i % colors.length] + '"></div></div>' +
          '<div class="cat-pct">' + pct.toFixed(0) + '%</div>' +
          '<div class="cat-amt">' + fmt(+c.amount || 0) + '</div>' +
        '</div>';
      }).join('')}
    </div>
    <div>
      <div class="highlight-row" style="display:flex;flex-direction:column;gap:10px">
        <div class="highlight-card">
          <div class="hl-icon">🔝</div>
          <div class="hl-val">${safeStr(topCats[0]?.category)}</div>
          <div class="hl-lbl">Maior categoria: ${fmt(+(topCats[0]?.amount ?? 0))}</div>
        </div>
        <div class="highlight-card">
          <div class="hl-icon">📊</div>
          <div class="hl-val">${fmt(catTotal / Math.max(topCats.length, 1))}</div>
          <div class="hl-lbl">Média por categoria (${topCats.length} categorias)</div>
        </div>
        <div class="highlight-card">
          <div class="hl-icon">💰</div>
          <div class="hl-val">${fmt(catTotal)}</div>
          <div class="hl-lbl">Total categorizado</div>
        </div>
      </div>
    </div>
  </div>
</div>` : ''}

<!-- ══ CONTAS BANCÁRIAS ════════════════════════════════════════════════════ -->
<div class="section page-break">
  <div class="section-title"><span class="s-icon">🏦</span> Contas Bancárias</div>
  <table>
    <thead><tr><th>Conta</th><th>Tipo</th><th>Banco</th><th class="text-right">Saldo</th><th>Status</th></tr></thead>
    <tbody>
      ${accounts.map((a: any) => '<tr>' +
        '<td class="fw-bold">' + safeStr(a.name) + '</td>' +
        '<td><span class="badge badge-blue">' + safeStr(a.type || 'Corrente') + '</span></td>' +
        '<td>' + safeStr(a.bank) + '</td>' +
        '<td class="text-right ' + (+a.balance >= 0 ? 'text-green' : 'text-red') + '">' + fmt(+a.balance || 0) + '</td>' +
        '<td><span class="badge ' + (+a.balance >= 0 ? 'badge-green' : 'badge-red') + '">' + (+a.balance >= 0 ? 'Positivo' : 'Negativo') + '</span></td>' +
      '</tr>').join('')}
      ${accounts.length === 0 ? '<tr><td colspan="5" class="text-center" style="color:#94a3b8;padding:20px">Nenhuma conta cadastrada</td></tr>' : ''}
      ${accounts.length > 0 ? '<tr style="background:#f8fafc"><td colspan="3" class="fw-900" style="color:#0f172a">TOTAL</td><td class="text-right fw-900 ' + (totalBalance >= 0 ? 'text-green' : 'text-red') + '" style="font-size:13px">' + fmt(totalBalance) + '</td><td></td></tr>' : ''}
    </tbody>
  </table>
</div>

<!-- ══ CARTÕES DE CRÉDITO ═════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">💳</span> Cartões de Crédito</div>
  <table>
    <thead><tr><th>Cartão</th><th>Bandeira</th><th class="text-right">Limite Total</th><th class="text-right">Fatura Atual</th><th class="text-right">Limite Disponível</th><th>Vencimento</th></tr></thead>
    <tbody>
      ${cards.map((c: any) => {
        const available = +(c.creditLimit || 0) - +(c.usedLimit || 0);
        const usagePct = +(c.creditLimit || 0) > 0 ? ((+(c.usedLimit || 0) / +(c.creditLimit || 0)) * 100) : 0;
        return '<tr>' +
          '<td class="fw-bold">' + safeStr(c.name) + '</td>' +
          '<td><span class="badge badge-purple">' + safeStr(c.bankName) + '</span></td>' +
          '<td class="text-right">' + fmt(+(c.creditLimit || 0)) + '</td>' +
          '<td class="text-right text-red">' + fmt(+(c.usedLimit || 0)) + '</td>' +
          '<td class="text-right ' + (available >= 0 ? 'text-green' : 'text-red') + '">' +
            fmt(available) +
            '<div class="prog-bar" style="margin-top:4px"><div class="prog-fill ' + (usagePct > 80 ? 'red' : 'green') + '" style="width:' + Math.min(usagePct, 100).toFixed(0) + '%"></div></div>' +
            '<div style="font-size:9px;color:#94a3b8">' + usagePct.toFixed(0) + '% usado</div>' +
          '</td>' +
          '<td>Dia ' + safeStr(c.dueDay) + '</td>' +
        '</tr>';
      }).join('')}
      ${cards.length === 0 ? '<tr><td colspan="6" class="text-center" style="color:#94a3b8;padding:20px">Nenhum cartão cadastrado</td></tr>' : ''}
      ${cards.length > 0 ? '<tr style="background:#f8fafc"><td colspan="2" class="fw-900">TOTAL</td><td class="text-right fw-900">' + fmt(totalCardLimit) + '</td><td class="text-right fw-900 text-red">' + fmt(totalCardBill) + '</td><td class="text-right fw-900 text-green">' + fmt(totalCardLimit - totalCardBill) + '</td><td></td></tr>' : ''}
    </tbody>
  </table>
</div>

<!-- ══ INVESTIMENTOS ══════════════════════════════════════════════════════ -->
<div class="section page-break">
  <div class="section-title"><span class="s-icon">📈</span> Carteira de Investimentos</div>
  <div class="kpi-grid kpi-4" style="margin-bottom:16px">
    <div class="kpi purple"><div class="kpi-lbl">Total Investido</div><div class="kpi-val">${fmt(totalInvested)}</div><div class="kpi-sub">${investments.length} ativos</div></div>
    <div class="kpi ${totalGain >= 0 ? 'green' : 'red'}"><div class="kpi-lbl">Rendimento Total</div><div class="kpi-val">${fmt(totalGain)}</div><div class="kpi-sub">${gainPct >= 0 ? '+' : ''}${fmtPct(gainPct)} sobre inicial</div></div>
    <div class="kpi blue"><div class="kpi-lbl">Capital Inicial</div><div class="kpi-val">${fmt(totalInitial)}</div></div>
    <div class="kpi teal"><div class="kpi-lbl">Participação</div><div class="kpi-val">${patrimony > 0 ? fmtPct((totalInvested / patrimony) * 100) : '0%'}</div><div class="kpi-sub">do patrimônio total</div></div>
  </div>
  <table>
    <thead><tr><th>Ativo</th><th>Tipo</th><th class="text-right">Investido</th><th class="text-right">Valor Atual</th><th class="text-right">Rendimento</th><th class="text-right">% Portfolio</th></tr></thead>
    <tbody>
      ${investments.map((i: any) => {
        const gain = (+i.currentValue || 0) - (+i.initialAmount || 0);
        const pct = +i.initialAmount > 0 ? (gain / +i.initialAmount) * 100 : 0;
        const share = totalInvested > 0 ? ((+i.currentValue || 0) / totalInvested) * 100 : 0;
        return '<tr>' +
          '<td class="fw-bold">' + safeStr(i.name) + '</td>' +
          '<td><span class="badge badge-purple">' + safeStr(i.type) + '</span></td>' +
          '<td class="text-right">' + fmt(+i.initialAmount || 0) + '</td>' +
          '<td class="text-right fw-bold">' + fmt(+i.currentValue || 0) + '</td>' +
          '<td class="text-right ' + (gain >= 0 ? 'text-green' : 'text-red') + '">' + (gain >= 0 ? '+' : '') + fmt(gain) + ' (' + (gain >= 0 ? '+' : '') + fmtPct(pct) + ')</td>' +
          '<td class="text-right">' +
            '<div class="prog-bar"><div class="prog-fill green" style="width:' + Math.min(share, 100).toFixed(0) + '%"></div></div>' +
            '<div style="font-size:9px;color:#64748b;margin-top:2px">' + share.toFixed(1) + '%</div>' +
          '</td>' +
        '</tr>';
      }).join('')}
      ${investments.length === 0 ? '<tr><td colspan="6" class="text-center" style="color:#94a3b8;padding:20px">Nenhum investimento cadastrado</td></tr>' : ''}
    </tbody>
  </table>
</div>

<!-- ══ DÍVIDAS ════════════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">📉</span> Dívidas & Financiamentos</div>
  ${perennialDebts.length > 0 ? `
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">🔄 Despesas Perenes (mensais recorrentes) — Total: ${fmt(totalPerennialMonthly)}/mês</div>
    <table>
      <thead><tr><th>Descrição</th><th>Credor</th><th class="text-right">Valor Mensal</th><th>Dia Vencimento</th><th>Início</th></tr></thead>
      <tbody>
        ${perennialDebts.map((dd: any) => '<tr>' +
          '<td class="fw-bold">' + safeStr(dd.description) + ' <span class="badge badge-purple">Perene</span></td>' +
          '<td>' + safeStr(dd.creditCard?.name || dd.bankAccount?.name) + '</td>' +
          '<td class="text-right text-red">' + fmt(+dd.remainingAmount || 0) + '</td>' +
          '<td class="text-center">Dia ' + safeStr(dd.dueDayOfMonth) + '</td>' +
          '<td>' + safeStr(dd.perennialStartDate || dd.startDate) + '</td>' +
        '</tr>').join('')}
      </tbody>
    </table>
  </div>` : ''}
  ${installmentDebts.length > 0 ? `
  <div>
    <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">📋 Parceladas & Financiamentos — Restante: ${fmt(totalInstallmentDebt)}</div>
    <table>
      <thead><tr><th>Dívida</th><th>Credor</th><th class="text-right">Total</th><th class="text-right">Restante</th><th>Progresso</th><th>Status</th></tr></thead>
      <tbody>
        ${installmentDebts.map((dd: any) => {
          const progress = +dd.originalAmount > 0 ? Math.round(((+dd.originalAmount - (+dd.remainingAmount || 0)) / +dd.originalAmount) * 100) : 0;
          const paid = dd.paidInstallments != null ? dd.paidInstallments : '?';
          const total = dd.totalInstallments != null ? dd.totalInstallments : '?';
          return '<tr>' +
            '<td class="fw-bold">' + safeStr(dd.description) + '</td>' +
            '<td>' + safeStr(dd.creditCard?.name || dd.bankAccount?.name) + '</td>' +
            '<td class="text-right">' + fmt(+dd.originalAmount || 0) + '</td>' +
            '<td class="text-right text-red">' + fmt(+dd.remainingAmount || 0) + '</td>' +
            '<td>' +
              '<div class="prog-bar"><div class="prog-fill ' + (progress >= 70 ? 'green' : '') + '" style="width:' + progress + '%"></div></div>' +
              '<div style="font-size:9px;color:#64748b;margin-top:2px">' + progress + '% pago · ' + paid + '/' + total + ' parcelas</div>' +
            '</td>' +
            '<td><span class="badge ' + (dd.status === 'PAID' ? 'badge-green' : dd.status === 'OVERDUE' ? 'badge-red' : 'badge-yellow') + '">' + safeStr(dd.status || 'PENDENTE') + '</span></td>' +
          '</tr>';
        }).join('')}
        <tr style="background:#f8fafc"><td colspan="3" class="fw-900">TOTAL RESTANTE</td><td class="text-right fw-900 text-red" style="font-size:13px">${fmt(totalDebt)}</td><td colspan="2"></td></tr>
      </tbody>
    </table>
  </div>` : ''}
  ${debts.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px">Nenhuma dívida cadastrada 🎉</div>' : ''}
</div>

<!-- ══ METAS FINANCEIRAS ══════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">🏆</span> Metas Financeiras</div>
  ${goals.length > 0 ? `
  <table>
    <thead><tr><th>Meta</th><th class="text-right">Objetivo</th><th class="text-right">Atual</th><th>Progresso</th><th>Prazo</th><th>Status</th></tr></thead>
    <tbody>
      ${goals.map((g: any) => {
        const pct = +g.targetAmount > 0 ? Math.round((+g.currentAmount / +g.targetAmount) * 100) : 0;
        const remaining = (+g.targetAmount || 0) - (+g.currentAmount || 0);
        return '<tr>' +
          '<td class="fw-bold">' + safeStr(g.name) + '</td>' +
          '<td class="text-right">' + fmt(+g.targetAmount || 0) + '</td>' +
          '<td class="text-right text-blue">' + fmt(+g.currentAmount || 0) + '</td>' +
          '<td>' +
            '<div class="prog-bar"><div class="prog-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
            '<div style="font-size:9px;color:#64748b;margin-top:2px">' + pct + '% · falta ' + fmt(Math.max(remaining, 0)) + '</div>' +
          '</td>' +
          '<td>' + safeStr(g.deadline) + '</td>' +
          '<td><span class="badge ' + (pct >= 100 ? 'badge-green' : pct >= 50 ? 'badge-blue' : 'badge-yellow') + '">' + (pct >= 100 ? '✅ Concluída' : pct >= 50 ? 'Em progresso' : 'Iniciando') + '</span></td>' +
        '</tr>';
      }).join('')}
    </tbody>
  </table>` : '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px">Nenhuma meta cadastrada</div>'}
</div>

<!-- ══ DISTRIBUIÇÃO DE RENDA ══════════════════════════════════════════════ -->
${rules.length > 0 ? `
<div class="section">
  <div class="section-title"><span class="s-icon">🎯</span> Regras de Distribuição de Renda</div>
  <table>
    <thead><tr><th>Categoria</th><th class="text-right">Percentual</th><th class="text-right">Valor Mensal</th><th>Descrição</th></tr></thead>
    <tbody>
      ${rules.map((r: any) => '<tr>' +
        '<td class="fw-bold">' + safeStr(r.category || r.name) + '</td>' +
        '<td class="text-right text-blue">' + (r.percentage || 0) + '%</td>' +
        '<td class="text-right">' + fmt(monthlyIncome * (r.percentage || 0) / 100) + '</td>' +
        '<td style="color:#64748b">' + safeStr(r.description) + '</td>' +
      '</tr>').join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- ══ HISTÓRICO MENSAL ════════════════════════════════════════════════════ -->
${history.length > 0 ? `
<div class="section page-break">
  <div class="section-title"><span class="s-icon">📅</span> Histórico Mensal — Últimos ${history.length} Meses</div>
  <table>
    <thead><tr><th>Mês</th><th class="text-right">Receita</th><th class="text-right">Despesas</th><th class="text-right">Saldo Líquido</th><th class="text-right">Taxa Poupança</th><th>Resultado</th></tr></thead>
    <tbody>
      ${history.map((h: any) => {
        const net = (+h.income || 0) - (+h.expense || 0);
        const sp = +h.income > 0 ? (net / +h.income) * 100 : 0;
        return '<tr>' +
          '<td class="fw-bold">' + safeStr(h.month) + '</td>' +
          '<td class="text-right text-green">' + fmt(+h.income || 0) + '</td>' +
          '<td class="text-right text-red">' + fmt(+h.expense || 0) + '</td>' +
          '<td class="text-right ' + (net >= 0 ? 'text-green' : 'text-red') + '">' + fmt(net) + '</td>' +
          '<td class="text-right">' +
            '<div class="prog-bar" style="width:80px;display:inline-block;vertical-align:middle;margin-right:6px">' +
              '<div class="prog-fill ' + (sp >= 20 ? 'green' : sp >= 10 ? '' : 'red') + '" style="width:' + Math.min(Math.max(sp, 0), 100).toFixed(0) + '%"></div>' +
            '</div>' +
            fmtPct(sp) +
          '</td>' +
          '<td><span class="badge ' + (net >= 0 ? 'badge-green' : 'badge-red') + '">' + (net >= 0 ? '▲ Superávit' : '▼ Déficit') + '</span></td>' +
        '</tr>';
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- ══ TRANSAÇÕES RECENTES ════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">💳</span> Últimas ${recentTx.length} Transações do Mês</div>
  ${overdueTx.length > 0 ? `
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">⚠️</span>
    <div>
      <div style="font-weight:800;color:#dc2626;font-size:12px">${overdueTx.length} transação(ões) atrasada(s)</div>
      <div style="font-size:11px;color:#ef4444">Regularize para evitar juros e multas</div>
    </div>
  </div>` : ''}
  <table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="text-right">Valor</th><th>Status</th></tr></thead>
    <tbody>
      ${recentTx.map((t: any) => {
        const isIncome = t.type === 'INCOME' || t.type === 'RECEITA';
        return '<tr>' +
          '<td style="white-space:nowrap;color:#64748b">' + (t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—') + '</td>' +
          '<td class="fw-bold">' + safeStr(t.description) + '</td>' +
          '<td><span class="badge badge-gray">' + safeStr(t.categoryName || t.category) + '</span></td>' +
          '<td style="color:#64748b;font-size:10px">' + safeStr(t.accountName || t.account) + '</td>' +
          '<td class="text-right ' + (isIncome ? 'text-green' : 'text-red') + '">' + (isIncome ? '+' : '−') + fmt(Math.abs(+t.amount || 0)) + '</td>' +
          '<td><span class="badge ' + (t.status === 'PAID' || t.status === 'PAGO' ? 'badge-green' : t.status === 'OVERDUE' ? 'badge-red' : 'badge-yellow') + '">' + safeStr(t.status || 'PENDENTE') + '</span></td>' +
        '</tr>';
      }).join('')}
      ${recentTx.length === 0 ? '<tr><td colspan="6" class="text-center" style="color:#94a3b8;padding:20px">Nenhuma transação encontrada</td></tr>' : ''}
    </tbody>
  </table>
</div>

<!-- ══ PAINEL DE IR (IMPOSTO DE RENDA) ═══════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">🧾</span> Painel Imposto de Renda — Auxiliar</div>
  <div class="ir-section">
    <div class="ir-title">⚠️ Informações auxiliares — consulte um contador para declaração oficial</div>
    <div class="ir-grid">
      <div class="ir-item">
        <div class="ir-item-lbl">Rendimentos Tributáveis (estimativa)</div>
        <div class="ir-item-val">${fmt(monthlyIncome * 12)}</div>
      </div>
      <div class="ir-item">
        <div class="ir-item-lbl">Investimentos Declaráveis</div>
        <div class="ir-item-val">${fmt(totalInvested)}</div>
      </div>
      <div class="ir-item">
        <div class="ir-item-lbl">Rendimentos de Investimentos</div>
        <div class="ir-item-val ${totalGain >= 0 ? '' : 'text-red'}">${fmt(totalGain)}</div>
      </div>
      <div class="ir-item">
        <div class="ir-item-lbl">Dívidas (passivo declarável)</div>
        <div class="ir-item-val text-red">${fmt(totalDebt)}</div>
      </div>
      <div class="ir-item">
        <div class="ir-item-lbl">Bens e Direitos (estimativa)</div>
        <div class="ir-item-val">${fmt(totalBalance + totalInvested)}</div>
      </div>
      <div class="ir-item">
        <div class="ir-item-lbl">Patrimônio Líquido Declarável</div>
        <div class="ir-item-val">${fmt(patrimony)}</div>
      </div>
    </div>
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;font-size:11px;color:#166534">
    <strong>💡 Dicas para IR:</strong> Mantenha comprovantes de rendimentos, informe todos os bens e direitos com valor superior a R$ 300,00, declare rendimentos de investimentos isentos separadamente (LCA, LCI, CRI, CRA, Debêntures incentivadas). Rendimentos de FII são isentos se atendidas condições da Lei 11.033/2004.
  </div>
</div>

<!-- ══ RESUMO EXECUTIVO ═══════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title"><span class="s-icon">📋</span> Resumo Executivo</div>
  <div class="kpi-grid kpi-4">
    <div class="kpi gold"><div class="kpi-lbl">Metas Acumuladas</div><div class="kpi-val">${fmt(totalGoalsSaved)}</div><div class="kpi-sub">de ${fmt(totalGoals)} objetivo</div></div>
    <div class="kpi blue"><div class="kpi-lbl">Total Transações</div><div class="kpi-val">${transactions.length}</div><div class="kpi-sub">registradas no mês</div></div>
    <div class="kpi teal"><div class="kpi-lbl">Distribuição</div><div class="kpi-val">${rules.length}</div><div class="kpi-sub">regra(s) ativa(s)</div></div>
    <div class="kpi purple"><div class="kpi-lbl">Score Financeiro</div><div class="kpi-val" style="color:${scoreColor}">${overallScore}/100</div><div class="kpi-sub">${scoreLabel}</div></div>
  </div>
</div>

<!-- ══ ANÁLISE IA OPENAI ═══════════════════════════════════════════════════ -->
${aiSectionHtml}

<!-- ══ FOOTER ══════════════════════════════════════════════════════════════ -->
<div class="footer">
  <p><strong>MoneyControl</strong> — Financial Intelligence OS v2.0 · Premium Report</p>
  <p>Gerado automaticamente em ${dateStr} às ${timeStr} · Documento confidencial de uso pessoal</p>
  <p style="margin-top:4px;color:#cbd5e1">Os dados apresentados são baseados nos registros inseridos pelo usuário. Análise IA gerada via OpenAI GPT-4o. Consulte um profissional financeiro para decisões de investimento.</p>
</div>

</div>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); }<\/script>
</body>
</html>`;
  }

}
