package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class DebtReorganization {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String description;
    @ManyToOne @JoinColumn(name = "credit_card_id")
    private CreditCard creditCard;
    @ManyToOne @JoinColumn(name = "bank_account_id")
    private BankAccount bankAccount;
    @Builder.Default
    private BigDecimal originalAmount = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal remainingAmount = BigDecimal.ZERO;
    private Integer totalInstallments;
    private Integer paidInstallments;
    private LocalDate startDate;
    private String notes;
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;
    /** true = dívida perene (recorrente sem parcelas, ex: luz, internet) */
    @Builder.Default
    private Boolean perennial = false;
    /** Para perenes: dia do mês de vencimento (1-31) */
    private Integer dueDayOfMonth;
    /** Para perenes: data de início da recorrência */
    private LocalDate perennialStartDate;
}
