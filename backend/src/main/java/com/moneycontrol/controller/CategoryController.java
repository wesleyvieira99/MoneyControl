package com.moneycontrol.controller;

import com.moneycontrol.model.Category;
import com.moneycontrol.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryRepository repo;

    @GetMapping public List<Category> getAll() { return repo.findAll(); }
    @PostMapping public Category create(@RequestBody Category c) { return repo.save(c); }
    @PutMapping("/{id}") public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category c) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        c.setId(id); return ResponseEntity.ok(repo.save(c));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
