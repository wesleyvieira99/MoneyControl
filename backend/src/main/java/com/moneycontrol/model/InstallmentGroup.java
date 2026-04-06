package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class InstallmentGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String description;
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;
    private Integer totalInstallments;
    private LocalDate startDate;
    private String notes;
    @OneToMany(mappedBy = "installmentGroup", cascade = CascadeType.ALL)
    private List<Transaction> transactions;
}
