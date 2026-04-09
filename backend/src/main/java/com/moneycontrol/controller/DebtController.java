package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

@RestController
@RequestMapping("/api/debts")
@RequiredArgsConstructor
public class DebtController {

    private final DebtReorganizationRepository repo;
    private final TransactionRepository txRepo;
    private final CategoryRepository categoryRepo;
    private final CreditCardRepository cardRepo;

    @Value("${whatsapp.phone:+5511985536310}")
    private String whatsappPhone;
    @Value("${whatsapp.callmebot.apikey:}")
    private String callMeBotApiKey;

    // ── CRUD ─────────────────────────────────────────────────────────────────

    @GetMapping
    public List<DebtReorganization> getAll() { return repo.findAll(); }

    @GetMapping("/by-card/{cardId}")
    public List<DebtReorganization> getByCard(@PathVariable Long cardId) {
        return repo.findByCreditCardId(cardId);
    }

    @GetMapping("/by-account/{accountId}")
    public List<DebtReorganization> getByAccount(@PathVariable Long accountId) {
        return repo.findByBankAccountId(accountId);
    }

    @PostMapping
    public ResponseEntity<DebtReorganization> create(@RequestBody DebtReorganization d) {
        Category debtCat = getDebtCategory();
        DebtReorganization saved = repo.save(d);
        if (Boolean.TRUE.equals(saved.getPerennial())) {
            generatePerennialTransactions(saved, debtCat);
        } else if (saved.getTotalInstallments() != null && saved.getTotalInstallments() > 0) {
            generateInstallmentTransactions(saved, debtCat);
        }
        recomputeCardUsedLimit(saved.getCreditCard() != null ? saved.getCreditCard().getId() : null);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DebtReorganization> update(@PathVariable Long id, @RequestBody DebtReorganization d) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        d.setId(id);
        DebtReorganization saved = repo.save(d);
        recomputeCardUsedLimit(saved.getCreditCard() != null ? saved.getCreditCard().getId() : null);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Optional<DebtReorganization> debt = repo.findById(id);
        if (debt.isEmpty()) return ResponseEntity.notFound().build();
        Long cardId = debt.get().getCreditCard() != null ? debt.get().getCreditCard().getId() : null;
        repo.deleteById(id);
        recomputeCardUsedLimit(cardId);
        return ResponseEntity.noContent().build();
    }

    // ── SYNC / RECOMPUTE ─────────────────────────────────────────────────────

    @PostMapping("/sync-transactions")
    public ResponseEntity<String> syncTransactions() {
        Category debtCat = getDebtCategory();
        List<DebtReorganization> debts = repo.findAll();
        int generated = 0;
        for (DebtReorganization debt : debts) {
            List<Transaction> allTx = txRepo.findAll();
            if (Boolean.TRUE.equals(debt.getPerennial())) {
                String marker = "Conta perene gerada automaticamente: " + debt.getDescription();
                boolean hasAny = allTx.stream().anyMatch(t -> t.getNotes() != null && t.getNotes().equals(marker));
                if (!hasAny) { generatePerennialTransactions(debt, debtCat); generated++; }
            } else if (debt.getTotalInstallments() != null && debt.getTotalInstallments() > 0) {
                if (generateMissingInstallments(debt, allTx, debtCat) > 0) generated++;
            }
        }
        return ResponseEntity.ok("Sincronizacao completa. Dividas geradas/atualizadas: " + generated + " de " + debts.size());
    }

