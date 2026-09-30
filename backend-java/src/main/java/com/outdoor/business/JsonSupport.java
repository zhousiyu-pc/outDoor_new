package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.TreeMap;
import java.util.UUID;

@Component
public class JsonSupport {
    final ObjectMapper mapper;
    public JsonSupport(ObjectMapper mapper) { this.mapper = mapper; }
    public ObjectNode object() { return mapper.createObjectNode(); }
    public JsonNode read(String value) {
        try { return mapper.readTree(value); } catch (Exception e) { throw new IllegalStateException("Invalid stored JSON", e); }
    }
    public String write(JsonNode node) { return node.toString(); }
    public String id(String prefix) { return prefix + "_" + UUID.randomUUID().toString().replace("-", ""); }
    public String hash(JsonNode body) {
        ObjectNode content = ((ObjectNode)body).deepCopy();
        content.remove(java.util.List.of("clientRequestId", "anonymousSessionId"));
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical(content).toString().getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private JsonNode canonical(JsonNode node) {
        if (node.isObject()) {
            TreeMap<String, JsonNode> sorted = new TreeMap<>();
            node.fields().forEachRemaining(e -> sorted.put(e.getKey(), canonical(e.getValue())));
            ObjectNode result = object(); sorted.forEach(result::set); return result;
        }
        if (node.isArray()) { var array = mapper.createArrayNode(); node.forEach(v -> array.add(canonical(v))); return array; }
        return node;
    }
}
