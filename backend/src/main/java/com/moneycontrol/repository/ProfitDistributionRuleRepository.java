package com.moneycontrol.repository;
import com.moneycontrol.model.ProfitDistributionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface ProfitDistributionRuleRepository extends JpaRepository<ProfitDistributionRule, Long> {
    @Modifying
    @Query("UPDATE ProfitDistributionRule p SET p.bankAccount = NULL WHERE p.bankAccount.id = :accountId")
    void detachFromBankAccount(@Param("accountId") Long accountId);
}
