package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class AgentClient {
    public record Outcome(JsonNode body,String failureCode) { public boolean failed() { return failureCode!=null; } }
    private final ThreadPoolExecutor calls=new ThreadPoolExecutor(4,4,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(8),r -> { Thread t=new Thread(r,"agent-call"); t.setDaemon(true); return t; },new ThreadPoolExecutor.AbortPolicy());
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofMillis(400)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final AtomicInteger failures=new AtomicInteger();
    private volatile long openUntil;
    private final JsonSupport json;
    private final URI endpoint;
    private final String token;
    private final int timeoutMs;
    public AgentClient(JsonSupport json,@Value("${app.agent.base-url}") String baseUrl,@Value("${app.agent.token:}") String token,@Value("${app.agent.timeout-ms:1200}") int timeoutMs) {
        this.json=json; this.endpoint=URI.create(baseUrl.replaceAll("/+$","")+"/v1/route-candidates"); this.token=token; this.timeoutMs=timeoutMs;
        if (!java.util.Set.of("http","https").contains(endpoint.getScheme())) throw new IllegalArgumentException("Agent URL must use HTTP(S)");
    }
    public Outcome search(ObjectNode request,String correlationId) {
        if (System.nanoTime()<openUntil) return new Outcome(null,"AGENT_CIRCUIT_OPEN");
        java.util.concurrent.Future<JsonNode> future=null;
        try {
            future=calls.submit(() -> {
                HttpRequest.Builder builder=HttpRequest.newBuilder(endpoint).timeout(Duration.ofMillis(timeoutMs)).header("Content-Type","application/json").header("X-Correlation-Id",correlationId).POST(HttpRequest.BodyPublishers.ofString(request.toString()));
                if (!token.isBlank()) builder.header("Authorization","Bearer "+token);
                HttpResponse<InputStream> response=client.send(builder.build(),HttpResponse.BodyHandlers.ofInputStream());
                try (InputStream body=response.body()) {
                    if (response.statusCode()!=200) throw new IllegalStateException("Agent rejected request");
                    byte[] bytes=body.readNBytes(262145);
                    if (bytes.length>262144) throw new IllegalStateException("Agent response too large");
                    JsonNode parsed=json.mapper.readTree(bytes);
                    if (parsed==null || !parsed.isObject() || !parsed.path("ok").asBoolean(false) || !parsed.path("items").isArray() || parsed.path("items").size()>50) throw new IllegalStateException("Agent response contract mismatch");
                    return parsed;
                }
            });
            JsonNode body=future.get(timeoutMs,TimeUnit.MILLISECONDS);
            failures.set(0); return new Outcome(body,null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); if (future!=null) future.cancel(true); return failure("AGENT_UNAVAILABLE");
        } catch (java.util.concurrent.TimeoutException e) {
            if (future!=null) future.cancel(true); return failure("AGENT_TIMEOUT");
        } catch (Exception e) {
            if (future!=null) future.cancel(true); return failure("SOURCE_DEGRADED");
        }
    }
    private Outcome failure(String code) {
        if (failures.incrementAndGet()>=3) { openUntil=System.nanoTime()+TimeUnit.SECONDS.toNanos(10); failures.set(0); }
        return new Outcome(null,code);
    }
    @PreDestroy public void close() { calls.shutdownNow(); }
}
