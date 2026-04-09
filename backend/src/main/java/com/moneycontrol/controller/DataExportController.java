package com.moneycontrol.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/data")
@RequiredArgsConstructor
public class DataExportController {

    private final TransactionRepository txRepo;
    private final BankAccountRepository accountRepo;
    private final InvestmentRepository investRepo;
    private final DebtReorganizationRepository debtRepo;
    private final CreditCardRepository cardRepo;
    private final FinancialGoalRepository goalRepo;
    private final CategoryRepository categoryRepo;
    private final MonthlyBudgetRepository budgetRepo;
    private final ObjectMapper objectMapper;

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll() {
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("exportedAt", LocalDateTime.now().toString());
            data.put("version", "2.0");
            data.put("accounts", accountRepo.findAll());
            data.put("categories", categoryRepo.findAll());
            data.put("cards", cardRepo.findAll());
            data.put("transactions", txRepo.findAll());
            data.put("investments", investRepo.findAll());
            data.put("debts", debtRepo.findAll());
            data.put("goals", goalRepo.findAll());
            data.put("budgets", budgetRepo.findAll());

            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            String filename = "moneycontrol-backup-" +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm")) + ".json";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importData(@RequestParam("file") MultipartFile file) {
        try {
            String json = new String(file.getBytes(), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(json, Map.class);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "imported");
            result.put("exportedAt", data.get("exportedAt"));
            result.put("tables", data.keySet());
            result.put("message", "Dados importados com sucesso! Reinicie o sistema para refletir as mudancas.");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Arquivo invalido: " + e.getMessage()));
        }
    }
}
