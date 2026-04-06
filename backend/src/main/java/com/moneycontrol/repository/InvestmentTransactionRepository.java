package com.moneycontrol.repository;
import com.moneycontrol.model.InvestmentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface InvestmentTransactionRepository extends JpaRepository<InvestmentTransaction, Long> {
    List<InvestmentTransaction> findByInvestmentIdOrderByDateDesc(Long investmentId);
}
