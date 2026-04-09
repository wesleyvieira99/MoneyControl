package com.moneycontrol.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Transaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private LocalDate date;
    private String description;
    @Builder.Default
    private BigDecimal amount = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    private TransactionType type;
    @ManyToOne @JoinColumn(name = "category_id")
    private Category category;
    @ManyToOne @JoinColumn(name = "bank_account_id")
    private BankAccount bankAccount;
    @ManyToOne @JoinColumn(name = "credit_card_id")
    private CreditCard creditCard;
    @ManyToOne @JoinColumn(name = "installment_group_id")
    private InstallmentGroup installmentGroup;
    private Integer installmentNumber;
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;
    private String notes;
    private Boolean isRecurring;
    /** Para recorrentes: até quando repetir (mês/ano) */
    private java.time.LocalDate recurringUntilDate;
    /** Para recorrentes perenes: dia do mês de vencimento */
    private Integer recurringDayOfMonth;
    private String tags;
}
