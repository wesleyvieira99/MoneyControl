package com.moneycontrol.repository;
import com.moneycontrol.model.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {}
