package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {
    @Value("${openai.api.key:}")
    private String apiKey;
    @Value("${openai.model:gpt-4o}")
    private String model;

    private final TransactionRepository txRepo;
    private final BankAccountRepository accountRepo;
    private final InvestmentRepository investRepo;
    private final CreditCardRepository cardRepo;
    private final DebtReorganizationRepository debtRepo;
    private final FinancialGoalRepository goalRepo;
    private final MonthlyBudgetRepository budgetRepo;

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody Map<String, Object> body) {
        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "OpenAI API key not configured. Set OPENAI_API_KEY environment variable."));
        }

        String financialContext = buildFinancialContext();

        @SuppressWarnings("unchecked")
        List<Map<String, String>> userMessages = (List<Map<String, String>>) body.get("messages");

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
            "Você é um assistente financeiro especialista em IR (Imposto de Renda) brasileiro. " +
            "Aqui estão os dados financeiros do usuário:\n" + financialContext + "\n" +
            "Use esses dados para contextualizar suas respostas. Responda sempre em português."));
        if (userMessages != null) messages.addAll(userMessages);

        Map<String, Object> requestBody = Map.of("model", model, "messages", messages, "max_tokens", 1000);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        RestTemplate restTemplate = new RestTemplate();
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                "https://api.openai.com/v1/chat/completions",
                HttpMethod.POST,
                new HttpEntity<>(requestBody, headers),
                Map.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pdf-analysis")
    public ResponseEntity<Map<String, Object>> pdfAnalysis() {
        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.ok(Map.of("analysis", getDefaultPdfAnalysis()));
        }

        String financialContext = buildFinancialContext();

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
            "Você é um consultor financeiro pessoal de alto nível, especialista em planejamento financeiro, " +
            "investimentos e finanças pessoais no Brasil. Analise TODOS os dados financeiros do usuário abaixo " +
            "de forma PROFUNDA e DETALHADA.\n\n" + financialContext));
        messages.add(Map.of("role", "user", "content",
            "Com base em TODOS os meus dados financeiros, gere uma análise COMPLETA para incluir em um relatório PDF premium. " +
            "Retorne um JSON puro (sem markdown, sem ```json) com EXATAMENTE esta estrutura:\n" +
            "{\n" +
            "  \"situacaoAtual\": \"Parágrafo detalhado (4-6 frases) analisando minha situação financeira atual — patrimônio, saldo, investimentos, dívidas, score\",\n" +
            "  \"pontosFortes\": [\"ponto forte 1 específico com números\", \"ponto forte 2\", \"ponto forte 3\"],\n" +
            "  \"pontosAtencao\": [\"ponto de atenção 1 específico com números\", \"ponto de atenção 2\", \"ponto de atenção 3\"],\n" +
            "  \"dicasCurto\": [\"dica acionável 1 para os próximos 30 dias\", \"dica 2\", \"dica 3\"],\n" +
            "  \"dicasMedio\": [\"estratégia 1 para 3-6 meses\", \"estratégia 2\", \"estratégia 3\"],\n" +
            "  \"dicasLongo\": [\"plano 1 para 1-5 anos\", \"plano 2\", \"plano 3\"],\n" +
            "  \"previsaoFuturo\": \"Parágrafo (3-5 frases) com previsão e projeção do futuro financeiro baseado nos padrões atuais\",\n" +
            "  \"notaConsultor\": \"Parágrafo pessoal (3-4 frases) como se fosse um consultor financeiro falando diretamente com o usuário, motivacional e prático\"\n" +
            "}\n\n" +
            "REGRAS:\n" +
            "- Cite valores REAIS dos dados (R$ X, Y%, etc)\n" +
            "- Seja ESPECÍFICO, não genérico\n" +
            "- Retorne APENAS o JSON, sem markdown, sem explicação"));

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);
        requestBody.put("max_tokens", 2500);
        requestBody.put("temperature", 0.7);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        RestTemplate restTemplate = new RestTemplate();
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                "https://api.openai.com/v1/chat/completions",
                HttpMethod.POST,
                new HttpEntity<>(requestBody, headers),
                String.class
            );
            ObjectMapper mapper = new ObjectMapper();
            var root = mapper.readTree(response.getBody());
            String content = root.path("choices").get(0).path("message").path("content").asText();
            content = content.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
            @SuppressWarnings("unchecked")
            Map<String, Object> analysis = mapper.readValue(content, Map.class);
            return ResponseEntity.ok(Map.of("analysis", analysis));
        } catch (Exception e) {
            log.warn("PDF AI analysis failed, using fallback: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("analysis", getDefaultPdfAnalysis()));
        }
    }

    private Map<String, Object> getDefaultPdfAnalysis() {
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("situacaoAtual", "Análise via IA indisponível no momento. Os dados do relatório refletem sua situação financeira atual com base nos registros do sistema.");
        fallback.put("pontosFortes", List.of("Dados sendo monitorados pelo sistema", "Controle financeiro ativo", "Relatório gerado com sucesso"));
        fallback.put("pontosAtencao", List.of("Configure a chave OpenAI para análise completa", "Mantenha seus dados atualizados", "Revise periodicamente suas metas"));
        fallback.put("dicasCurto", List.of("Revise todas as transações do mês", "Atualize saldos das contas", "Confira dívidas pendentes"));
        fallback.put("dicasMedio", List.of("Estabeleça metas financeiras claras", "Crie uma reserva de emergência", "Diversifique investimentos"));
        fallback.put("dicasLongo", List.of("Planeje sua aposentadoria", "Invista em educação financeira", "Busque independência financeira"));
        fallback.put("previsaoFuturo", "Com monitoramento consistente e disciplina financeira, a tendência é de melhora contínua. Continue registrando seus dados para análises cada vez mais precisas.");
        fallback.put("notaConsultor", "Continue usando o MoneyControl para manter o controle das suas finanças. O primeiro passo para a saúde financeira é o conhecimento dos seus números. Você está no caminho certo!");
        return fallback;
    }

    private String buildFinancialContext() {
        List<Transaction> txs = txRepo.findAll();
        List<BankAccount> accounts = accountRepo.findAll();
        List<CreditCard> cards = cardRepo.findAll();
        List<Investment> investments = investRepo.findAll();
        List<DebtReorganization> debts = debtRepo.findAll();
        List<FinancialGoal> goals = goalRepo.findAll();
        List<MonthlyBudget> budgets = budgetRepo.findAll();

        // ── Resumo de contas ─────────────────────────────────────────────
        List<Map<String, Object>> accountsSummary = new ArrayList<>();
        double totalBalance = 0;
        for (BankAccount a : accounts) {
            double bal = a.getBalance() != null ? a.getBalance().doubleValue() : 0;
            totalBalance += bal;
            accountsSummary.add(Map.of("name", a.getName(), "bank", orEmpty(a.getBankName()), "balance", fmt(bal)));
        }

        // ── Resumo de cartões ────────────────────────────────────────────
        List<Map<String, Object>> cardsSummary = new ArrayList<>();
        for (CreditCard c : cards) {
            double used  = c.getUsedLimit()   != null ? c.getUsedLimit().doubleValue()   : 0;
            double limit = c.getCreditLimit()  != null ? c.getCreditLimit().doubleValue() : 0;
            int pct = limit > 0 ? (int) (used / limit * 100) : 0;
            cardsSummary.add(Map.of("name", c.getName(), "usedLimit", fmt(used),
                "creditLimit", fmt(limit), "utilizationPct", pct + "%"));
        }

        // ── Resumo de dívidas ────────────────────────────────────────────
        double totalDebt = 0; int overdueDebts = 0; int activeDebts = 0;
        List<Map<String, Object>> debtsSummary = new ArrayList<>();
        for (DebtReorganization d : debts) {
            if (d.getStatus() != null && d.getStatus().name().equals("PAID")) continue;
            activeDebts++;
            double remaining = d.getRemainingAmount() != null ? d.getRemainingAmount().doubleValue() : 0;
            totalDebt += remaining;
            if (d.getStatus() != null && d.getStatus().name().equals("OVERDUE")) overdueDebts++;
            int paid = d.getPaidInstallments() != null ? d.getPaidInstallments() : 0;
            int total = d.getTotalInstallments() != null ? d.getTotalInstallments() : 0;
            debtsSummary.add(Map.of(
                "desc", orEmpty(d.getDescription()),
                "remaining", fmt(remaining),
                "installments", paid + "/" + total,
                "status", d.getStatus() != null ? d.getStatus().name() : "?"
            ));
        }

        // ── Resumo de investimentos ──────────────────────────────────────
        double totalInvested = 0;
        List<Map<String, Object>> invSummary = new ArrayList<>();
        for (Investment inv : investments) {
            double val = inv.getCurrentValue() != null ? inv.getCurrentValue().doubleValue() :
                        (inv.getInitialAmount() != null ? inv.getInitialAmount().doubleValue() : 0);
            totalInvested += val;
            String typeName = inv.getType() != null ? inv.getType().name() : "?";
            invSummary.add(Map.of("name", orEmpty(inv.getName()), "type", typeName, "currentValue", fmt(val)));
        }

        // ── Resumo de transações dos últimos 90 dias ─────────────────────
        LocalDate cutoff = LocalDate.now().minusDays(90);
        double income90 = 0, expense90 = 0; int pendingCount = 0;
        Map<String, Double> byCategory = new LinkedHashMap<>();
        for (Transaction t : txs) {
            if (t.getDate() != null && t.getDate().isAfter(cutoff)) {
                double amt = t.getAmount() != null ? t.getAmount().doubleValue() : 0;
                if ("INCOME".equals(t.getType() != null ? t.getType().name() : "")) income90 += amt;
                if ("EXPENSE".equals(t.getType() != null ? t.getType().name() : "")) expense90 += amt;
                if (t.getStatus() != null && t.getStatus().name().equals("PENDING")) pendingCount++;
                String cat = t.getCategory() != null ? t.getCategory().getName() : "Sem categoria";
                byCategory.merge(cat, amt, Double::sum);
            }
        }
        // Top 8 categorias por valor
        List<Map<String, Object>> topCats = byCategory.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(8)
            .map(e -> Map.<String, Object>of("category", e.getKey(), "total", fmt(e.getValue())))
            .toList();

        // ── Metas ────────────────────────────────────────────────────────
        List<Map<String, Object>> goalsSummary = goals.stream()
            .map(g -> Map.<String, Object>of(
                "name", orEmpty(g.getName()),
                "target", fmt(g.getTargetAmount() != null ? g.getTargetAmount().doubleValue() : 0),
                "current", fmt(g.getCurrentAmount() != null ? g.getCurrentAmount().doubleValue() : 0),
                "pct", g.getTargetAmount() != null && g.getTargetAmount().doubleValue() > 0
                    ? (int)((g.getCurrentAmount() != null ? g.getCurrentAmount().doubleValue() : 0) / g.getTargetAmount().doubleValue() * 100) + "%" : "0%"
            )).toList();

        // ── Orçamentos ───────────────────────────────────────────────────
        List<Map<String, Object>> budgetsSummary = budgets.stream().limit(10)
            .map(b -> Map.<String, Object>of(
                "category", orEmpty(b.getCategoryName()),
                "limit", fmt(b.getBudgetAmount() != null ? b.getBudgetAmount().doubleValue() : 0),
                "spent", fmt(b.getSpentAmount() != null ? b.getSpentAmount().doubleValue() : 0)
            )).toList();

        // ── Monta contexto compacto ──────────────────────────────────────
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("dataHora", LocalDate.now().toString());
        ctx.put("resumoGeral", Map.of(
            "saldoTotalContas", fmt(totalBalance),
            "totalDividasAtivas", fmt(totalDebt),
            "totalInvestido", fmt(totalInvested),
            "patrimonioLiquido", fmt(totalBalance + totalInvested - totalDebt),
            "dividasAtrasadas", overdueDebts,
            "dividasAtivas", activeDebts,
            "transacoesPendentes", pendingCount
        ));
        ctx.put("ultimos90Dias", Map.of(
            "receitas", fmt(income90),
            "despesas", fmt(expense90),
            "saldo", fmt(income90 - expense90),
            "topCategorias", topCats
        ));
        ctx.put("contas", accountsSummary);
        ctx.put("cartoes", cardsSummary);
        ctx.put("dividasAtivas", debtsSummary);
        ctx.put("investimentos", invSummary);
        ctx.put("metas", goalsSummary);
        ctx.put("orcamentos", budgetsSummary);

        try {
            ObjectMapper mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(ctx);
        } catch (Exception e) {
            return "Erro ao gerar contexto: " + e.getMessage();
        }
    }

    private String fmt(double v) {
        return String.format("R$ %.2f", v);
    }
    private String orEmpty(String s) {
        return s != null ? s : "";
    }
}
