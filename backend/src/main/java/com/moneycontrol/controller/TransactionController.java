package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {
    private final TransactionRepository repo;
    private final InstallmentGroupRepository installmentGroupRepo;

    @GetMapping
    public List<Transaction> getAll(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) Long accountId,
            @RequestParam(required = false) Long cardId) {
        LocalDate s = start != null ? LocalDate.parse(start) : LocalDate.now().minusMonths(3);
        LocalDate e = end != null ? LocalDate.parse(end) : LocalDate.now().plusMonths(1);
        if (accountId != null) return repo.findByBankAccountIdAndDateBetweenOrderByDateDesc(accountId, s, e);
        if (cardId != null) return repo.findByCreditCardIdAndDateBetweenOrderByDateDesc(cardId, s, e);
        return repo.findByDateBetweenOrderByDateDesc(s, e);
    }

    @GetMapping("/overdue")
    public List<Transaction> getOverdue() {
        return repo.findOverdue(LocalDate.now());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Transaction> getById(@PathVariable Long id) {
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Transaction create(@RequestBody Transaction t) {
        return repo.save(t);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Transaction> update(@PathVariable Long id, @RequestBody Transaction t) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        t.setId(id);
        return ResponseEntity.ok(repo.save(t));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Transaction> updateStatus(@PathVariable Long id, @RequestParam TransactionStatus status) {
        return repo.findById(id).map(t -> { t.setStatus(status); return ResponseEntity.ok(repo.save(t)); })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
