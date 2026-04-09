import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  items: HelpItem[];
}

interface HelpItem {
  icon: string;
  title: string;
  desc: string;
  tags?: string[];
  tip?: string;
}

interface FAQ {
  q: string;
  a: string;
  open?: boolean;
}

interface Shortcut {
  keys: string[];
  desc: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss']
})
export class HelpComponent {
  searchQuery = '';
  activeSection: string | null = null;
  expandedFaq: number | null = null;

  shortcuts: Shortcut[] = [
    { keys: ['⌘', 'K'], desc: 'Abrir Command Palette — busca rápida de páginas e ações' },
    { keys: ['Esc'], desc: 'Fechar modais, menus e painéis' },
    { keys: ['↑', '↓'], desc: 'Navegar entre itens no Command Palette' },
    { keys: ['↵'], desc: 'Confirmar seleção no Command Palette' },
  ];

  sections: HelpSection[] = [
    {
      id: 'dashboard', icon: '📊', title: 'Dashboard', subtitle: 'Visão geral do seu patrimônio',
      color: '#3b82f6',
      items: [
        { icon: '💰', title: 'Saldo Total Consolidado', desc: 'Mostra a soma de todos os saldos das suas contas bancárias em tempo real. Clique no card para ver detalhes.', tags: ['KPI', 'Contas'] },
        { icon: '📈', title: 'Receita do Mês', desc: 'Total de entradas (salário, rendimentos, etc.) do mês selecionado. Filtrável pelo seletor de mês.', tags: ['KPI', 'Transações'] },
        { icon: '📉', title: 'Despesas do Mês', desc: 'Total de saídas do mês selecionado. Inclui despesas à vista e parcelas de cartão.', tags: ['KPI', 'Transações'] },
        { icon: '💵', title: 'Saldo Mensal', desc: 'Diferença entre receitas e despesas do mês. Verde = positivo, vermelho = negativo.', tags: ['KPI'] },
        { icon: '🏛️', title: 'Patrimônio Líquido', desc: 'Soma de contas + investimentos - dívidas. Reflete seu patrimônio real.', tags: ['KPI', 'Investimentos', 'Dívidas'] },
        { icon: '📊', title: 'Cards com Flip', desc: 'Cada KPI é um card interativo. Clique para "virar" e ver informações detalhadas no verso.', tip: 'Clique em qualquer card para ver mais detalhes!' },
        { icon: '💡', title: 'Insights Inteligentes', desc: 'Carrossel de dicas financeiras geradas com base nos seus dados reais. Clique para expandir detalhes.' },
        { icon: '📅', title: 'Seletor de Mês', desc: 'Filtre todos os dados do dashboard pelo mês desejado. Receitas, despesas e gráficos são atualizados.' },
        { icon: '📈', title: 'Gráfico de Evolução', desc: 'Aba "Visão Geral" — exibe evolução do saldo ao longo dos dias do mês selecionado.' },
        { icon: '🍩', title: 'Gráfico de Categorias', desc: 'Donut chart mostrando distribuição de despesas por categoria (Alimentação, Moradia, etc.).' },
        { icon: '🏛️', title: 'Pilares Financeiros', desc: 'Aba "Pilares" — análise em 5 dimensões: Investimentos, Dívidas, Receitas, Despesas e Cartões.' },
        { icon: '🗓️', title: 'Heatmap de Gastos', desc: 'Mapa de calor mostrando gastos diário. Identifique os dias que você mais gasta.' },
        { icon: '🎯', title: 'Taxa de Poupança', desc: 'Aba "Poupança" — gauge mostrando % do salário que você poupa. Ideal: acima de 20%.' },
        { icon: '📺', title: 'TV ao Vivo', desc: 'Notícias financeiras em tempo real de canais como CNN, Bloomberg e InfoMoney.' },
        { icon: '📰', title: 'Mercados', desc: 'Widgets de calendário econômico e últimas notícias do mercado financeiro.' },
      ]
    },
    {
      id: 'accounts', icon: '🏦', title: 'Contas Bancárias', subtitle: 'Gestão de contas correntes e poupanças',
      color: '#10b981',
      items: [
        { icon: '🏦', title: 'Cadastro de Contas', desc: 'Adicione suas contas bancárias (Nubank, Itaú, Bradesco, etc.) com nome, banco, saldo e cor personalizada.' },
        { icon: '💰', title: 'Saldo Consolidado', desc: 'Card principal mostra a soma de todos os saldos. Veja a participação % de cada conta.' },
        { icon: '📊', title: 'Gráfico de Pizza', desc: 'Distribuição visual dos saldos entre as contas. Identifique onde concentra mais dinheiro.' },
        { icon: '📊', title: 'Gráfico de Barras', desc: 'Comparação de saldos entre contas, ordenado do maior para o menor.' },
        { icon: '🔗', title: 'Vínculos', desc: 'Cada conta mostra cartões de crédito, investimentos e dívidas vinculadas a ela.', tags: ['Cartões', 'Investimentos', 'Dívidas'] },
        { icon: '📜', title: 'Histórico de Transações', desc: 'Clique em uma conta para ver todas as transações (bancárias e de cartão) associadas.', tags: ['Transações'] },
        { icon: '🏷️', title: 'Cor e Logo', desc: 'Personalize com cor de identificação e URL de logo do banco para fácil identificação.' },
        { icon: '✏️', title: 'Editar/Excluir', desc: 'Edite dados ou exclua contas. Atenção: excluir conta NÃO remove transações vinculadas.' },
        { icon: '🎯', title: 'Metas e Envelopes', desc: 'Ao aportar em metas ou envelopes, os saldos das contas são debitados automaticamente.', tags: ['Metas', 'Envelopes'], tip: 'Os aportes geram transações de despesa automaticamente!' },
      ]
    },
    {
      id: 'cards', icon: '💳', title: 'Cartões de Crédito', subtitle: 'Limites, faturas e parcelas',
      color: '#8b5cf6',
      items: [
        { icon: '💳', title: 'Cadastro de Cartões', desc: 'Adicione cartões com nome, banco, limite, dia de fechamento e vencimento, últimos 4 dígitos.' },
        { icon: '📊', title: 'Gráfico de Uso', desc: 'Barra horizontal mostrando limite usado vs. disponível por cartão. Linha tracejada = limite total.' },
        { icon: '💰', title: 'Resumo de Limites', desc: 'KPIs mostrando: total de cartões, total usado, limite total e disponível.' },
        { icon: '📅', title: 'Fatura Mensal', desc: 'Clique em "Ver Fatura" para verificar compras e parcelas do mês. Navegue entre meses.' },
        { icon: '📋', title: 'Aba Transações', desc: 'Compras feitas diretamente no cartão (sem parcelamento).' },
        { icon: '💸', title: 'Aba Dívidas', desc: 'Dívidas parceladas no cartão com progresso de pagamento e próxima parcela.' },
        { icon: '🔗', title: 'Vínculo com Conta', desc: 'Cada cartão é vinculado a uma conta bancária para controle de fatura.', tags: ['Contas'] },
        { icon: '🔄', title: 'Sincronização', desc: 'Mudanças em dívidas atualizam automaticamente o limite usado do cartão.', tags: ['Dívidas'] },
        { icon: '🎨', title: 'Visual Premium', desc: 'Cards com visual de cartão real: chip, dígitos, gradiente personalizado por cor.' },
      ]
    },
    {
      id: 'transactions', icon: '💳', title: 'Transações', subtitle: 'Receitas, despesas e transferências',
      color: '#06b6d4',
      items: [
        { icon: '➕', title: 'Nova Transação', desc: 'Adicione receitas (INCOME), despesas (EXPENSE) ou transferências (TRANSFER).' },
        { icon: '📅', title: 'Filtros por Data', desc: 'Botões rápidos: Este Mês, 3M, 6M, Ano, Todos. Ou defina um range personalizado.' },
        { icon: '🔍', title: 'Filtros Avançados', desc: 'Filtre por conta, cartão, status (Pago/Pendente/Atrasado), tipo e busca por texto.' },
        { icon: '📊', title: 'Gráfico Diário', desc: 'Barras de receita vs despesa por dia. Independe dos filtros da tabela.' },
        { icon: '🔄', title: 'Status Rápido', desc: 'Clique no badge de status para alternar: PAGO → PENDENTE → ATRASADO.' },
        { icon: '📋', title: 'Parcelamento', desc: 'Crie transações parceladas — o sistema gera automaticamente cada parcela.', tags: ['Dívidas'] },
        { icon: '🔁', title: 'Recorrência', desc: 'Marque como recorrente e defina até quando. O sistema cria transações automáticas todo mês.' },
        { icon: '♾️', title: 'Perene', desc: 'Transações que se repetem indefinidamente (24 meses por vez). Ex: assinatura Netflix.' },
        { icon: '⚠️', title: 'Alertas de Atraso', desc: 'Banner vermelho mostra quantidade de transações vencidas. Linhas vermelhas na tabela.' },
        { icon: '🏷️', title: 'Categorias', desc: 'Cada transação tem uma categoria (Alimentação, Moradia, etc.) com ícone e cor personalizados.' },
        { icon: '🎯', title: 'Integração com Metas', desc: 'Aportes em metas geram transações de despesa. Retiradas geram receitas.', tags: ['Metas'] },
        { icon: '💰', title: 'Integração com Envelopes', desc: 'Aportes em envelopes geram transações de despesa com a categoria do envelope.', tags: ['Envelopes'] },
      ]
    },
    {
      id: 'investments', icon: '📈', title: 'Investimentos', subtitle: 'Portfolio completo com rentabilidade',
      color: '#f59e0b',
      items: [
        { icon: '📈', title: 'Tipos de Investimento', desc: 'Suporte para: Ações, Cripto, Renda Fixa, Imóveis, Apostas e Outros.' },
        { icon: '💰', title: 'Valor Atual vs Investido', desc: 'Cada ativo mostra valor investido, valor atual e rentabilidade em % e R$.' },
        { icon: '📊', title: 'Gráfico de Composição', desc: 'Pizza mostrando distribuição por tipo (Ações X%, Cripto Y%, etc.).' },
        { icon: '📊', title: 'Performance Individual', desc: 'Barra horizontal dos top 8 ativos por ganho/perda.' },
        { icon: '🏦', title: 'Vínculo com Conta', desc: 'Vincule investimentos a contas bancárias para rastreabilidade.', tags: ['Contas'] },
        { icon: '📋', title: 'Movimentações', desc: 'Registre depósitos, saques, rendimentos e dividendos por ativo.' },
        { icon: '💸', title: 'Saques Refletidos', desc: 'Ao registrar um saque, uma transação de receita é criada automaticamente.', tags: ['Transações'] },
        { icon: '🔖', title: 'Ticker', desc: 'Cada ativo pode ter um ticker (ex: PETR4, BTC) para identificação rápida.' },
      ]
    },
    {
      id: 'debts', icon: '📉', title: 'Dívidas', subtitle: 'Parcelamentos e dívidas recorrentes',
      color: '#ef4444',
      items: [
        { icon: '📋', title: 'Tipos de Dívida', desc: 'Parcelada (ex: 12x de R$500) ou Perene (recorrente mensal, ex: aluguel).' },
        { icon: '💳', title: 'Vínculo com Cartão', desc: 'Vincule dívidas a um cartão de crédito. O limite usado é atualizado.', tags: ['Cartões'] },
        { icon: '🏦', title: 'Vínculo com Conta', desc: 'Ou vincule a uma conta bancária para dívidas de débito automático.', tags: ['Contas'] },
        { icon: '📊', title: 'Gráfico de Progresso', desc: 'Gauge visual dos top 5 dívidas mostrando % já pago.' },
        { icon: '📊', title: 'Breakdown por Dívida', desc: 'Barra horizontal mostrando valor restante de cada dívida.' },
        { icon: '✅', title: 'Marcar Parcelas', desc: 'Abra o modal de parcelas e marque individualmente como paga ou pendente.' },
        { icon: '⚡', title: 'Ações em Lote', desc: 'Marque todas as parcelas como pagas ou pendentes de uma vez.' },
        { icon: '🔄', title: 'Sincronização em Tempo Real', desc: 'Ao marcar parcela como paga, o cartão/conta são atualizados.', tags: ['Cartões', 'Contas'] },
        { icon: '⏰', title: 'Próximo Vencimento', desc: 'Mostra a data da próxima parcela pendente. Alerta "em breve" se < 7 dias.' },
        { icon: '📱', title: 'Lembretes WhatsApp', desc: 'Configure para receber lembretes de vencimento via WhatsApp.' },
        { icon: '🔍', title: 'Filtros', desc: 'Filtre por status (Paga/Pendente/Atrasada), tipo de vínculo e ordene por valor ou progresso.' },
        { icon: '🏆', title: 'Dívidas Quitadas', desc: 'Veja o histórico de dívidas já pagas no botão "Ver Quitadas".' },
      ]
    },
    {
      id: 'goals', icon: '🏆', title: 'Metas Financeiras', subtitle: 'Objetivos de poupança com acompanhamento',
      color: '#10b981',
      items: [
        { icon: '🎯', title: 'Criar Meta', desc: 'Defina: nome, valor alvo, valor inicial, prazo, ícone e cor. Ex: "Casa Própria R$300.000".' },
        { icon: '🏦', title: 'Saldo das Contas na Criação', desc: 'Ao criar, veja o saldo de todas as suas contas. Se definir valor inicial, escolha a conta de origem.', tags: ['Contas'], tip: 'O valor inicial é debitado da conta e registrado como transação!' },
        { icon: '📊', title: 'Anel de Progresso', desc: 'Visual ring mostrando % concluído com animação suave.' },
        { icon: '💰', title: 'Aporte', desc: 'Selecione conta de origem, valor (máx = saldo + restante da meta). Gera transação de DESPESA.', tags: ['Contas', 'Transações'] },
        { icon: '📤', title: 'Retirada', desc: 'Retire valores da meta de volta para uma conta. Gera transação de RECEITA.', tags: ['Contas', 'Transações'] },
        { icon: '⏰', title: 'Urgência', desc: 'Badges automáticos: Normal (>90d), Em breve (30-90d), Urgente (<30d), Vencida.' },
        { icon: '🎉', title: 'Celebração', desc: 'Confete animado quando a meta atinge 100%! 🎊' },
        { icon: '🏷️', title: 'Categorias Automáticas', desc: '"Aporte Meta" e "Retirada Meta" são criadas automaticamente como categorias de despesa/receita.' },
      ]
    },
    {
      id: 'budget', icon: '💰', title: 'Orçamento por Envelope', subtitle: 'Limites de gasto por categoria mensal',
      color: '#8b5cf6',
      items: [
        { icon: '✉️', title: 'Conceito de Envelopes', desc: 'Defina quanto deseja gastar por categoria no mês. Ex: "Alimentação R$1.000".' },
        { icon: '📅', title: 'Navegação Mensal', desc: 'Avance/retroceda entre meses para planejar e comparar orçamentos.' },
        { icon: '📊', title: 'KPIs do Mês', desc: 'Total orçado, total gasto, saldo do orçamento e % de utilização geral.' },
        { icon: '📊', title: 'Barra de Progresso Geral', desc: 'Barra visual da utilização total (verde/amarelo/vermelho conforme %).' },
        { icon: '🏦', title: 'Saldo das Contas na Criação', desc: 'Ao criar envelope, veja os saldos das contas para planejar realista.', tags: ['Contas'] },
        { icon: '🚦', title: 'Status por Envelope', desc: 'No controle (<50%), Atenção (50-80%), Quase no limite (80-100%), Ultrapassado (>100%).' },
        { icon: '💰', title: 'Aporte no Envelope', desc: 'Mova dinheiro de uma conta para o envelope. Gera transação de DESPESA.', tags: ['Contas', 'Transações'] },
        { icon: '📤', title: 'Retirada do Envelope', desc: 'Retire do envelope para uma conta. Gera transação de RECEITA.', tags: ['Contas', 'Transações'] },
        { icon: '📈', title: 'Cálculo Automático', desc: 'O gasto é calculado somando transações da categoria no mês selecionado.', tags: ['Transações'] },
      ]
    },
    {
      id: 'analytics', icon: '🧠', title: 'Analytics & Inteligência', subtitle: 'Insights avançados e padrões',
      color: '#ec4899',
      items: [
        { icon: '📊', title: 'Score Financeiro', desc: 'Nota de 0-1000 baseada em hábitos: poupança, controle de gastos, diversificação.' },
        { icon: '📈', title: 'Fluxo de Caixa', desc: 'Receitas vs despesas mês a mês. Identifique tendências e sazonalidades.' },
        { icon: '🔁', title: 'Gastos Recorrentes', desc: 'Identifica transações que se repetem mensalmente (assinaturas, contas fixas).' },
        { icon: '📊', title: 'Comparação Mensal', desc: 'Compare despesas por categoria entre meses para detectar variações.' },
        { icon: '🔍', title: 'Padrões de Gasto', desc: 'Algoritmo detecta padrões nos seus hábitos (dias da semana, horários, categorias).' },
        { icon: '🏁', title: 'Ponto de Independência', desc: 'Estimativa de quando seus investimentos cobrirão suas despesas mensais.' },
        { icon: '⚠️', title: 'Anomalias', desc: 'Detection automática de gastos fora do padrão (muito acima da média).' },
        { icon: '🌳', title: 'Treemap', desc: 'Mapa de árvore visual mostrando proporção de gastos por categoria.' },
      ]
    },
    {
      id: 'distribution', icon: '🎯', title: 'Distribuição', subtitle: 'Regras de alocação de renda',
      color: '#06b6d4',
      items: [
        { icon: '📊', title: 'Regras de Distribuição', desc: 'Defina percentuais de alocação. Ex: 50% Necessidades, 30% Desejos, 20% Poupança.' },
        { icon: '📈', title: 'Comparação Real vs Ideal', desc: 'Veja quanto deveria ir para cada categoria vs quanto realmente gastou.' },
        { icon: '⚙️', title: 'Personalizável', desc: 'Crie suas próprias categorias de distribuição com % e ícones.' },
      ]
    },
    {
      id: 'forecast', icon: '🔮', title: 'Previsão', subtitle: 'Projeções financeiras futuras',
      color: '#f97316',
      items: [
        { icon: '📈', title: 'Projeção de Saldo', desc: 'Baseado em receitas e despesas recorrentes, projeta saldo para os próximos meses.' },
        { icon: '📊', title: 'Cenários', desc: 'Visualize cenários otimista, realista e pessimista.' },
        { icon: '⚠️', title: 'Alertas', desc: 'O sistema avisa se projetar saldo negativo nos próximos meses.' },
      ]
    },
    {
      id: 'simulator', icon: '🧮', title: 'Simulador Financeiro', subtitle: 'Calculadoras e simulações',
      color: '#a855f7',
      items: [
        { icon: '📈', title: 'Juros Compostos', desc: 'Simule investimentos com aportes mensais, taxa e prazo.' },
        { icon: '💰', title: 'Monte Carlo', desc: 'Simulação estatística com milhares de cenários para estimar resultados.' },
        { icon: '🏦', title: 'Financiamento', desc: 'Calcule parcelas e juros de financiamentos imobiliários ou veiculares.' },
      ]
    },
    {
      id: 'calendar', icon: '📅', title: 'Calendário', subtitle: 'Vencimentos e parcelas no calendário',
      color: '#3b82f6',
      items: [
        { icon: '📅', title: 'Visão Mensal', desc: 'Calendário visual com todas as parcelas e vencimentos do mês.' },
        { icon: '⚠️', title: 'Vencimentos Próximos', desc: 'Destaque para parcelas que vencem nos próximos 7 dias.' },
        { icon: '📱', title: 'Lembretes WhatsApp', desc: 'Receba lembretes de vencimentos diretamente pelo WhatsApp.', tags: ['Dívidas'] },
        { icon: '📊', title: 'Resumo do Mês', desc: 'Total a pagar no mês, total pago e pendente.' },
      ]
    },
    {
      id: 'raiox', icon: '🔍', title: 'Raio-X Financeiro', subtitle: 'Diagnóstico completo da saúde financeira',
      color: '#ef4444',
      items: [
        { icon: '🩺', title: 'Diagnóstico', desc: 'Análise completa: patrimônio, dívidas, investimentos, gastos e projeções.' },
        { icon: '📊', title: 'Indicadores', desc: 'Taxa de endividamento, índice de poupança, diversificação de investimentos.' },
        { icon: '💡', title: 'Recomendações', desc: 'Dicas personalizadas baseadas no seu perfil financeiro.' },
      ]
    },
    {
      id: 'settings', icon: '⚙️', title: 'Configurações', subtitle: 'Personalização e dados',
      color: '#64748b',
      items: [
        { icon: '🏷️', title: 'Gerenciar Categorias', desc: 'Crie, edite e exclua categorias de despesa/receita com ícones e cores.' },
        { icon: '🌙', title: 'Tema Claro/Escuro', desc: 'Alterne entre modo escuro e claro (via botão na sidebar).' },
        { icon: '💾', title: 'Exportar Dados', desc: 'Exporte todos os dados em JSON como backup. Botão flutuante no canto.' },
        { icon: '📥', title: 'Importar Dados', desc: 'Importe backup JSON. Atenção: substitui todos os dados existentes!' },
        { icon: '📄', title: 'Relatório PDF', desc: 'Gere relatório completo em PDF com todas as informações financeiras.' },
      ]
    }
  ];

