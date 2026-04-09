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
