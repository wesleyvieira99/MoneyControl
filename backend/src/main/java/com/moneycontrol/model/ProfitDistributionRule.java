package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProfitDistributionRule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    @Builder.Default
    private BigDecimal percentage = BigDecimal.ZERO;
    private String destinationType;
    @ManyToOne @JoinColumn(name = "category_id")
    private Category category;
    @ManyToOne @JoinColumn(name = "bank_account_id")
    private BankAccount bankAccount;
    private String color;
    private Integer sortOrder;
    @Builder.Default
    private BigDecimal allocatedAmount = BigDecimal.ZERO;
}