  faqs: FAQ[] = [
    { q: 'Como funciona o aporte em metas?', a: 'Ao aportar, o valor é debitado da conta bancária selecionada e registrado como transação de despesa com categoria "Aporte Meta". O saldo da conta diminui e o progresso da meta aumenta.' },
    { q: 'O que acontece se eu excluir uma conta?', a: 'A conta é removida, mas as transações vinculadas a ela permanecem. Recomendamos transferir ou excluir transações antes.' },
    { q: 'Como funcionam dívidas perenes?', a: 'Dívidas perenes são recorrências sem fim definido (ex: aluguel). O sistema gera 24 meses de parcelas automaticamente.' },
    { q: 'O que é o Score Financeiro?', a: 'É uma pontuação de 0 a 1000 calculada com base em: taxa de poupança, controle de gastos, diversificação de investimentos, regularidade de receitas e nível de endividamento.' },
    { q: 'Como envelopes calculam os gastos?', a: 'O sistema busca todas as transações de DESPESA do mês selecionado que têm a mesma categoria do envelope e soma os valores.' },
    { q: 'Posso vincular um cartão a uma conta?', a: 'Sim! Ao criar ou editar um cartão, selecione a conta bancária associada. Isso permite rastrear faturas e impacto no saldo.' },
    { q: 'O que é Monte Carlo no simulador?', a: 'É uma técnica estatística que roda milhares de simulações aleatórias para estimar a probabilidade de diferentes resultados nos seus investimentos.' },
    { q: 'Como funciona a recorrência de transações?', a: 'Ao marcar uma transação como recorrente, defina até quando deve se repetir. O sistema cria cópias mensais automaticamente no mesmo dia.' },
    { q: 'O backup JSON é seguro?', a: 'O arquivo JSON exportado contém todos os seus dados em texto. Guarde-o em local seguro. A importação substitui TODOS os dados do sistema.' },
    { q: 'Como usar o Command Palette?', a: 'Pressione ⌘K (ou Ctrl+K) para abrir. Digite o nome de qualquer página ou funcionalidade. Use ↑↓ para navegar e Enter para abrir.' },
    { q: 'O que é o Ponto de Independência?', a: 'É a data estimada em que seus rendimentos de investimentos serão suficientes para cobrir suas despesas mensais sem precisar trabalhar.' },
    { q: 'Como os cartões atualizam o limite usado?', a: 'Quando dívidas vinculadas a um cartão são pagas ou criadas, o limite usado é recalculado automaticamente em tempo real.' },
  ];

