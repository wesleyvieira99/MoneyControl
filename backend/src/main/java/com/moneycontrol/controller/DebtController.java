package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.CreditCardRepository;
import com.moneycontrol.repository.DebtReorganizationRepository;
import com.moneycontrol.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/debts")
@RequiredArgsConstructor
public class DebtController {
    private final DebtReorganizationRepository repo;
    private final TransactionRepository txRepo;
    private final CreditCardRepository cardRepo;

    @GetMapping public List<DebtReorganization> getAll() { return repo.findAll(); }
    @GetMapping("/by-account/{accountId}") public List<DebtReorganization> getByAccount(@PathVariable Long accountId) { return repo.findByBankAccountId(accountId); }
    @GetMapping("/by-card/{cardId}") public List<DebtReorganization> getByCard(@PathVariable Long cardId) { return repo.findByCreditCardId(cardId); }
    @PostMapping public DebtReorganization create(@RequestBody DebtReorganization d) {
        DebtReorganization saved = repo.save(d);
        syncTransactionsForDebt(saved);
        recomputeCardUsedLimit(saved.getCreditCard() != null ? saved.getCreditCard().getId() : null);
        return saved;
    }
    @PutMapping("/{id}") public ResponseEntity<DebtReorganization> update(@PathVariable Long id, @RequestBody DebtReorganization d) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        d.setId(id);
        DebtReorganization saved = repo.save(d);
        syncTransactionsForDebt(saved);
        recomputeCardUsedLimit(saved.getCreditCard() != null ? saved.getCreditCard().getId() : null);
        return ResponseEntity.ok(saved);
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        Optional<DebtReorganization> debt = repo.findById(id);
        if (debt.isEmpty()) return ResponseEntity.notFound().build();
        String markerPrefix = markerPrefix(id);
        txRepo.findByNotesContaining(markerPrefix).forEach(txRepo::delete);
        Long cardId = debt.get().getCreditCard() != null ? debt.get().getCreditCard().getId() : null;
        repo.deleteById(id);
        recomputeCardUsedLimit(cardId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sync-transactions")
    public ResponseEntity<Map<String, Object>> syncTransactions() {
        List<DebtReorganization> debts = repo.findAll();
        debts.forEach(this::syncTransactionsForDebt);
        debts.stream()
                .map(d -> d.getCreditCard() != null ? d.getCreditCard().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(this::recomputeCardUsedLimit);
        return ResponseEntity.ok(Map.of("message", "Parcelas sincronizadas em transações.", "count", debts.size()));
    }

    @PostMapping("/recompute-status")
    public ResponseEntity<Map<String, Object>> recomputeStatus() {
        repo.findAll().forEach(d -> {
            updateDebtStatusAndRemaining(d);
            repo.save(d);
        });
        return ResponseEntity.ok(Map.of("message", "Status das dívidas recalculado."));
    }

    @PostMapping("/patch-categories")
    public ResponseEntity<Map<String, Object>> patchCategories() {
        return ResponseEntity.ok(Map.of("message", "Sem categorias pendentes para atualização."));
    }

    @PostMapping("/send-reminders")
    public ResponseEntity<Map<String, Object>> sendReminders() {
        return ResponseEntity.ok(Map.of("message", "Lembretes simulados com sucesso."));
    }

    @GetMapping("/{id}/installments")
    public ResponseEntity<List<Map<String, Object>>> getInstallments(@PathVariable Long id) {
        return repo.findById(id)
                .map(d -> ResponseEntity.ok(buildInstallments(d)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/installments/{installmentNumber}")
    public ResponseEntity<Map<String, Object>> patchInstallment(
            @PathVariable Long id,
            @PathVariable Integer installmentNumber,
            @RequestBody Map<String, String> body) {
        return repo.findById(id).map(d -> {
            int total = d.getTotalInstallments() != null ? d.getTotalInstallments() : 0;
            if (installmentNumber < 1 || installmentNumber > total) {
                return ResponseEntity.badRequest().body(Map.of("error", "Installment out of range"));
            }
            String status = body.getOrDefault("status", "PENDING");
            int paid = d.getPaidInstallments() != null ? d.getPaidInstallments() : 0;
            if ("PAID".equalsIgnoreCase(status)) {
                paid = Math.max(paid, installmentNumber);
            } else {
                paid = Math.min(paid, installmentNumber - 1);
            }
            d.setPaidInstallments(Math.max(0, Math.min(total, paid)));
            updateDebtStatusAndRemaining(d);
            DebtReorganization saved = repo.save(d);
            syncTransactionsForDebt(saved);
            recomputeCardUsedLimit(saved.getCreditCard() != null ? saved.getCreditCard().getId() : null);
            return ResponseEntity.ok(Map.of(
                    "paidInstallments", saved.getPaidInstallments(),
                    "remainingAmount", saved.getRemainingAmount(),
                    "debtStatus", saved.getStatus()
            ));
        }).orElse(ResponseEntity.notFound().build());
    }

    private List<Map<String, Object>> buildInstallments(DebtReorganization d) {
        int total = d.getTotalInstallments() != null ? d.getTotalInstallments() : 0;
        int paid = d.getPaidInstallments() != null ? d.getPaidInstallments() : 0;
        BigDecimal original = d.getOriginalAmount() != null ? d.getOriginalAmount() : BigDecimal.ZERO;
        LocalDate start = d.getStartDate() != null ? d.getStartDate() : LocalDate.now();
        BigDecimal installmentAmount = total > 0 ? original.divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 1; i <= total; i++) {
            LocalDate dueDate = start.plusMonths(i - 1L);
            String status = i <= paid ? "PAID" : (dueDate.isBefore(today) ? "OVERDUE" : "PENDING");
            out.add(new LinkedHashMap<>(Map.of(
                    "installmentNumber", i,
                    "amount", installmentAmount,
                    "dueDate", dueDate,
                    "status", status
            )));
        }
        return out;
    }

    private void syncTransactionsForDebt(DebtReorganization d) {
        if (d.getTotalInstallments() == null || d.getTotalInstallments() <= 0 || d.getStartDate() == null) return;
        List<Map<String, Object>> installments = buildInstallments(d);
        for (Map<String, Object> installment : installments) {
            Integer num = (Integer) installment.get("installmentNumber");
            String marker = marker(d.getId(), num);
            Transaction tx = txRepo.findByNotesContaining(marker).stream().findFirst().orElse(null);
            if (tx == null) tx = new Transaction();
            tx.setDate((LocalDate) installment.get("dueDate"));
            tx.setDescription("📋 " + d.getDescription() + " - Parcela " + num + "/" + d.getTotalInstallments());
            tx.setAmount((BigDecimal) installment.get("amount"));
            tx.setType(TransactionType.EXPENSE);
            tx.setBankAccount(d.getBankAccount());
            tx.setCreditCard(d.getCreditCard());
            tx.setInstallmentNumber(num);
            tx.setStatus(TransactionStatus.valueOf((String) installment.get("status")));
            tx.setIsRecurring(false);
            tx.setNotes((marker + " Parcela gerada automaticamente da dívida \"" + d.getDescription() + "\".").trim());
            txRepo.save(tx);
        }
    }

    private void updateDebtStatusAndRemaining(DebtReorganization d) {
        int total = d.getTotalInstallments() != null ? d.getTotalInstallments() : 0;
        int paid = d.getPaidInstallments() != null ? d.getPaidInstallments() : 0;
        BigDecimal original = d.getOriginalAmount() != null ? d.getOriginalAmount() : BigDecimal.ZERO;
        if (total <= 0) {
            d.setRemainingAmount(original);
            d.setStatus(TransactionStatus.PENDING);
            return;
        }
        BigDecimal installment = original.divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        BigDecimal remaining = original.subtract(installment.multiply(BigDecimal.valueOf(paid))).max(BigDecimal.ZERO);
        d.setRemainingAmount(remaining);
        if (paid >= total) {
            d.setStatus(TransactionStatus.PAID);
            return;
        }
        LocalDate nextDue = d.getStartDate() != null ? d.getStartDate().plusMonths(paid) : LocalDate.now();
        d.setStatus(nextDue.isBefore(LocalDate.now()) ? TransactionStatus.OVERDUE : TransactionStatus.PENDING);
    }

    private String markerPrefix(Long debtId) {
        return "[DEBT_INSTALLMENT:" + debtId + ":";
    }

    private String marker(Long debtId, Integer installment) {
        return markerPrefix(debtId) + installment + "]";
    }

    private void recomputeCardUsedLimit(Long cardId) {
        if (cardId == null) return;
        cardRepo.findById(cardId).ifPresent(card -> {
            BigDecimal used = repo.findByCreditCardId(cardId).stream()
                    .map(d -> d.getRemainingAmount() != null ? d.getRemainingAmount() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            card.setUsedLimit(used);
            cardRepo.save(card);
        });
    }
}
