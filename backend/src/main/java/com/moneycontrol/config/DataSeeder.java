package com.moneycontrol.config;

import com.moneycontrol.model.*;
import com.moneycontrol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Random;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {
    private final BankAccountRepository accountRepo;
    private final CreditCardRepository cardRepo;
    private final CategoryRepository categoryRepo;
    private final TransactionRepository txRepo;
    private final InvestmentRepository investRepo;

    @Override
    public void run(String... args) {
        if (accountRepo.count() > 0) return;

        BankAccount nubank = accountRepo.save(BankAccount.builder()
            .name("NuBank").bankName("Nubank").balance(new BigDecimal("5420.00"))
            .color("#820AD1").logoUrl("https://logo.clearbit.com/nubank.com.br").build());
        BankAccount itau = accountRepo.save(BankAccount.builder()
            .name("Itaú").bankName("Itaú").balance(new BigDecimal("12300.00"))
            .color("#EC7000").logoUrl("https://logo.clearbit.com/itau.com.br").build());

        Category salario = categoryRepo.save(Category.builder().name("Salário").type(CategoryType.INCOME).color("#10B981").icon("💰").build());
        Category alimentacao = categoryRepo.save(Category.builder().name("Alimentação").type(CategoryType.EXPENSE).color("#EF4444").icon("🍔").build());
        Category transporte = categoryRepo.save(Category.builder().name("Transporte").type(CategoryType.EXPENSE).color("#F59E0B").icon("🚗").build());
        Category lazer = categoryRepo.save(Category.builder().name("Lazer").type(CategoryType.EXPENSE).color("#8B5CF6").icon("🎮").build());
        Category apostas = categoryRepo.save(Category.builder().name("Apostas").type(CategoryType.INCOME).color("#F59E0B").icon("🎰").build());

        cardRepo.save(CreditCard.builder()
            .name("Roxinho").bankName("Nubank").bankAccount(nubank)
            .creditLimit(new BigDecimal("8000")).usedLimit(new BigDecimal("2300"))
            .closingDay(15).dueDay(22).color("#820AD1")
            .logoUrl("https://logo.clearbit.com/nubank.com.br").build());

        Random rnd = new Random(42);
        for (int m = 5; m >= 0; m--) {
            LocalDate base = LocalDate.now().minusMonths(m).withDayOfMonth(5);
            txRepo.save(Transaction.builder().date(base).description("Salário").amount(new BigDecimal("8500")).type(TransactionType.INCOME).category(salario).bankAccount(itau).status(TransactionStatus.PAID).build());
            for (int d = 0; d < 15; d++) {
                BigDecimal amt = new BigDecimal(50 + rnd.nextInt(300));
                txRepo.save(Transaction.builder().date(base.plusDays(rnd.nextInt(25))).description("Despesa " + d).amount(amt).type(TransactionType.EXPENSE).category(d % 2 == 0 ? alimentacao : transporte).bankAccount(nubank).status(TransactionStatus.PAID).build());
            }
        }

        investRepo.save(Investment.builder().name("PETR4").ticker("PETR4").type(InvestmentType.STOCKS).bankAccount(itau).initialAmount(new BigDecimal("10000")).currentValue(new BigDecimal("12500")).startDate(LocalDate.now().minusMonths(12)).isActive(true).build());
        investRepo.save(Investment.builder().name("Bitcoin").ticker("BTC").type(InvestmentType.CRYPTO).bankAccount(nubank).initialAmount(new BigDecimal("5000")).currentValue(new BigDecimal("8200")).startDate(LocalDate.now().minusMonths(8)).isActive(true).build());
        investRepo.save(Investment.builder().name("Apostas Esportivas").type(InvestmentType.BETTING).bankAccount(nubank).initialAmount(new BigDecimal("2000")).currentValue(new BigDecimal("3100")).startDate(LocalDate.now().minusMonths(3)).isActive(true).build());
    }
}
