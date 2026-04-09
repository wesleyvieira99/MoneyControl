package com.moneycontrol.repository;
import com.moneycontrol.model.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByDateBetweenOrderByDateDesc(LocalDate start, LocalDate end);
    List<Transaction> findByBankAccountIdAndDateBetweenOrderByDateDesc(Long accountId, LocalDate start, LocalDate end);
    List<Transaction> findByBankAccountIdOrderByDateDesc(Long accountId);
    List<Transaction> findByCreditCardIdOrderByDateDesc(Long cardId);
    List<Transaction> findByCreditCardIdAndDateBetweenOrderByDateDesc(Long cardId, LocalDate start, LocalDate end);
    List<Transaction> findByCreditCardBankAccountIdOrderByDateDesc(Long accountId);
    List<Transaction> findByStatusOrderByDateAsc(TransactionStatus status);
    List<Transaction> findByInstallmentGroupId(Long groupId);
    List<Transaction> findByNotesContaining(String marker);
    boolean existsByNotesContaining(String marker);
    void deleteByBankAccountId(Long accountId);
    @Query("SELECT t FROM Transaction t WHERE t.date < :today AND t.status = 'PENDING'")
    List<Transaction> findOverdue(@Param("today") LocalDate today);
}
