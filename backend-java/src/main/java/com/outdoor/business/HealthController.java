package com.outdoor.business;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    public HealthController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @GetMapping("/health") public Map<String,Object> health() {
        jdbc.queryForObject("SELECT 1",Integer.class);
        return Map.of("ok",true,"service","outdoor-business","persistence","JDBC","productionReady",false,"authentication","LOCAL_ANONYMOUS_SESSION_ONLY");
    }
}
