package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class FinancialGoal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    @Builder.Default
    private BigDecimal targetAmount = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal currentAmount = BigDecimal.ZERO;
    private LocalDate deadline;
    private String notes;
    private String color;
    private String icon;
}
