package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.function.Supplier;

@Service
public class IdempotencyService {
    public record Result(int status,JsonNode body) {}
    private final BusinessRepository repository;
    private final TransactionTemplate transaction;
    private final JsonSupport json;
    private final Clock clock;
    public IdempotencyService(BusinessRepository repository,TransactionTemplate transaction,JsonSupport json,Clock clock) {
        this.repository=repository; this.transaction=transaction; this.json=json; this.clock=clock;
    }
    public Result execute(String session,String operation,String key,JsonNode body,Supplier<Result> work) {
        String hash=json.hash(body);
        var prior=find(session,operation,key);
        if (prior.isPresent()) return replay(prior.get(),hash);
        try {
            return transaction.execute(status -> {
                repository.update("INSERT INTO idempotency_record(session_id,operation,idem_key,body_hash,created_at) VALUES(?,?,?,?,?)",session,operation,key,hash,Instant.now(clock).toString());
                Result result=work.get();
                repository.update("UPDATE idempotency_record SET response_payload=?,http_status=? WHERE session_id=? AND operation=? AND idem_key=?",json.write(result.body()),result.status(),session,operation,key);
                return result;
            });
        } catch (DuplicateKeyException e) {
            // A competing transaction committed the same key. Reading outside the failed transaction is essential.
            var stored=find(session,operation,key);
            if (stored.isEmpty()) throw e;
            return replay(stored.get(),hash);
        }
    }
    private java.util.Optional<Map<String,Object>> find(String session,String operation,String key) {
        return repository.one("SELECT body_hash,response_payload,http_status FROM idempotency_record WHERE session_id=? AND operation=? AND idem_key=?",session,operation,key);
    }
    private Result replay(Map<String,Object> row,String hash) {
        if (!hash.equals(repository.value(row,"body_hash"))) throw new ApiException(409,"IDEMPOTENCY_CONFLICT","同一幂等键不能用于不同请求。");
        if (row.get("response_payload")==null) throw new ApiException(409,"REQUEST_IN_PROGRESS","请求处理中。",true);
        return new Result(((Number)row.get("http_status")).intValue(),json.read(repository.value(row,"response_payload")));
    }
}
