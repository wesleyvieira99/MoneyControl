package com.moneycontrol.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moneycontrol.model.*;
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
import java.util.Comparator;

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
    private final InstallmentGroupRepository installmentGroupRepo;
    private final InvestmentTransactionRepository investmentTransactionRepo;
    private final ProfitDistributionRuleRepository distributionRuleRepo;
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

    @GetMapping("/history")
    public ResponseEntity<List<String>> listHistory() {
        try {
            Path runtimeDir = Paths.get("").toAbsolutePath().normalize();
            Path historyDir = resolveRepoRoot(runtimeDir).resolve("history");
            if (!Files.isDirectory(historyDir)) return ResponseEntity.ok(List.of());
            List<String> files = Files.list(historyDir)
                .filter(p -> p.getFileName().toString().endsWith(".json"))
                .map(p -> p.getFileName().toString())
                .sorted(Comparator.reverseOrder())
                .toList();
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/import-from-history")
    public ResponseEntity<Map<String, Object>> importFromHistory(@RequestParam("filename") String filename) {
        if (filename == null || filename.isBlank() || filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nome de arquivo inválido."));
        }
        if (!filename.endsWith(".json")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Apenas arquivos .json são permitidos."));
        }
        try {
            Path runtimeDir = Paths.get("").toAbsolutePath().normalize();
            Path historyDir = resolveRepoRoot(runtimeDir).resolve("history");
            Path targetFile = historyDir.resolve(filename).normalize();
            if (!targetFile.startsWith(historyDir)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Acesso negado."));
            }
            if (!Files.exists(targetFile)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Arquivo não encontrado: " + filename));
            }
            String json = Files.readString(targetFile, StandardCharsets.UTF_8);
            return ResponseEntity.ok(doImport(json));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falha ao importar: " + e.getMessage()));
        }
    }

    @PostMapping("/import")
    @SuppressWarnings("null")
    public ResponseEntity<Map<String, Object>> importData(@RequestParam("file") MultipartFile file) {
        try {
            String json = new String(file.getBytes(), StandardCharsets.UTF_8);
            return ResponseEntity.ok(doImport(json));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falha ao importar arquivo: " + e.getMessage()));
        }
    }

    @SuppressWarnings({"null","unchecked"})
    private Map<String, Object> doImport(String json) throws Exception {
            Map<String, Object> data = objectMapper.readValue(json, Map.class);

            List<BankAccount> accounts = convertList(data.get("accounts"), BankAccount.class);
            List<Category> categories = convertList(data.get("categories"), Category.class);
            List<CreditCard> cards = convertList(data.get("cards"), CreditCard.class);
            List<Transaction> transactions = convertList(data.get("transactions"), Transaction.class);
            List<Investment> investments = convertList(data.get("investments"), Investment.class);
            List<DebtReorganization> debts = convertList(data.get("debts"), DebtReorganization.class);
            List<FinancialGoal> goals = convertList(data.get("goals"), FinancialGoal.class);
            List<MonthlyBudget> budgets = convertList(data.get("budgets"), MonthlyBudget.class);
            List<InstallmentGroup> installmentGroups = convertList(data.get("installmentGroups"), InstallmentGroup.class);
            List<InvestmentTransaction> investmentTransactions = convertList(data.get("investmentTransactions"), InvestmentTransaction.class);
            List<ProfitDistributionRule> distributionRules = convertList(data.get("distributionRules"), ProfitDistributionRule.class);

            txRepo.deleteAll();
            debtRepo.deleteAll();
            investmentTransactionRepo.deleteAll();
            investRepo.deleteAll();
            installmentGroupRepo.deleteAll();
            distributionRuleRepo.deleteAll();
            cardRepo.deleteAll();
            budgetRepo.deleteAll();
            goalRepo.deleteAll();
            categoryRepo.deleteAll();
            accountRepo.deleteAll();

            Map<Long, BankAccount> savedAccountsByOldId = new LinkedHashMap<>();
            for (BankAccount account : accounts) {
                Long oldId = account.getId();
                account.setId(null);
                savedAccountsByOldId.put(oldId, accountRepo.save(account));
            }

            Map<Long, Category> savedCategoriesByOldId = new LinkedHashMap<>();
            for (Category category : categories) {
                Long oldId = category.getId();
                category.setId(null);
                savedCategoriesByOldId.put(oldId, categoryRepo.save(category));
            }

            for (FinancialGoal goal : goals) {
                goal.setId(null);
            }
            goalRepo.saveAll(goals);

            for (MonthlyBudget budget : budgets) {
                budget.setId(null);
            }
            budgetRepo.saveAll(budgets);

            Map<Long, CreditCard> savedCardsByOldId = new LinkedHashMap<>();
            for (CreditCard card : cards) {
                Long oldId = card.getId();
                Long oldAccountId = card.getBankAccount() != null ? card.getBankAccount().getId() : null;
                card.setId(null);
                card.setBankAccount(oldAccountId != null ? savedAccountsByOldId.get(oldAccountId) : null);
                savedCardsByOldId.put(oldId, cardRepo.save(card));
            }

            Map<Long, InstallmentGroup> savedInstallmentGroupsByOldId = new LinkedHashMap<>();
            for (InstallmentGroup group : installmentGroups) {
                Long oldId = group.getId();
                group.setId(null);
                group.setTransactions(null);
                savedInstallmentGroupsByOldId.put(oldId, installmentGroupRepo.save(group));
            }

            Map<Long, Investment> savedInvestmentsByOldId = new LinkedHashMap<>();
            for (Investment investment : investments) {
                Long oldId = investment.getId();
                Long oldAccountId = investment.getBankAccount() != null ? investment.getBankAccount().getId() : null;
                investment.setId(null);
                investment.setBankAccount(oldAccountId != null ? savedAccountsByOldId.get(oldAccountId) : null);
                savedInvestmentsByOldId.put(oldId, investRepo.save(investment));
            }

            for (InvestmentTransaction investmentTransaction : investmentTransactions) {
                Long oldInvestmentId = investmentTransaction.getInvestment() != null ? investmentTransaction.getInvestment().getId() : null;
                investmentTransaction.setId(null);
                investmentTransaction.setInvestment(oldInvestmentId != null ? savedInvestmentsByOldId.get(oldInvestmentId) : null);
            }
            investmentTransactionRepo.saveAll(investmentTransactions);

            for (DebtReorganization debt : debts) {
                Long oldAccountId = debt.getBankAccount() != null ? debt.getBankAccount().getId() : null;
                Long oldCardId = debt.getCreditCard() != null ? debt.getCreditCard().getId() : null;
                debt.setId(null);
                debt.setBankAccount(oldAccountId != null ? savedAccountsByOldId.get(oldAccountId) : null);
                debt.setCreditCard(oldCardId != null ? savedCardsByOldId.get(oldCardId) : null);
            }
            debtRepo.saveAll(debts);

            for (ProfitDistributionRule rule : distributionRules) {
                Long oldCategoryId = rule.getCategory() != null ? rule.getCategory().getId() : null;
                Long oldAccountId = rule.getBankAccount() != null ? rule.getBankAccount().getId() : null;
                rule.setId(null);
                rule.setCategory(oldCategoryId != null ? savedCategoriesByOldId.get(oldCategoryId) : null);
                rule.setBankAccount(oldAccountId != null ? savedAccountsByOldId.get(oldAccountId) : null);
            }
            distributionRuleRepo.saveAll(distributionRules);

            for (Transaction tx : transactions) {
                Long oldCategoryId = tx.getCategory() != null ? tx.getCategory().getId() : null;
                Long oldAccountId = tx.getBankAccount() != null ? tx.getBankAccount().getId() : null;
                Long oldCardId = tx.getCreditCard() != null ? tx.getCreditCard().getId() : null;
                Long oldInstallmentGroupId = tx.getInstallmentGroup() != null ? tx.getInstallmentGroup().getId() : null;
                tx.setId(null);
                tx.setCategory(oldCategoryId != null ? savedCategoriesByOldId.get(oldCategoryId) : null);
                tx.setBankAccount(oldAccountId != null ? savedAccountsByOldId.get(oldAccountId) : null);
                tx.setCreditCard(oldCardId != null ? savedCardsByOldId.get(oldCardId) : null);
                tx.setInstallmentGroup(oldInstallmentGroupId != null ? savedInstallmentGroupsByOldId.get(oldInstallmentGroupId) : null);
            }
            txRepo.saveAll(transactions);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "imported");
            result.put("exportedAt", data.get("exportedAt"));
            result.put("tables", List.of("accounts", "categories", "cards", "transactions", "investments", "investmentTransactions", "debts", "goals", "budgets", "installmentGroups", "distributionRules"));
            result.put("message", "Dados importados com sucesso!");
            Map<String, Integer> counts = new LinkedHashMap<>();
            counts.put("accounts", accounts.size());
            counts.put("categories", categories.size());
            counts.put("cards", cards.size());
            counts.put("transactions", transactions.size());
            counts.put("investments", investments.size());
            counts.put("investmentTransactions", investmentTransactions.size());
            counts.put("debts", debts.size());
            counts.put("goals", goals.size());
            counts.put("budgets", budgets.size());
            counts.put("installmentGroups", installmentGroups.size());
            counts.put("distributionRules", distributionRules.size());
            result.put("counts", counts);
            return result;
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
        data.put("investmentTransactions", investmentTransactionRepo.findAll());
        data.put("debts", debtRepo.findAll());
        data.put("goals", goalRepo.findAll());
        data.put("budgets", budgetRepo.findAll());
        data.put("installmentGroups", installmentGroupRepo.findAll());
        data.put("distributionRules", distributionRuleRepo.findAll());
        return data;
    }

    private Path resolveRepoRoot(Path runtimeDir) {
        if (runtimeDir.getFileName() != null && "backend".equals(runtimeDir.getFileName().toString())) {
            return runtimeDir.getParent() != null ? runtimeDir.getParent() : runtimeDir;
        }
        return runtimeDir;
    }

    private <T> List<T> convertList(Object raw, Class<T> clazz) {
        if (raw == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(objectMapper.convertValue(
            raw,
            objectMapper.getTypeFactory().constructCollectionType(List.class, clazz)
        ));
    }

}
