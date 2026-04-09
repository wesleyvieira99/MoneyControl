package com.moneycontrol;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MoneyControlApplication {
    public static void main(String[] args) {
        SpringApplication.run(MoneyControlApplication.class, args);
    }
}