    @PostMapping("/recompute-status")
    public ResponseEntity<String> recomputeStatus() {
        LocalDate today = LocalDate.now();
        List<DebtReorganization> debts = repo.findAll();
        List<Transaction> allTx = txRepo.findAll();
        int updated = 0;
        for (DebtReorganization debt : debts) {
            if (Boolean.TRUE.equals(debt.getPerennial())) continue;
            int total = debt.getTotalInstallments() != null ? debt.getTotalInstallments() : 0;
            if (total == 0) continue;
            int paid = debt.getPaidInstallments() != null ? debt.getPaidInstallments() : 0;
            LocalDate startDate = debt.getStartDate() != null ? debt.getStartDate() : today;
            String marker = "Gerado automaticamente da divida: " + debt.getDescription();
            Map<Integer, TransactionStatus> txStatusByNum = new HashMap<>();
            allTx.stream()
                .filter(t -> marker.equals(t.getNotes()) && t.getInstallmentNumber() != null)
                .forEach(t -> txStatusByNum.put(t.getInstallmentNumber(), t.getStatus()));
            long computedPaid = 0;
            for (int i = 1; i <= total; i++) {
                TransactionStatus txStatus = txStatusByNum.get(i);
                if (txStatus == TransactionStatus.PAID)      computedPaid++;
                else if (txStatus == null && i <= paid)      computedPaid++;
            }
            int newPaid = (int) Math.min(computedPaid, total);
            TransactionStatus newStatus;
            if (newPaid >= total) {
                newStatus = TransactionStatus.PAID;
            } else {
                LocalDate nextDue = startDate.plusMonths(newPaid);
                newStatus = nextDue.isBefore(today) ? TransactionStatus.OVERDUE : TransactionStatus.PENDING;
            }
            if (newPaid != paid && total > 0 && debt.getOriginalAmount() != null) {
                BigDecimal installAmt = debt.getOriginalAmount().divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
                debt.setRemainingAmount(installAmt.multiply(BigDecimal.valueOf(total - newPaid)));
            }
            if (newStatus != debt.getStatus() || newPaid != paid) {
                debt.setStatus(newStatus);
                debt.setPaidInstallments(newPaid);
                repo.save(debt);
                updated++;
            }
        }
        List<Transaction> toUpdate = allTx.stream()
            .filter(t -> t.getStatus() == TransactionStatus.PENDING && t.getDate() != null && t.getDate().isBefore(today))
            .toList();
        for (Transaction t : toUpdate) t.setStatus(TransactionStatus.OVERDUE);
        if (!toUpdate.isEmpty()) txRepo.saveAll(toUpdate);
        repo.findAll().stream()
            .map(d -> d.getCreditCard() != null ? d.getCreditCard().getId() : null)
            .filter(Objects::nonNull).distinct().forEach(this::recomputeCardUsedLimit);
        return ResponseEntity.ok("Status recalculado: " + updated + " dividas atualizadas, " + toUpdate.size() + " transacoes marcadas como OVERDUE");
    }

    // ── INSTALLMENTS ─────────────────────────────────────────────────────────

