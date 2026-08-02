package com.moneycontrol.controller;

import com.moneycontrol.repository.*;
import com.moneycontrol.service.BackupGitService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DataExportController.class)
class DataExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionRepository txRepo;
    @MockBean
    private BankAccountRepository accountRepo;
    @MockBean
    private InvestmentRepository investRepo;
    @MockBean
    private DebtReorganizationRepository debtRepo;
    @MockBean
    private CreditCardRepository cardRepo;
    @MockBean
    private FinancialGoalRepository goalRepo;
    @MockBean
    private CategoryRepository categoryRepo;
    @MockBean
    private MonthlyBudgetRepository budgetRepo;
    @MockBean
    private InstallmentGroupRepository installmentGroupRepo;
    @MockBean
    private InvestmentTransactionRepository investmentTransactionRepo;
    @MockBean
    private ProfitDistributionRuleRepository distributionRuleRepo;
    @MockBean
    private BackupGitService backupGitService;

    @Test
    void resetShouldClearAllDataAndReturnSuccess() throws Exception {
        mockMvc.perform(post("/api/data/reset")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("reset"))
            .andExpect(jsonPath("$.message").value("Todos os dados foram removidos com sucesso."));

        verify(txRepo).deleteAll();
        verify(debtRepo).deleteAll();
        verify(investmentTransactionRepo).deleteAll();
        verify(investRepo).deleteAll();
        verify(installmentGroupRepo).deleteAll();
        verify(distributionRuleRepo).deleteAll();
        verify(cardRepo).deleteAll();
        verify(budgetRepo).deleteAll();
        verify(goalRepo).deleteAll();
        verify(categoryRepo).deleteAll();
        verify(accountRepo).deleteAll();
    }
}
