package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/budget")
@RequiredArgsConstructor
public class BudgetController {

    private final MonthlyBudgetRepository budgetRepo;
    private final TransactionRepository txRepo;

    @GetMapping
    public List<Map<String, Object>> getBudgets(@RequestParam(required = false) String month) {
        String m = (month == null || month.isEmpty()) ? YearMonth.now().toString() : month;
        YearMonth ym = YearMonth.parse(m);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<MonthlyBudget> budgets = budgetRepo.findByMonthOrderByCategoryNameAsc(m);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end)
            .stream().filter(t -> t.getType() == TransactionType.EXPENSE).collect(Collectors.toList());

        // Group actual spending by category name
        Map<String, BigDecimal> spent = new HashMap<>();
        txs.forEach(t -> {
            String cat = t.getCategory() != null ? t.getCategory().getName() : "Outros";
            spent.merge(cat, t.getAmount(), BigDecimal::add);
        });

        BigDecimal totalBudget = budgets.stream().map(MonthlyBudget::getBudgetAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSpent  = spent.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        return budgets.stream().map(b -> {
            BigDecimal s = spent.getOrDefault(b.getCategoryName(), BigDecimal.ZERO);
            double pct = b.getBudgetAmount().compareTo(BigDecimal.ZERO) > 0
                ? s.divide(b.getBudgetAmount(), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0;
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", b.getId());
            r.put("month", b.getMonth());
            r.put("categoryName", b.getCategoryName());
            r.put("categoryIcon", b.getCategoryIcon());
            r.put("categoryColor", b.getCategoryColor());
            r.put("budgetAmount", b.getBudgetAmount());
            r.put("spentAmount", s);
            r.put("remainingAmount", b.getBudgetAmount().subtract(s));
            r.put("percentUsed", Math.round(pct * 10.0) / 10.0);
            r.put("overBudget", s.compareTo(b.getBudgetAmount()) > 0);
            r.put("totalBudget", totalBudget);
            r.put("totalSpent", totalSpent);
            return r;
        }).collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<MonthlyBudget> create(@RequestBody MonthlyBudget budget) {
        if (budget.getMonth() == null || budget.getMonth().isEmpty()) {
            budget.setMonth(YearMonth.now().toString());
        }
        return ResponseEntity.ok(budgetRepo.save(budget));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MonthlyBudget> update(@PathVariable Long id, @RequestBody MonthlyBudget budget) {
        return budgetRepo.findById(id).map(existing -> {
            existing.setCategoryName(budget.getCategoryName());
            existing.setCategoryIcon(budget.getCategoryIcon());
            existing.setCategoryColor(budget.getCategoryColor());
            existing.setBudgetAmount(budget.getBudgetAmount());
            existing.setMonth(budget.getMonth());
            return ResponseEntity.ok(budgetRepo.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        budgetRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // Summary for the month
    @GetMapping("/summary")
    public Map<String, Object> getSummary(@RequestParam(required = false) String month) {
        String m = (month == null || month.isEmpty()) ? YearMonth.now().toString() : month;
        YearMonth ym = YearMonth.parse(m);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<MonthlyBudget> budgets = budgetRepo.findByMonth(m);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end)
            .stream().filter(t -> t.getType() == TransactionType.EXPENSE).collect(Collectors.toList());

        BigDecimal totalBudget = budgets.stream().map(MonthlyBudget::getBudgetAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSpent  = txs.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long overBudgetCount   = budgets.stream().filter(b -> {
            BigDecimal s = txs.stream()
                .filter(t -> t.getCategory() != null && t.getCategory().getName().equals(b.getCategoryName()))
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            return s.compareTo(b.getBudgetAmount()) > 0;
        }).count();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("month", m);
        res.put("totalBudget", totalBudget);
        res.put("totalSpent", totalSpent);
        res.put("totalRemaining", totalBudget.subtract(totalSpent));
        res.put("overallPct", totalBudget.compareTo(BigDecimal.ZERO) > 0
            ? totalSpent.divide(totalBudget, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0);
        res.put("overBudgetCount", overBudgetCount);
        res.put("budgetCount", budgets.size());
        return res;
    }
}
