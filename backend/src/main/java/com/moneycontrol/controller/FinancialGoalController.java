package com.moneycontrol.controller;

import com.moneycontrol.model.FinancialGoal;
import com.moneycontrol.repository.FinancialGoalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class FinancialGoalController {
    private final FinancialGoalRepository repo;

    @GetMapping public List<FinancialGoal> getAll() { return repo.findAll(); }
    @PostMapping public FinancialGoal create(@RequestBody FinancialGoal g) { return repo.save(g); }
    @PutMapping("/{id}") public ResponseEntity<FinancialGoal> update(@PathVariable Long id, @RequestBody FinancialGoal g) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        g.setId(id); return ResponseEntity.ok(repo.save(g));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
