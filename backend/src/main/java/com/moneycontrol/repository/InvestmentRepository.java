package com.moneycontrol.repository;
import com.moneycontrol.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface InvestmentRepository extends JpaRepository<Investment, Long> {
    List<Investment> findByType(InvestmentType type);
    List<Investment> findByIsActive(Boolean isActive);
}
