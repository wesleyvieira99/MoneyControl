package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/investments")
@RequiredArgsConstructor
public class InvestmentController {
    private final InvestmentRepository repo;
    private final InvestmentTransactionRepository txRepo;
    private final TransactionRepository transactionRepo;
    private final CategoryRepository categoryRepo;

    @GetMapping public List<Investment> getAll() { return repo.findAll(); }
    @GetMapping("/{id}") public ResponseEntity<Investment> getById(@PathVariable Long id) {
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }
    @PostMapping public Investment create(@RequestBody Investment i) { return repo.save(i); }
    @PutMapping("/{id}") public ResponseEntity<Investment> update(@PathVariable Long id, @RequestBody Investment i) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        i.setId(id); return ResponseEntity.ok(repo.save(i));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/transactions")
    public List<InvestmentTransaction> getTransactions(@PathVariable Long id) {
        return txRepo.findByInvestmentIdOrderByDateDesc(id);
    }

    @PostMapping("/{id}/transactions")
    public InvestmentTransaction addTransaction(@PathVariable Long id, @RequestBody InvestmentTransaction tx) {
        return repo.findById(id).map(inv -> {
                    tx.setInvestment(inv);
                    InvestmentTransaction saved = txRepo.save(tx);
                    applyToInvestment(inv, saved);
                    mirrorToTransactions(inv, saved);
                    return saved;
                })
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Investment not found: " + id));
    }

    private void applyToInvestment(Investment inv, InvestmentTransaction tx) {
        BigDecimal amount = tx.getAmount() != null ? tx.getAmount() : BigDecimal.ZERO;
        BigDecimal current = inv.getCurrentValue() != null ? inv.getCurrentValue() : BigDecimal.ZERO;
        BigDecimal initial = inv.getInitialAmount() != null ? inv.getInitialAmount() : BigDecimal.ZERO;
        if (tx.getType() == InvestmentTransactionType.DEPOSIT) {
            inv.setCurrentValue(current.add(amount));
            inv.setInitialAmount(initial.add(amount));
        } else if (tx.getType() == InvestmentTransactionType.WITHDRAWAL) {
            inv.setCurrentValue(current.subtract(amount).max(BigDecimal.ZERO));
            inv.setInitialAmount(initial.subtract(amount).max(BigDecimal.ZERO));
        } else if (tx.getType() == InvestmentTransactionType.YIELD ||
                tx.getType() == InvestmentTransactionType.DIVIDEND ||
                tx.getType() == InvestmentTransactionType.BONUS) {
            inv.setCurrentValue(current.add(amount));
        }
        repo.save(inv);
    }

    private void mirrorToTransactions(Investment inv, InvestmentTransaction tx) {
        if (tx.getType() != InvestmentTransactionType.DEPOSIT && tx.getType() != InvestmentTransactionType.WITHDRAWAL) return;
        String marker = "[INVESTMENT_TX:" + tx.getId() + "]";
        boolean exists = transactionRepo.existsByNotesContaining(marker);
        if (exists) return;

        Category category = tx.getType() == InvestmentTransactionType.DEPOSIT
                ? ensureCategory("Aportes", CategoryType.EXPENSE, "#8B5CF6", "💸")
                : ensureCategory("Retiradas", CategoryType.INCOME, "#10B981", "📈");

        Transaction mirror = Transaction.builder()
                .date(tx.getDate())
                .description("Investimentos")
                .amount(tx.getAmount() != null ? tx.getAmount() : BigDecimal.ZERO)
                .type(tx.getType() == InvestmentTransactionType.DEPOSIT ? TransactionType.EXPENSE : TransactionType.INCOME)
                .category(category)
                .bankAccount(inv.getBankAccount())
                .status(TransactionStatus.PAID)
                .isRecurring(false)
                .notes((marker + " Investimento: " + inv.getName() + ". " + (tx.getNotes() != null ? tx.getNotes() : "")).trim())
                .build();
        transactionRepo.save(mirror);
    }

    private Category ensureCategory(String name, CategoryType type, String color, String icon) {
        return categoryRepo.findAll().stream()
                .filter(c -> c.getName() != null && c.getName().equalsIgnoreCase(name) && c.getType() == type)
                .findFirst()
                .orElseGet(() -> categoryRepo.save(Category.builder()
                        .name(name)
                        .type(type)
                        .color(color)
                        .icon(icon)
                        .build()));
    }
}
