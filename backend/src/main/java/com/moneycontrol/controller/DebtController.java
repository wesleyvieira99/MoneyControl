package com.moneycontrol.controller;

import com.moneycontrol.model.DebtReorganization;
import com.moneycontrol.repository.DebtReorganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/debts")
@RequiredArgsConstructor
public class DebtController {
    private final DebtReorganizationRepository repo;

    @GetMapping public List<DebtReorganization> getAll() { return repo.findAll(); }
    @PostMapping public DebtReorganization create(@RequestBody DebtReorganization d) { return repo.save(d); }
    @PutMapping("/{id}") public ResponseEntity<DebtReorganization> update(@PathVariable Long id, @RequestBody DebtReorganization d) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        d.setId(id); return ResponseEntity.ok(repo.save(d));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
