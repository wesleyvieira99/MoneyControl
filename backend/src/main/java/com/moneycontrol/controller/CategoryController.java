package com.moneycontrol.controller;

import com.moneycontrol.model.Category;
import com.moneycontrol.model.MonthlyBudget;
import com.moneycontrol.model.Transaction;
import com.moneycontrol.repository.CategoryRepository;
import com.moneycontrol.repository.MonthlyBudgetRepository;
import com.moneycontrol.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryRepository repo;
    private final TransactionRepository transactionRepo;
    private final MonthlyBudgetRepository budgetRepo;

    @GetMapping
    public List<Category> getAll() { return repo.findAll(); }

    @PostMapping
    public Category create(@RequestBody Category c) { return repo.save(c); }

    @PutMapping("/{id}")
    public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category c) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        c.setId(id); return ResponseEntity.ok(repo.save(c));
    }

    @GetMapping("/{id}/usage")
    public ResponseEntity<Map<String, Object>> getUsage(@PathVariable Long id) {
        Optional<Category> catOpt = repo.findById(id);
        if (catOpt.isEmpty()) return ResponseEntity.notFound().build();
        Category cat = catOpt.get();

        List<Transaction> txs = transactionRepo.findByCategoryId(id);
        List<MonthlyBudget> budgets = budgetRepo.findByCategoryName(cat.getName());

        List<Map<String, Object>> txItems = txs.stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("type", "TRANSACTION");
            m.put("description", t.getDescription());
            m.put("amount", t.getAmount());
            m.put("date", t.getDate() != null ? t.getDate().toString() : null);
            return m;
        }).collect(Collectors.toList());

        List<Map<String, Object>> budgetItems = budgets.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("type", "BUDGET");
            m.put("description", b.getCategoryName() + " (" + b.getMonth() + ")");
            m.put("amount", b.getBudgetAmount());
            m.put("month", b.getMonth());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categoryId", id);
        result.put("categoryName", cat.getName());
        result.put("transactions", txItems);
        result.put("budgets", budgetItems);
        result.put("totalAffected", txItems.size() + budgetItems.size());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/replace-and-delete")
    @Transactional
    public ResponseEntity<Void> replaceAndDelete(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body) {
        Long replacementId = body.get("replacementCategoryId");
        if (replacementId == null) return ResponseEntity.badRequest().build();

        Optional<Category> oldOpt = repo.findById(id);
        Optional<Category> newOpt = repo.findById(replacementId);
        if (oldOpt.isEmpty() || newOpt.isEmpty()) return ResponseEntity.notFound().build();

        Category oldCat = oldOpt.get();
        Category newCat = newOpt.get();

        // Replace category in all transactions
        List<Transaction> txs = transactionRepo.findByCategoryId(id);
        for (Transaction t : txs) {
            t.setCategory(newCat);
        }
        transactionRepo.saveAll(txs);
        transactionRepo.flush();

        // Replace category name/icon/color in all budgets
        List<MonthlyBudget> budgets = budgetRepo.findByCategoryName(oldCat.getName());
        for (MonthlyBudget b : budgets) {
            b.setCategoryName(newCat.getName());
            b.setCategoryIcon(newCat.getIcon());
            b.setCategoryColor(newCat.getColor());
        }
        budgetRepo.saveAll(budgets);
        budgetRepo.flush();

        // Now safe to delete
        repo.deleteById(id);
        repo.flush();
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Optional<Category> catOpt = repo.findById(id);
        if (catOpt.isEmpty()) return ResponseEntity.notFound().build();
        Category cat = catOpt.get();

        // Nullify category reference in transactions before deleting
        List<Transaction> txs = transactionRepo.findByCategoryId(id);
        for (Transaction t : txs) {
            t.setCategory(null);
        }
        if (!txs.isEmpty()) {
            transactionRepo.saveAll(txs);
            transactionRepo.flush();
        }

        // Remove budgets with this category name
        List<MonthlyBudget> budgets = budgetRepo.findByCategoryName(cat.getName());
        if (!budgets.isEmpty()) {
            budgetRepo.deleteAll(budgets);
            budgetRepo.flush();
        }

        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
