package com.outdoor.business;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import java.time.Clock;
import java.util.Arrays;

@SpringBootApplication
public class BusinessApplication {
    public static void main(String[] args) { SpringApplication.run(BusinessApplication.class, args); }
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean String productionGate(Environment environment) {
        if (Arrays.asList(environment.getActiveProfiles()).contains("production")) {
            throw new IllegalStateException("Production is blocked: anonymous sessions are not authentication; complete B4 security and database gates first");
        }
        if (Arrays.asList(environment.getActiveProfiles()).contains("mysql") && !"true".equals(environment.getProperty("app.allow-unauthenticated-test-database"))) {
            throw new IllegalStateException("MySQL profile is restricted to explicitly acknowledged local/test databases; production authentication is not implemented");
        }
        return "LOCAL_OR_TEST_ONLY";
    }
}