  dataRelationships = [
    { from: '🏦 Contas', to: '💳 Cartões', desc: 'Cada cartão é vinculado a uma conta bancária (fatura)', icon: '🔗', color: '#3b82f6' },
    { from: '🏦 Contas', to: '📈 Investimentos', desc: 'Investimentos são vinculados a contas de origem', icon: '🔗', color: '#10b981' },
    { from: '🏦 Contas', to: '📉 Dívidas', desc: 'Dívidas podem ser vinculadas a contas (débito automático)', icon: '🔗', color: '#ef4444' },
    { from: '🏦 Contas', to: '🏆 Metas', desc: 'Aportes debitam conta e geram transação de despesa', icon: '💰', color: '#f59e0b' },
    { from: '🏦 Contas', to: '💰 Envelopes', desc: 'Aportes debitam conta e geram transação de despesa', icon: '💰', color: '#8b5cf6' },
    { from: '💳 Cartões', to: '📉 Dívidas', desc: 'Dívidas parceladas afetam limite usado do cartão', icon: '💸', color: '#ec4899' },
    { from: '💳 Transações', to: '📊 Dashboard', desc: 'KPIs e gráficos são calculados a partir das transações', icon: '📊', color: '#06b6d4' },
    { from: '💳 Transações', to: '💰 Envelopes', desc: 'Gastos por categoria alimentam o cálculo dos envelopes', icon: '📊', color: '#a855f7' },
    { from: '💳 Transações', to: '🧠 Analytics', desc: 'Análises, scores e padrões são baseados nas transações', icon: '🧠', color: '#f97316' },
    { from: '📉 Dívidas', to: '💳 Transações', desc: 'Parcelas geram transações automáticas no vencimento', icon: '🔄', color: '#ef4444' },
    { from: '🏆 Metas', to: '💳 Transações', desc: 'Aportes/retiradas geram transações de despesa/receita', icon: '🔄', color: '#10b981' },
    { from: '💰 Envelopes', to: '💳 Transações', desc: 'Aportes/retiradas geram transações categorizadas', icon: '🔄', color: '#8b5cf6' },
  ];

  get filteredSections(): HelpSection[] {
    if (!this.searchQuery.trim()) return this.sections;
    const q = this.searchQuery.toLowerCase();
    return this.sections.map(s => ({
      ...s,
      items: s.items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.desc.toLowerCase().includes(q) ||
        (i.tags || []).some(t => t.toLowerCase().includes(q)) ||
        s.title.toLowerCase().includes(q)
      )
    })).filter(s => s.items.length > 0);
  }

  get filteredFaqs(): FAQ[] {
    if (!this.searchQuery.trim()) return this.faqs;
    const q = this.searchQuery.toLowerCase();
    return this.faqs.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }

  get totalItems(): number {
    return this.sections.reduce((s, sec) => s + sec.items.length, 0);
  }

  toggleSection(id: string) {
    this.activeSection = this.activeSection === id ? null : id;
  }

  toggleFaq(i: number) {
    this.expandedFaq = this.expandedFaq === i ? null : i;
  }
}
