package com.moneycontrol.controller;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/forecast")
@RequiredArgsConstructor
public class ForecastController {
    private final TransactionRepository txRepo;

    /** Small epsilon to avoid division by zero in linear regression when all x values are equal. */
    private static final double EPSILON = 1e-9;

    @GetMapping
    public Map<String, Object> getForecast(@RequestParam(defaultValue = "6") int months) {
        List<Double> incomes = new ArrayList<>();
        List<Double> expenses = new ArrayList<>();
        List<String> historicMonths = new ArrayList<>();

        for (int i = 11; i >= 0; i--) {
            YearMonth ym = YearMonth.now().minusMonths(i);
            LocalDate start = ym.atDay(1);
            LocalDate end = ym.atEndOfMonth();
            List<Transaction> txs = txRepo.findByDateBetweenOrderByDateDesc(start, end);
            double inc = txs.stream().filter(t -> t.getType() == TransactionType.INCOME)
                    .mapToDouble(t -> t.getAmount().doubleValue()).sum();
            double exp = txs.stream().filter(t -> t.getType() == TransactionType.EXPENSE)
                    .mapToDouble(t -> t.getAmount().doubleValue()).sum();
            incomes.add(inc);
            expenses.add(exp);
            historicMonths.add(ym.toString());
        }

        List<Map<String, Object>> projections = new ArrayList<>();
        for (int i = 1; i <= months; i++) {
            YearMonth ym = YearMonth.now().plusMonths(i);
            double projIncome = linearProject(incomes, i);
            double projExpense = linearProject(expenses, i);
            projections.add(Map.of(
                "month", ym.toString(),
                "projectedIncome", round(projIncome),
                "projectedExpense", round(projExpense),
                "projectedNet", round(projIncome - projExpense)
            ));
        }

        return Map.of(
            "historicMonths", historicMonths,
            "historicIncome", incomes,
            "historicExpense", expenses,
            "projections", projections
        );
    }

    private double linearProject(List<Double> data, int stepsAhead) {
        int n = data.size();
        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (int i = 0; i < n; i++) {
            sumX += i;
            sumY += data.get(i);
            sumXY += i * data.get(i);
            sumX2 += i * i;
        }
        double slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX + EPSILON);
        double intercept = (sumY - slope * sumX) / n;
        return Math.max(0, intercept + slope * (n + stepsAhead - 1));
    }

    private double round(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
