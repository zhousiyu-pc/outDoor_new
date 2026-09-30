package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.function.Function;
import static com.outdoor.business.IdempotencyService.Result;

@RestController
@RequestMapping({"/api/v1","/api"})
public class ApiController {
    private final BusinessService service;
    private final IdempotencyService idempotency;
    private final RequestContract contract;
    private final SessionRateLimiter limiter;
    public ApiController(BusinessService service,IdempotencyService idempotency,RequestContract contract,SessionRateLimiter limiter) {
        this.service=service;this.idempotency=idempotency;this.contract=contract;this.limiter=limiter;
    }
    @PostMapping("/user/search/recommendations")
    public ResponseEntity<JsonNode> search(@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);
        return write("search",body,request,session -> service.search(body,session,(String)request.getAttribute("correlationId")));
    }
    @GetMapping("/user/candidates/{id}") public ObjectNode candidate(@PathVariable String id) { return service.detail("candidate",id); }
    @GetMapping("/user/routes/{id}") public ObjectNode route(@PathVariable String id) { return service.detail("route",id); }
    @GetMapping("/user/recommendation/{id}") public ObjectNode legacyDetail(@PathVariable String id) { return service.detail("either",id); }
    @PostMapping("/user/routes/adoptions")
    public ResponseEntity<JsonNode> adoption(@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);return write("adoption",body,request,session -> service.adopt(body,session));
    }
    @PostMapping("/user/search/events")
    public ResponseEntity<JsonNode> event(@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);return write("event",body,request,session -> service.event(body,session));
    }
    @PostMapping("/user/route-feedback")
    public ResponseEntity<JsonNode> feedback(@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);return write("feedback",body,request,session -> service.feedback(body,session));
    }
    @PostMapping({"/user/routes/{id}/feedback","/user/routes/by-shortline/{id}/feedback"})
    public ResponseEntity<JsonNode> routeFeedback(@PathVariable String id,@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);
        if (body.hasNonNull("routeAssetId") && !id.equals(body.path("routeAssetId").asText())) throw ApiException.invalid("路线标识不一致。");
        body.put("routeAssetId",id);return write("feedback",body,request,session -> service.feedback(body,session));
    }
    @PostMapping({"/user/route-submissions","/user/routes"})
    public ResponseEntity<JsonNode> submission(@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);return write("submission",body,request,session -> service.submit(body,session));
    }
    @PostMapping("/map/reverse-geocode")
    public ResponseEntity<JsonNode> geocode(@RequestBody JsonNode input,HttpServletRequest request) {
        ObjectNode body=contract.body(input);return write("geocode",body,request,session -> service.reverseGeocode(body));
    }
    private ResponseEntity<JsonNode> write(String operation,ObjectNode body,HttpServletRequest request,Function<String,Result> action) {
        String session=contract.session(body,request.getHeader("X-Anonymous-Session-Id"));
        String key=contract.key(body,request.getHeader("Idempotency-Key"));
        limiter.check(session);
        Result result=idempotency.execute(session,operation,key,body,() -> action.apply(session));
        return ResponseEntity.status(result.status()).body(result.body());
    }
}
