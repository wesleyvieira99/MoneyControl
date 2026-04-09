package com.moneycontrol.repository;
import com.moneycontrol.model.DebtReorganization;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DebtReorganizationRepository extends JpaRepository<DebtReorganization, Long> {
    List<DebtReorganization> findByBankAccountId(Long bankAccountId);
    List<DebtReorganization> findByCreditCardId(Long creditCardId);
}
