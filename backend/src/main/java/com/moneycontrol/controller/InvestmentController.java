package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/investments")
@RequiredArgsConstructor
public class InvestmentController {
    private final InvestmentRepository repo;
    private final InvestmentTransactionRepository txRepo;

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
        return repo.findById(id).map(inv -> { tx.setInvestment(inv); return txRepo.save(tx); })
                .orElseThrow();
    }
}
