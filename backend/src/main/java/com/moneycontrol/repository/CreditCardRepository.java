package com.moneycontrol.repository;
import com.moneycontrol.model.CreditCard;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CreditCardRepository extends JpaRepository<CreditCard, Long> {
    List<CreditCard> findByBankAccountId(Long bankAccountId);
}
