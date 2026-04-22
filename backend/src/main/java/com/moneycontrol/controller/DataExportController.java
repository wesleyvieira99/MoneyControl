package com.moneycontrol.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moneycontrol.repository.*;
import com.moneycontrol.service.BackupGitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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
    private final BackupGitService backupGitService;

    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH-mm-ss");

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll() {
        try {
            Map<String, Object> data = collectExportData();

            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            String filename = "moneycontrol-backup-" +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm")) + ".json";
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/json"))
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

    @PostMapping("/save-position")
    public ResponseEntity<Map<String, Object>> savePosition() {
        try {
            Path runtimeDir = Paths.get("").toAbsolutePath().normalize();
            Path repoRoot = resolveRepoRoot(runtimeDir);
            Path historyDir = repoRoot.resolve("history");
            Files.createDirectories(historyDir);

            String timestamp = LocalDateTime.now().format(FILE_TS);
            String backupFilename = "moneycontrol-backup-" + timestamp + ".json";
            Path backupFile = historyDir.resolve(backupFilename);

            Map<String, Object> data = collectExportData();
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
            Files.writeString(backupFile, json, StandardCharsets.UTF_8);

            String relBackupPath = repoRoot.relativize(backupFile).toString().replace('\\', '/');
            BackupGitService.CommandResult addResult = backupGitService.run(repoRoot, "git", "add", relBackupPath);
            if (!addResult.ok()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "Falha no git add",
                    "command", addResult.command(),
                    "output", addResult.output()
                ));
            }

            String commitMessage = "backup: salvar posicao " + timestamp;
            BackupGitService.CommandResult commitResult = backupGitService.run(repoRoot, "git", "commit", "-m", commitMessage);
            if (!commitResult.ok()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "Falha no git commit",
                    "command", commitResult.command(),
                    "output", commitResult.output()
                ));
            }

            BackupGitService.CommandResult pushResult = backupGitService.run(repoRoot, "git", "push", "origin", "main");
            if (!pushResult.ok()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "Falha no git push",
                    "command", pushResult.command(),
                    "output", pushResult.output(),
                    "backupFile", relBackupPath
                ));
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "ok");
            response.put("backupFile", relBackupPath);
            response.put("commitMessage", commitMessage);
            response.put("commitOutput", commitResult.output());
            response.put("pushOutput", pushResult.output());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Falha ao salvar posição: " + e.getMessage()));
        }
    }

    private Map<String, Object> collectExportData() {
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
        return data;
    }

    private Path resolveRepoRoot(Path runtimeDir) {
        if (runtimeDir.getFileName() != null && "backend".equals(runtimeDir.getFileName().toString())) {
            return runtimeDir.getParent() != null ? runtimeDir.getParent() : runtimeDir;
        }
        return runtimeDir;
    }
}
