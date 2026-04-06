package com.moneycontrol.controller;

import com.moneycontrol.model.BankAccount;
import com.moneycontrol.repository.BankAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class BankAccountController {
    private final BankAccountRepository repo;

    @GetMapping public List<BankAccount> getAll() { return repo.findAll(); }
    @GetMapping("/{id}") public ResponseEntity<BankAccount> getById(@PathVariable Long id) {
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
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
