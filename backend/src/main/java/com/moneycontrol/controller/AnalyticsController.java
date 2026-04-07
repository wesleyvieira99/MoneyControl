package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.*;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final TransactionRepository txRepo;
    private final BankAccountRepository accountRepo;
    private final InvestmentRepository investRepo;
    private final FinancialGoalRepository goalRepo;
    private final DebtReorganizationRepository debtRepo;

    // ── Financial Score (0-1000) ──────────────────────────────────────────
    @GetMapping("/score")
    public Map<String, Object> getFinancialScore() {
        YearMonth ym = YearMonth.now();
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);

        BigDecimal income  = sum(txs, TransactionType.INCOME);
        BigDecimal expense = sum(txs, TransactionType.EXPENSE);
        BigDecimal totalBalance   = accountRepo.findAll().stream().map(BankAccount::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalInvested  = investRepo.findAll().stream().map(Investment::getCurrentValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDebt      = debtRepo.findAll().stream().map(DebtReorganization::getRemainingAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Savings rate score (0-250): >= 30% = 250
        double savRate = income.compareTo(BigDecimal.ZERO) > 0
            ? income.subtract(expense).divide(income, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0;
        int savScore = (int) Math.min(250, (savRate / 30.0) * 250);

        // Debt ratio score (0-250): debt/income < 30% = 250
        double debtRatio = income.compareTo(BigDecimal.ZERO) > 0
            ? totalDebt.divide(income, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 100;
        int debtScore = (int) Math.max(0, 250 - (debtRatio / 100.0) * 250);

        // Investment rate score (0-250): >= 20% of income = 250
        double invRate = income.compareTo(BigDecimal.ZERO) > 0
            ? totalInvested.divide(income.multiply(BigDecimal.valueOf(12)), 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0;
        int invScore = (int) Math.min(250, (invRate / 20.0) * 250);

        // Emergency fund score (0-250): 6x monthly expense = 250
        double months6 = expense.compareTo(BigDecimal.ZERO) > 0
            ? totalBalance.divide(expense, 4, RoundingMode.HALF_UP).doubleValue() : 0;
        int emergScore = (int) Math.min(250, (months6 / 6.0) * 250);

        int total = savScore + debtScore + invScore + emergScore;
        String tier = total >= 850 ? "Elite" : total >= 700 ? "Avançado" : total >= 500 ? "Intermediário" : total >= 300 ? "Iniciante" : "Crítico";
        String emoji = total >= 850 ? "🏆" : total >= 700 ? "🥇" : total >= 500 ? "🥈" : total >= 300 ? "🥉" : "⚠️";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("tier", tier);
        result.put("emoji", emoji);
        result.put("savingsScore", savScore);
        result.put("debtScore", debtScore);
        result.put("investmentScore", invScore);
        result.put("emergencyScore", emergScore);
        result.put("savingsRate", Math.round(savRate * 10.0) / 10.0);
        result.put("debtRatio", Math.round(debtRatio * 10.0) / 10.0);
        result.put("monthlyIncome", income);
        result.put("monthlyExpense", expense);
        return result;
    }

    // ── Cash Flow Projection (30/60/90 days) ──────────────────────────────
    @GetMapping("/cashflow")
    public Map<String, Object> getCashFlow() {
        LocalDate today = LocalDate.now();
        LocalDate end90 = today.plusDays(90);
        List<Transaction> upcoming = txRepo.findByStatusOrderByDateAsc(TransactionStatus.PENDING);

        List<Map<String, Object>> days = new ArrayList<>();
        BigDecimal running = accountRepo.findAll().stream().map(BankAccount::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal runningBalance = running;

        for (LocalDate d = today; !d.isAfter(end90); d = d.plusDays(1)) {
            final LocalDate fd = d;
            List<Transaction> dayTxs = upcoming.stream()
                .filter(t -> t.getDate().equals(fd)).collect(Collectors.toList());
            BigDecimal dayIn  = dayTxs.stream().filter(t -> t.getType() == TransactionType.INCOME).map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal dayOut = dayTxs.stream().filter(t -> t.getType() == TransactionType.EXPENSE).map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            runningBalance = runningBalance.add(dayIn).subtract(dayOut);
            if (!dayTxs.isEmpty()) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("date", d.toString());
                entry.put("income", dayIn);
                entry.put("expense", dayOut);
                entry.put("balance", runningBalance);
                entry.put("transactions", dayTxs.size());
                days.add(entry);
            }
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("currentBalance", running);
        res.put("projectedBalance30", projBalance(upcoming, running, today, 30));
        res.put("projectedBalance60", projBalance(upcoming, running, today, 60));
        res.put("projectedBalance90", projBalance(upcoming, running, today, 90));
        res.put("days", days);
        return res;
    }

    // ── Recurring Expenses ─────────────────────────────────────────────────
    @GetMapping("/recurring")
    public List<Map<String, Object>> getRecurring() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(3);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end)
            .stream().filter(t -> t.getType() == TransactionType.EXPENSE).collect(Collectors.toList());

        Map<String, List<Transaction>> grouped = txs.stream()
            .collect(Collectors.groupingBy(t -> normalize(t.getDescription())));

        return grouped.entrySet().stream()
            .filter(e -> e.getValue().size() >= 2)
            .map(e -> {
                List<Transaction> list = e.getValue();
                BigDecimal avg = list.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(list.size()), 2, RoundingMode.HALF_UP);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("description", list.get(0).getDescription());
                m.put("avgAmount", avg);
                m.put("occurrences", list.size());
                m.put("category", list.get(0).getCategory() != null ? list.get(0).getCategory().getName() : "Sem categoria");
                m.put("lastDate", list.get(0).getDate().toString());
                return m;
            })
            .sorted((a, b) -> ((BigDecimal)b.get("avgAmount")).compareTo((BigDecimal)a.get("avgAmount")))
            .collect(Collectors.toList());
    }

    // ── Month-over-Month comparison ─────────────────────────────────────────
    @GetMapping("/monthly-comparison")
    public List<Map<String, Object>> getMonthlyComparison(@RequestParam(defaultValue = "6") int months) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = YearMonth.now().minusMonths(i);
            LocalDate s = ym.atDay(1), e = ym.atEndOfMonth();
            List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(s, e);
            BigDecimal income  = sum(txs, TransactionType.INCOME);
            BigDecimal expense = sum(txs, TransactionType.EXPENSE);

            Map<String, BigDecimal> cats = new LinkedHashMap<>();
            txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE && t.getCategory() != null)
                .forEach(t -> cats.merge(t.getCategory().getName(), t.getAmount(), BigDecimal::add));

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", ym.toString());
            m.put("monthLabel", ym.getMonth().getDisplayName(TextStyle.SHORT, new Locale("pt","BR")) + "/" + ym.getYear());
            m.put("income", income);
            m.put("expense", expense);
            m.put("net", income.subtract(expense));
            m.put("savingsRate", income.compareTo(BigDecimal.ZERO) > 0
                ? income.subtract(expense).divide(income, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0);
            m.put("categories", cats);
            result.add(m);
        }
        return result;
    }

    // ── Spending Patterns (day of week) ───────────────────────────────────
    @GetMapping("/patterns")
    public Map<String, Object> getSpendingPatterns() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(3);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end)
            .stream().filter(t -> t.getType() == TransactionType.EXPENSE).collect(Collectors.toList());

        // By day of week
        String[] days = {"Dom","Seg","Ter","Qua","Qui","Sex","Sáb"};
        Map<Integer, BigDecimal> byDow = new HashMap<>();
        Map<Integer, Integer>    cntDow = new HashMap<>();
        for (int i = 0; i < 7; i++) { byDow.put(i, BigDecimal.ZERO); cntDow.put(i, 0); }
        txs.forEach(t -> {
            int dow = t.getDate().getDayOfWeek().getValue() % 7;
            byDow.merge(dow, t.getAmount(), BigDecimal::add);
            cntDow.merge(dow, 1, Integer::sum);
        });

        List<Map<String, Object>> dowData = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            int cnt = cntDow.getOrDefault(i, 1);
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("day", days[i]);
            d.put("total", byDow.getOrDefault(i, BigDecimal.ZERO));
            d.put("avg", cnt > 0 ? byDow.getOrDefault(i, BigDecimal.ZERO).divide(BigDecimal.valueOf(cnt), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
            dowData.add(d);
        }

        // By hour (if we had time, use date for now as day-of-month 1-5 buckets)
        // By category trend
        Map<String, BigDecimal> catTotals = new LinkedHashMap<>();
        txs.stream().filter(t -> t.getCategory() != null)
            .forEach(t -> catTotals.merge(t.getCategory().getName(), t.getAmount(), BigDecimal::add));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("byDayOfWeek", dowData);
        res.put("topCategories", catTotals.entrySet().stream()
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()).limit(5)
            .map(e -> Map.of("category", e.getKey(), "total", e.getValue()))
            .collect(Collectors.toList()));
        res.put("totalAnalyzed", txs.size());
        res.put("periodDays", 90);
        return res;
    }

    // ── Financial Independence Point ───────────────────────────────────────
    @GetMapping("/independence")
    public Map<String, Object> getIndependencePoint() {
        YearMonth ym = YearMonth.now();
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(ym.atDay(1), ym.atEndOfMonth());
        BigDecimal monthlyExpense = sum(txs, TransactionType.EXPENSE);
        BigDecimal monthlyIncome  = sum(txs, TransactionType.INCOME);
        BigDecimal totalInvested  = investRepo.findAll().stream().map(Investment::getCurrentValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalBalance   = accountRepo.findAll().stream().map(BankAccount::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);

        // FIRE number = 25x annual expenses (4% rule)
        BigDecimal annualExpense = monthlyExpense.multiply(BigDecimal.valueOf(12));
        BigDecimal fireNumber = annualExpense.multiply(BigDecimal.valueOf(25));

        BigDecimal currentWealth = totalInvested.add(totalBalance);
        BigDecimal gap = fireNumber.subtract(currentWealth);

        // Monthly surplus to invest
        BigDecimal monthlySurplus = monthlyIncome.subtract(monthlyExpense);
        double annualReturn = 0.10; // 10% aa
        double monthlyReturn = Math.pow(1 + annualReturn, 1.0/12) - 1;

        int monthsToFI = 9999;
        if (monthlySurplus.compareTo(BigDecimal.ZERO) > 0 && gap.compareTo(BigDecimal.ZERO) > 0) {
            double cw = currentWealth.doubleValue();
            double fn = fireNumber.doubleValue();
            double ms = monthlySurplus.doubleValue();
            int m = 0;
            while (cw < fn && m < 9999) { cw = cw * (1 + monthlyReturn) + ms; m++; }
            monthsToFI = m;
        } else if (currentWealth.compareTo(fireNumber) >= 0) {
            monthsToFI = 0;
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("fireNumber", fireNumber);
        res.put("currentWealth", currentWealth);
        res.put("gap", gap.max(BigDecimal.ZERO));
        res.put("monthsToFI", monthsToFI);
        res.put("yearsToFI", monthsToFI == 0 ? 0 : Math.round(monthsToFI / 12.0 * 10.0) / 10.0);
        res.put("progressPct", fireNumber.compareTo(BigDecimal.ZERO) > 0
            ? currentWealth.divide(fireNumber, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).min(BigDecimal.valueOf(100)).doubleValue() : 0);
        res.put("monthlySurplus", monthlySurplus);
        res.put("monthlyExpense", monthlyExpense);
        res.put("annualExpense", annualExpense);
        res.put("fiYear", LocalDate.now().plusMonths(monthsToFI).getYear());
        return res;
    }

    // ── Anomaly Detection ─────────────────────────────────────────────────
    @GetMapping("/anomalies")
    public List<Map<String, Object>> getAnomalies() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(6);
        List<Transaction> all = txRepo.findByDateBetweenOrderByDateDesc(start, end)
            .stream().filter(t -> t.getType() == TransactionType.EXPENSE).collect(Collectors.toList());

        // Group by category, calculate avg and stddev, find outliers
        Map<String, List<BigDecimal>> catAmounts = new HashMap<>();
        all.stream().filter(t -> t.getCategory() != null).forEach(t ->
            catAmounts.computeIfAbsent(t.getCategory().getName(), k -> new ArrayList<>()).add(t.getAmount()));

        List<Map<String, Object>> anomalies = new ArrayList<>();
        catAmounts.forEach((cat, amounts) -> {
            if (amounts.size() < 3) return;
            double avg = amounts.stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0);
            double variance = amounts.stream().mapToDouble(a -> Math.pow(a.doubleValue() - avg, 2)).average().orElse(0);
            double stdDev = Math.sqrt(variance);
            amounts.forEach(a -> {
                double val = a.doubleValue();
                if (val > avg + 2 * stdDev) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("category", cat);
                    m.put("amount", a);
                    m.put("avg", Math.round(avg * 100.0) / 100.0);
                    m.put("deviation", Math.round(((val - avg) / avg) * 100.0) / 100.0);
                    m.put("severity", val > avg + 3 * stdDev ? "HIGH" : "MEDIUM");
                    anomalies.add(m);
                }
            });
        });
        return anomalies.stream().sorted((a, b) -> Double.compare(
            (Double)b.get("deviation"), (Double)a.get("deviation"))).limit(10).collect(Collectors.toList());
    }

    // ── Treemap data ───────────────────────────────────────────────────────
    @GetMapping("/treemap")
    public List<Map<String, Object>> getTreemap(@RequestParam(defaultValue = "") String month) {
        YearMonth ym = month.isEmpty() ? YearMonth.now() : YearMonth.parse(month);
        List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(ym.atDay(1), ym.atEndOfMonth())
            .stream().filter(t -> t.getType() == TransactionType.EXPENSE).collect(Collectors.toList());

        Map<String, BigDecimal> cats = new LinkedHashMap<>();
        txs.forEach(t -> {
            String cat = t.getCategory() != null ? t.getCategory().getName() : "Outros";
            cats.merge(cat, t.getAmount(), BigDecimal::add);
        });

        BigDecimal total = cats.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return cats.entrySet().stream()
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", e.getKey());
                m.put("value", e.getValue());
                m.put("pct", total.compareTo(BigDecimal.ZERO) > 0
                    ? e.getValue().divide(total, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0);
                return m;
            }).collect(Collectors.toList());
    }

    // helpers
    private BigDecimal sum(List<Transaction> txs, TransactionType type) {
        return txs.stream().filter(t -> t.getType() == type)
            .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal projBalance(List<Transaction> pending, BigDecimal start, LocalDate from, int days) {
        LocalDate to = from.plusDays(days);
        BigDecimal bal = start;
        for (Transaction t : pending) {
            if (!t.getDate().isAfter(to) && !t.getDate().isBefore(from)) {
                if (t.getType() == TransactionType.INCOME) bal = bal.add(t.getAmount());
                else bal = bal.subtract(t.getAmount());
            }
        }
        return bal;
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("[0-9]", "").replaceAll("\\s+", " ").trim();
    }
}