    @GetMapping("/{id}/installments")
    public ResponseEntity<List<Map<String, Object>>> getInstallments(@PathVariable Long id) {
        return repo.findById(id).map(debt -> {
            LocalDate today = LocalDate.now();
            int total = debt.getTotalInstallments() != null ? debt.getTotalInstallments() : 0;
            int paid  = debt.getPaidInstallments()  != null ? debt.getPaidInstallments()  : 0;
            LocalDate startDate = debt.getStartDate() != null ? debt.getStartDate() : today;
            BigDecimal installAmt = total > 0
                ? debt.getOriginalAmount().divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            String marker = "Gerado automaticamente da divida: " + debt.getDescription();
            Map<Integer, TransactionStatus> txStatusByNum = new HashMap<>();
            txRepo.findAll().stream()
                .filter(t -> marker.equals(t.getNotes()) && t.getInstallmentNumber() != null)
                .forEach(t -> txStatusByNum.put(t.getInstallmentNumber(), t.getStatus()));
            List<Map<String, Object>> result = new ArrayList<>();
            for (int i = 0; i < total; i++) {
                LocalDate due = startDate.plusMonths(i);
                int num = i + 1;
                TransactionStatus txStatus = txStatusByNum.get(num);
                String status;
                if      (txStatus == TransactionStatus.PAID)    status = "PAID";
                else if (txStatus == TransactionStatus.OVERDUE) status = "OVERDUE";
                else if (txStatus == TransactionStatus.PENDING) status = "PENDING";
                else if (num <= paid)                           status = "PAID";
                else    status = due.isBefore(today) ? "OVERDUE" : "PENDING";
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("installmentNumber", num);
                row.put("dueDate", due.toString());
                row.put("amount", installAmt);
                row.put("status", status);
                result.add(row);
            }
            return ResponseEntity.ok(result);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/installments/{num}")
    public ResponseEntity<Map<String, Object>> patchInstallment(
            @PathVariable Long id,
            @PathVariable int num,
            @RequestBody Map<String, String> body) {
        return repo.findById(id).map(debt -> {
            TransactionStatus newTxStatus;
            try { newTxStatus = TransactionStatus.valueOf(body.getOrDefault("status", "PAID")); }
            catch (Exception e) { newTxStatus = TransactionStatus.PAID; }
            final TransactionStatus finalStatus = newTxStatus;
            String marker = "Gerado automaticamente da divida: " + debt.getDescription();
            LocalDate today = LocalDate.now();
            int total = debt.getTotalInstallments() != null ? debt.getTotalInstallments() : 0;
            LocalDate startDate = debt.getStartDate() != null ? debt.getStartDate() : today;
            List<Transaction> allTx = txRepo.findAll();
            Transaction tx = allTx.stream()
                .filter(t -> marker.equals(t.getNotes())
                          && num == (t.getInstallmentNumber() != null ? t.getInstallmentNumber() : -1))
                .findFirst().orElseGet(() -> {
                    Category debtCat = getDebtCategory();
                    BigDecimal amt = total > 0
                        ? debt.getOriginalAmount().divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP)
                        : debt.getOriginalAmount();
                    return Transaction.builder()
                        .date(startDate.plusMonths(num - 1))
                        .description(debt.getDescription() + " - Parcela " + num + "/" + total)
                        .amount(amt).type(TransactionType.EXPENSE)
                        .status(TransactionStatus.PENDING).isRecurring(false)
                        .installmentNumber(num).category(debtCat).notes(marker)
                        .bankAccount(debt.getBankAccount()).creditCard(debt.getCreditCard())
                        .build();
                });
            tx.setStatus(finalStatus);
            txRepo.save(tx);
            // Recompute paid count: explicit tx wins, fallback for untouched installments
            Map<Integer, TransactionStatus> txStatusByNum = new HashMap<>();
            txRepo.findAll().stream()
                .filter(t -> marker.equals(t.getNotes()) && t.getInstallmentNumber() != null)
                .forEach(t -> txStatusByNum.put(t.getInstallmentNumber(), t.getStatus()));
            int storedPaid = debt.getPaidInstallments() != null ? debt.getPaidInstallments() : 0;
            long explicitPaid = txStatusByNum.values().stream().filter(s -> s == TransactionStatus.PAID).count();
            long fallbackPaid = 0;
            for (int i = 1; i <= storedPaid && i <= total; i++) {
                if (!txStatusByNum.containsKey(i)) fallbackPaid++;
            }
            int newPaid = (int) Math.min(explicitPaid + fallbackPaid, total);
            debt.setPaidInstallments(newPaid);
            if (total > 0 && debt.getOriginalAmount() != null) {
                BigDecimal amt = debt.getOriginalAmount().divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
                debt.setRemainingAmount(amt.multiply(BigDecimal.valueOf(total - newPaid)));
            }
            if (newPaid >= total && total > 0) {
                debt.setStatus(TransactionStatus.PAID);
            } else {
                LocalDate nextDue = startDate.plusMonths(newPaid);
                debt.setStatus(nextDue.isBefore(today) ? TransactionStatus.OVERDUE : TransactionStatus.PENDING);
            }
            repo.save(debt);
            recomputeCardUsedLimit(debt.getCreditCard() != null ? debt.getCreditCard().getId() : null);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("debtId", debt.getId());
            resp.put("installmentNumber", num);
            resp.put("newStatus", finalStatus.name());
            resp.put("paidInstallments", debt.getPaidInstallments());
            resp.put("remainingAmount", debt.getRemainingAmount());
            resp.put("debtStatus", debt.getStatus().name());
            return ResponseEntity.ok(resp);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── MISC ─────────────────────────────────────────────────────────────────

    @PostMapping("/patch-categories")
    public ResponseEntity<String> patchCategories() {
        Category debtCat = getDebtCategory();
        if (debtCat == null) return ResponseEntity.ok("Categoria 'Dividas' nao encontrada.");
        List<Transaction> toUpdate = txRepo.findAll().stream()
            .filter(t -> t.getCategory() == null && t.getNotes() != null
                && (t.getNotes().startsWith("Gerado automaticamente da divida:")
                    || t.getNotes().startsWith("Conta perene gerada automaticamente:")))
            .toList();
        toUpdate.forEach(t -> t.setCategory(debtCat));
        if (!toUpdate.isEmpty()) txRepo.saveAll(toUpdate);
        return ResponseEntity.ok("Categoria atribuida a " + toUpdate.size() + " transacoes.");
    }

    @PostMapping("/send-reminders")
    public ResponseEntity<String> sendReminders() {
        return ResponseEntity.ok("Lembretes enviados: " + doSendReminders());
    }

    @Scheduled(cron = "0 0 8 * * *")
    public void scheduledDailyReminders() {
        System.out.println("[Scheduler] " + doSendReminders() + " lembretes enviados.");
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

    private Category getDebtCategory() {
        return categoryRepo.findAll().stream()
            .filter(c -> "Dívidas".equals(c.getName())).findFirst().orElse(null);
    }

    private void recomputeCardUsedLimit(Long cardId) {
        if (cardId == null) return;
        cardRepo.findById(cardId).ifPresent(card -> {
            BigDecimal used = repo.findByCreditCardId(cardId).stream()
                .filter(d -> d.getStatus() != TransactionStatus.PAID)
                .map(d -> d.getRemainingAmount() != null ? d.getRemainingAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            card.setUsedLimit(used);
            cardRepo.save(card);
        });
    }

    private int doSendReminders() {
        LocalDate today = LocalDate.now();
        int count = 0;
        for (DebtReorganization debt : repo.findAll()) {
            if (debt.getStatus() == TransactionStatus.PAID) continue;
            boolean isDueToday = false;
            if (Boolean.TRUE.equals(debt.getPerennial()) && debt.getDueDayOfMonth() != null) {
                isDueToday = today.getDayOfMonth() == debt.getDueDayOfMonth();
            } else if (debt.getStartDate() != null && debt.getTotalInstallments() != null) {
                int paid = debt.getPaidInstallments() != null ? debt.getPaidInstallments() : 0;
                if (debt.getTotalInstallments() - paid > 0)
                    isDueToday = debt.getStartDate().plusMonths(paid).equals(today);
            }
            if (!isDueToday) continue;
            BigDecimal valor = Boolean.TRUE.equals(debt.getPerennial()) ? debt.getOriginalAmount()
                : debt.getRemainingAmount().divide(BigDecimal.valueOf(
                    Math.max(1, debt.getTotalInstallments() - (debt.getPaidInstallments() != null ? debt.getPaidInstallments() : 0))),
                    2, RoundingMode.HALF_UP);
            sendWhatsApp(String.format("VENCIMENTO HOJE: %s - Valor: R$ %.2f - PENDENTE - MoneyControl",
                debt.getDescription(), valor));
            count++;
        }
        return count;
    }

    private void sendWhatsApp(String message) {
        if (callMeBotApiKey == null || callMeBotApiKey.isBlank()) {
            System.out.println("[WhatsApp] Key nao configurada: " + message); return;
        }
        try {
            String phone = whatsappPhone.replace("+","").replace("-","").replace(" ","");
            String encoded = java.net.URLEncoder.encode(message, "UTF-8");
            new RestTemplate().getForObject(
                "https://api.callmebot.com/whatsapp.php?phone=" + phone + "&text=" + encoded + "&apikey=" + callMeBotApiKey,
                String.class);
        } catch (Exception e) { System.err.println("[WhatsApp] Falha: " + e.getMessage()); }
    }

    private void generatePerennialTransactions(DebtReorganization debt, Category debtCat) {
        LocalDate start = debt.getPerennialStartDate() != null ? debt.getPerennialStartDate() : LocalDate.now();
        int dueDay = debt.getDueDayOfMonth() != null ? debt.getDueDayOfMonth() : start.getDayOfMonth();
        YearMonth ymStart = YearMonth.from(start);
        LocalDate end = start.plusMonths(24);
        List<Transaction> creates = new ArrayList<>();
        for (int i = 0; ymStart.plusMonths(i).atDay(1).isBefore(end); i++) {
            YearMonth ym = ymStart.plusMonths(i);
            LocalDate due = ym.atDay(Math.min(dueDay, ym.lengthOfMonth()));
            creates.add(Transaction.builder().date(due)
                .description("PERENE " + debt.getDescription()).amount(debt.getOriginalAmount())
                .type(TransactionType.EXPENSE)
                .status(due.isBefore(LocalDate.now()) ? TransactionStatus.OVERDUE : TransactionStatus.PENDING)
                .isRecurring(true).category(debtCat)
                .notes("Conta perene gerada automaticamente: " + debt.getDescription())
                .bankAccount(debt.getBankAccount()).creditCard(debt.getCreditCard()).build());
        }
        txRepo.saveAll(creates);
    }

    private void generateInstallmentTransactions(DebtReorganization debt, Category debtCat) {
        int total = debt.getTotalInstallments();
        int paid  = debt.getPaidInstallments() != null ? debt.getPaidInstallments() : 0;
        if (total - paid <= 0) return;
        BigDecimal installAmt = debt.getOriginalAmount().divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        LocalDate startDate = debt.getStartDate() != null ? debt.getStartDate() : LocalDate.now();
        String marker = "Gerado automaticamente da divida: " + debt.getDescription();
        List<Transaction> creates = new ArrayList<>();
        for (int i = paid; i < total; i++) {
            LocalDate due = startDate.plusMonths(i);
            creates.add(Transaction.builder().date(due)
                .description(debt.getDescription() + " - Parcela " + (i+1) + "/" + total)
                .amount(installAmt).type(TransactionType.EXPENSE)
                .status(due.isBefore(LocalDate.now()) ? TransactionStatus.OVERDUE : TransactionStatus.PENDING)
                .isRecurring(false).installmentNumber(i + 1).category(debtCat).notes(marker)
                .bankAccount(debt.getBankAccount()).creditCard(debt.getCreditCard()).build());
        }
        txRepo.saveAll(creates);
    }

    private int generateMissingInstallments(DebtReorganization debt, List<Transaction> allTx, Category debtCat) {
        int total = debt.getTotalInstallments();
        if (total <= 0) return 0;
        int paid = debt.getPaidInstallments() != null ? debt.getPaidInstallments() : 0;
        BigDecimal installAmt = debt.getOriginalAmount().divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        LocalDate startDate = debt.getStartDate() != null ? debt.getStartDate() : LocalDate.now();
        String marker = "Gerado automaticamente da divida: " + debt.getDescription();
        Set<Integer> existing = new HashSet<>();
        allTx.stream().filter(t -> marker.equals(t.getNotes()) && t.getInstallmentNumber() != null)
            .forEach(t -> existing.add(t.getInstallmentNumber()));
        allTx.stream().filter(t -> t.getDescription() != null
                && t.getDescription().startsWith(debt.getDescription() + " - Parcela ")
                && t.getInstallmentNumber() != null)
            .forEach(t -> existing.add(t.getInstallmentNumber()));
        List<Transaction> creates = new ArrayList<>();
        for (int i = paid; i < total; i++) {
            int installNum = i + 1;
            if (existing.contains(installNum)) continue;
            LocalDate due = startDate.plusMonths(i);
            creates.add(Transaction.builder().date(due)
                .description(debt.getDescription() + " - Parcela " + installNum + "/" + total)
                .amount(installAmt).type(TransactionType.EXPENSE)
                .status(due.isBefore(LocalDate.now()) ? TransactionStatus.OVERDUE : TransactionStatus.PENDING)
                .isRecurring(false).installmentNumber(installNum).category(debtCat).notes(marker)
                .bankAccount(debt.getBankAccount()).creditCard(debt.getCreditCard()).build());
        }
        if (!creates.isEmpty()) txRepo.saveAll(creates);
        return creates.size();
    }
}
