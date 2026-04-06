package com.moneycontrol.controller;

import com.moneycontrol.model.ProfitDistributionRule;
import com.moneycontrol.repository.ProfitDistributionRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/distribution-rules")
@RequiredArgsConstructor
public class ProfitDistributionController {
    private final ProfitDistributionRuleRepository repo;

    @GetMapping public List<ProfitDistributionRule> getAll() { return repo.findAll(); }
    @PostMapping public ProfitDistributionRule create(@RequestBody ProfitDistributionRule r) { return repo.save(r); }
    @PutMapping("/{id}") public ResponseEntity<ProfitDistributionRule> update(@PathVariable Long id, @RequestBody ProfitDistributionRule r) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        r.setId(id); return ResponseEntity.ok(repo.save(r));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
