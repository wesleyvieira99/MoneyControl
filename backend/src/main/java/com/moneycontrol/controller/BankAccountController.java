package com.moneycontrol.controller;

import com.moneycontrol.model.BankAccount;
import com.moneycontrol.repository.CreditCardRepository;
import com.moneycontrol.repository.DebtReorganizationRepository;
import com.moneycontrol.repository.BankAccountRepository;
import com.moneycontrol.repository.InvestmentRepository;
import com.moneycontrol.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class BankAccountController {
    private final BankAccountRepository repo;
    private final TransactionRepository txRepo;
    private final CreditCardRepository cardRepo;
    private final InvestmentRepository investmentRepo;
    private final DebtReorganizationRepository debtRepo;

    @GetMapping public List<BankAccount> getAll() { return repo.findAll(); }
    @GetMapping("/{id}") public ResponseEntity<BankAccount> getById(@PathVariable Long id) {
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }
    @GetMapping("/{id}/transactions")
    public List<?> getAccountTransactions(@PathVariable Long id) {
        return txRepo.findByBankAccountIdOrderByDateDesc(id);
    }
    @GetMapping("/{id}/card-transactions")
    public List<?> getCardTransactions(@PathVariable Long id) {
        return txRepo.findByCreditCardBankAccountIdOrderByDateDesc(id);
    }
    @GetMapping("/{id}/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "cards", cardRepo.findByBankAccountId(id),
                "investments", investmentRepo.findByBankAccountId(id),
                "debts", debtRepo.findByBankAccountId(id)
        ));
    }
    @PostMapping public BankAccount create(@RequestBody BankAccount a) { return repo.save(a); }
    @PutMapping("/{id}") public ResponseEntity<BankAccount> update(@PathVariable Long id, @RequestBody BankAccount a) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        a.setId(id); return ResponseEntity.ok(repo.save(a));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
