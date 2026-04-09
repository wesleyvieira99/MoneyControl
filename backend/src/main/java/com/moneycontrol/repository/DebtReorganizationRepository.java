package com.moneycontrol.repository;
import com.moneycontrol.model.DebtReorganization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DebtReorganizationRepository extends JpaRepository<DebtReorganization, Long> {
    List<DebtReorganization> findByCreditCardId(Long creditCardId);
    List<DebtReorganization> findByBankAccountId(Long bankAccountId);
    @Modifying
    @Query("UPDATE DebtReorganization d SET d.bankAccount = NULL WHERE d.bankAccount.id = :accountId")
    void detachFromBankAccount(@Param("accountId") Long accountId);
}
