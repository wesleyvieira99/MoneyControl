package com.moneycontrol.controller;

import com.moneycontrol.model.CreditCard;
import com.moneycontrol.repository.CreditCardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/cards")
@RequiredArgsConstructor
public class CreditCardController {
    private final CreditCardRepository repo;

    @GetMapping public List<CreditCard> getAll() { return repo.findAll(); }
    @GetMapping("/{id}") public ResponseEntity<CreditCard> getById(@PathVariable Long id) {
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }
    @PostMapping public CreditCard create(@RequestBody CreditCard c) { return repo.save(c); }
    @PutMapping("/{id}") public ResponseEntity<CreditCard> update(@PathVariable Long id, @RequestBody CreditCard c) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        c.setId(id); return ResponseEntity.ok(repo.save(c));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
