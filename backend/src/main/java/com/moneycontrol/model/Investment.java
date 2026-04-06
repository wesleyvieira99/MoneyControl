package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Investment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String ticker;
    @Enumerated(EnumType.STRING)
    private InvestmentType type;
    @ManyToOne @JoinColumn(name = "bank_account_id")
    private BankAccount bankAccount;
    @Builder.Default
    private BigDecimal initialAmount = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal currentValue = BigDecimal.ZERO;
    private LocalDate startDate;
    private String notes;
    private String logoUrl;
    private Boolean isActive;
}
