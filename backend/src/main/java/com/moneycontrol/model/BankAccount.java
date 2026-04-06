package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class BankAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String bankName;
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;
    private String color;
    private String logoUrl;
    private String accountNumber;
    private String notes;
}
