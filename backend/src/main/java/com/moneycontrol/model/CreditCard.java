package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CreditCard {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String bankName;
    @ManyToOne @JoinColumn(name = "bank_account_id")
    private BankAccount bankAccount;
    @Builder.Default
    private BigDecimal creditLimit = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal usedLimit = BigDecimal.ZERO;
    private Integer closingDay;
    private Integer dueDay;
    private String color;
    private String logoUrl;
    private String lastFourDigits;
    private String notes;
}
