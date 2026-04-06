package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDate;
import java.time.YearMonth;
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
        YearMonth ym = YearMonth.now();
        LocalDate start = ym.minusMonths(12).atDay(1);
        LocalDate end = ym.atEndOfMonth();
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);
        List<BankAccount> accounts = accountRepo.findAll();
        List<Investment> investments = investRepo.findAll();

        StringBuilder sb = new StringBuilder();
        sb.append("Contas bancárias: ").append(accounts.size()).append("\n");
        accounts.forEach(a -> sb.append("  - ").append(a.getName()).append(": R$ ").append(a.getBalance()).append("\n"));
        sb.append("Investimentos: ").append(investments.size()).append("\n");
        investments.forEach(i -> sb.append("  - ").append(i.getName()).append(" (").append(i.getType()).append("): R$ ").append(i.getCurrentValue()).append("\n"));
        sb.append("Transações dos últimos 12 meses: ").append(txs.size()).append("\n");
        return sb.toString();
    }
}
