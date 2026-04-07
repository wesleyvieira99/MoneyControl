package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class MonthlyBudget {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // e.g. "2025-01"  — "month" is a reserved H2 keyword, mapped to budget_month
    @Column(name = "budget_month")
    private String month;

    private String categoryName;
    private String categoryIcon;
    private String categoryColor;

    @Builder.Default
    private BigDecimal budgetAmount = BigDecimal.ZERO;

    // computed at query time, not stored
    @Transient
    private BigDecimal spentAmount;
    @Transient
    private double percentUsed;
}
