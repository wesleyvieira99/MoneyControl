package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import com.moneycontrol.service.InsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final InsightService insightService;
    private final DebtReorganizationRepository debtRepo;
    private final CreditCardRepository cardRepo;
    private final FinancialGoalRepository goalRepo;

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
        BigDecimal totalDebt = debtRepo.findAll().stream()
                .map(DebtReorganization::getRemainingAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return Map.of(
            "totalBalance", totalBalance,
            "monthlyIncome", income,
            "monthlyExpense", expense,
            "netWorth", totalBalance.add(totalInvested),
            "totalInvested", totalInvested,
            "totalDebt", totalDebt,
            "netMonth", income.subtract(expense)
        );
    }

    @GetMapping("/balance-history")
    public List<Map<String, Object>> getBalanceHistory(@RequestParam(defaultValue = "6") int months) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = YearMonth.now().minusMonths(i);
            List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(ym.atDay(1), ym.atEndOfMonth());
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
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(LocalDate.of(y, 1, 1), LocalDate.of(y, 12, 31));
        Map<LocalDate, BigDecimal> grouped = new LinkedHashMap<>();
        txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
                .forEach(t -> grouped.merge(t.getDate(), t.getAmount(), BigDecimal::add));
        return grouped.entrySet().stream()
                .map(e -> Map.<String, Object>of("date", e.getKey().toString(), "value", e.getValue()))
                .collect(Collectors.toList());
    }

    @GetMapping("/category-breakdown")
    public List<Map<String, Object>> getCategoryBreakdown(@RequestParam(defaultValue = "") String month) {
        YearMonth ym = month.isEmpty() ? YearMonth.now() : YearMonth.parse(month);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(ym.atDay(1), ym.atEndOfMonth());
        Map<String, BigDecimal> grouped = new LinkedHashMap<>();
        txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE && t.getCategory() != null)
                .forEach(t -> grouped.merge(t.getCategory().getName(), t.getAmount(), BigDecimal::add));
        return grouped.entrySet().stream()
                .map(e -> Map.<String, Object>of("category", e.getKey(), "amount", e.getValue()))
                .collect(Collectors.toList());
    }

    /** Pilares do dashboard: investimentos, dividas, receitas, transacoes, cartoes */
    @GetMapping("/pillars")
    public Map<String, Object> getPillars(@RequestParam(defaultValue = "") String month) {
        YearMonth ym = month.isEmpty() ? YearMonth.now() : YearMonth.parse(month);
        LocalDate start = ym.atDay(1); LocalDate end = ym.atEndOfMonth();
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);
        List<Investment> investments = investRepo.findAll();
        List<DebtReorganization> debts = debtRepo.findAll();
        List<CreditCard> cards = cardRepo.findAll();

        // ── Investimentos ─────────────────────────────────────────────────
        BigDecimal totalInvested = investments.stream().map(Investment::getCurrentValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalInvestedCost = investments.stream().map(Investment::getInitialAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal investReturn = totalInvested.subtract(totalInvestedCost);
        double investReturnPct = totalInvestedCost.compareTo(BigDecimal.ZERO) > 0
            ? investReturn.divide(totalInvestedCost, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0;

        // ── Dividas ────────────────────────────────────────────────────────
        BigDecimal totalDebt = debts.stream().map(DebtReorganization::getRemainingAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOriginalDebt = debts.stream().map(DebtReorganization::getOriginalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long overdueDebts = debts.stream().filter(d -> d.getStatus() == TransactionStatus.OVERDUE).count();
        long perennialDebts = debts.stream().filter(d -> Boolean.TRUE.equals(d.getPerennial())).count();

        // ── Receitas ────────────────────────────────────────────────────────
        BigDecimal income = txs.stream().filter(t -> t.getType() == TransactionType.INCOME)
            .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long recurringIncome = txs.stream().filter(t -> t.getType() == TransactionType.INCOME && Boolean.TRUE.equals(t.getIsRecurring())).count();

        // ── Transacoes ──────────────────────────────────────────────────────
        BigDecimal expense = txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
            .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long pendingTxs = txs.stream().filter(t -> t.getStatus() == TransactionStatus.PENDING).count();
        long overdueTxs = txs.stream().filter(t -> t.getStatus() == TransactionStatus.OVERDUE).count();

        // ── Cartoes ─────────────────────────────────────────────────────────
        BigDecimal totalLimit = cards.stream().map(CreditCard::getCreditLimit).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cardExpenses = txs.stream()
            .filter(t -> t.getType() == TransactionType.EXPENSE && t.getCreditCard() != null)
            .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        double utilizationPct = totalLimit.compareTo(BigDecimal.ZERO) > 0
            ? cardExpenses.divide(totalLimit, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0;

        return Map.of(
            "investments", Map.of("total", totalInvested, "invested", totalInvestedCost, "return", investReturn, "returnPct", investReturnPct, "count", investments.size()),
            "debts", Map.of("total", totalDebt, "original", totalOriginalDebt, "overdue", overdueDebts, "perennial", perennialDebts, "count", debts.size()),
            "income", Map.of("total", income, "recurring", recurringIncome, "transactions", txs.stream().filter(t -> t.getType() == TransactionType.INCOME).count()),
            "expenses", Map.of("total", expense, "pending", pendingTxs, "overdue", overdueTxs, "transactions", txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE).count()),
            "cards", Map.of("count", cards.size(), "totalLimit", totalLimit, "cardExpenses", cardExpenses, "utilizationPct", utilizationPct)
        );
    }

    @GetMapping("/insights")
    public List<Map<String, String>> getInsights(@RequestParam(defaultValue = "") String month) {
        YearMonth ym = month.isEmpty() ? YearMonth.now() : YearMonth.parse(month);
        LocalDate start = ym.atDay(1); LocalDate end = ym.atEndOfMonth();
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);
        BigDecimal income = txs.stream().filter(t -> t.getType() == TransactionType.INCOME)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expense = txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalBalance = accountRepo.findAll().stream()
                .map(BankAccount::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalInvested = investRepo.findAll().stream()
                .map(Investment::getCurrentValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDebt = debtRepo.findAll().stream()
                .map(DebtReorganization::getRemainingAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long overdueDebts = debtRepo.findAll().stream().filter(d -> d.getStatus() == TransactionStatus.OVERDUE).count();

        Map<String, BigDecimal> catMap = new LinkedHashMap<>();
        txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE && t.getCategory() != null)
                .forEach(t -> catMap.merge(t.getCategory().getName(), t.getAmount(), BigDecimal::add));
        List<Map<String, Object>> topCategories = catMap.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(e -> Map.<String, Object>of("name", e.getKey(), "total", e.getValue()))
                .collect(Collectors.toList());

        Map<String, Object> financialData = new HashMap<>();
        financialData.put("totalBalance", totalBalance);
        financialData.put("monthlyIncome", income);
        financialData.put("monthlyExpense", expense);
        financialData.put("netWorth", totalBalance.add(totalInvested));
        financialData.put("totalInvested", totalInvested);
        financialData.put("totalDebt", totalDebt);
        financialData.put("overdueDebts", overdueDebts);
        financialData.put("netMonth", income.subtract(expense));
        financialData.put("topCategories", topCategories);
        financialData.put("investments", investRepo.findAll());
        financialData.put("debts", debtRepo.findAll());
        financialData.put("goals", goalRepo.findAll());
        financialData.put("cards", cardRepo.findAll());

        return insightService.generateInsights(financialData);
    }
}

