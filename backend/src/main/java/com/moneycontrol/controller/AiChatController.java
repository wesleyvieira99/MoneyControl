package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

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
    private final CategoryRepository categoryRepo;
    private final DebtReorganizationRepository debtRepo;
    private final FinancialGoalRepository goalRepo;
    private final ProfitDistributionRuleRepository distributionRepo;
    private final MonthlyBudgetRepository budgetRepo;
    private final InvestmentTransactionRepository investmentTransactionRepo;

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
            e.printStackTrace();
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
        List<Category> categories = categoryRepo.findAll();
        List<Investment> investments = investRepo.findAll();
        List<InvestmentTransaction> investmentTransactions = investmentTransactionRepo.findAll();
        List<DebtReorganization> debts = debtRepo.findAll();
        List<FinancialGoal> goals = goalRepo.findAll();
        List<ProfitDistributionRule> distributions = distributionRepo.findAll();
        List<MonthlyBudget> budgets = budgetRepo.findAll();

        Map<String, Object> fullContext = new LinkedHashMap<>();
        fullContext.put("generatedAt", new Date());
        fullContext.put("accounts", accounts);
        fullContext.put("cards", cards);
        fullContext.put("categories", categories);
        fullContext.put("investments", investments);
        fullContext.put("investmentTransactions", investmentTransactions);
        fullContext.put("debts", debts);
        fullContext.put("goals", goals);
        fullContext.put("distributionRules", distributions);
        fullContext.put("budgets", budgets);
        fullContext.put("transactions", txs);
        fullContext.put("totals", Map.of(
                "accounts", accounts.size(),
                "cards", cards.size(),
                "categories", categories.size(),
                "investments", investments.size(),
                "investmentTransactions", investmentTransactions.size(),
                "debts", debts.size(),
                "goals", goals.size(),
                "distributionRules", distributions.size(),
                "budgets", budgets.size(),
                "transactions", txs.size()
        ));
        try {
            return new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(fullContext);
        } catch (Exception e) {
            return "Falha ao serializar contexto financeiro: " + e.getMessage();
        }
    }
}
