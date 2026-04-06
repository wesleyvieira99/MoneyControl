package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.stream.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final TransactionRepository txRepo;
    private final BankAccountRepository accountRepo;
    private final InvestmentRepository investRepo;

    @GetMapping("/summary")
    public Map<String, Object> getSummary(@RequestParam(defaultValue = "") String month) {
        YearMonth ym = month.isEmpty() ? YearMonth.now() : YearMonth.parse(month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);

        BigDecimal income = txs.stream().filter(t -> t.getType() == TransactionType.INCOME)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expense = txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalBalance = accountRepo.findAll().stream()
                .map(BankAccount::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalInvested = investRepo.findAll().stream()
                .map(Investment::getCurrentValue).reduce(BigDecimal.ZERO, BigDecimal::add);

        return Map.of(
            "totalBalance", totalBalance,
            "monthlyIncome", income,
            "monthlyExpense", expense,
            "netWorth", totalBalance.add(totalInvested),
            "totalInvested", totalInvested,
            "netMonth", income.subtract(expense)
        );
    }

    @GetMapping("/balance-history")
    public List<Map<String, Object>> getBalanceHistory(
            @RequestParam(defaultValue = "6") int months) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = YearMonth.now().minusMonths(i);
            LocalDate start = ym.atDay(1);
            LocalDate end = ym.atEndOfMonth();
            List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);
            BigDecimal income = txs.stream().filter(t -> t.getType() == TransactionType.INCOME)
                    .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal expense = txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
                    .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            result.add(Map.of("month", ym.toString(), "income", income, "expense", expense, "net", income.subtract(expense)));
        }
        return result;
    }

    @GetMapping("/heatmap")
    public List<Map<String, Object>> getHeatmap(@RequestParam(defaultValue = "") String year) {
        int y = year.isEmpty() ? LocalDate.now().getYear() : Integer.parseInt(year);
        LocalDate start = LocalDate.of(y, 1, 1);
        LocalDate end = LocalDate.of(y, 12, 31);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);
        Map<LocalDate, BigDecimal> grouped = new LinkedHashMap<>();
        txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
                .forEach(t -> grouped.merge(t.getDate(), t.getAmount(), BigDecimal::add));
        return grouped.entrySet().stream()
                .map(e -> Map.<String, Object>of("date", e.getKey().toString(), "value", e.getValue()))
                .collect(Collectors.toList());
    }

    @GetMapping("/category-breakdown")
    public List<Map<String, Object>> getCategoryBreakdown(
            @RequestParam(defaultValue = "") String month) {
        YearMonth ym = month.isEmpty() ? YearMonth.now() : YearMonth.parse(month);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(ym.atDay(1), ym.atEndOfMonth());
        Map<String, BigDecimal> grouped = new LinkedHashMap<>();
        txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE && t.getCategory() != null)
                .forEach(t -> grouped.merge(t.getCategory().getName(), t.getAmount(), BigDecimal::add));
        return grouped.entrySet().stream()
                .map(e -> Map.<String, Object>of("category", e.getKey(), "amount", e.getValue()))
                .collect(Collectors.toList());
    }
}
