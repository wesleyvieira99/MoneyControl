package com.moneycontrol.repository;

import com.moneycontrol.model.MonthlyBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MonthlyBudgetRepository extends JpaRepository<MonthlyBudget, Long> {
    List<MonthlyBudget> findByMonth(String month);
    List<MonthlyBudget> findByMonthOrderByCategoryNameAsc(String month);
}
