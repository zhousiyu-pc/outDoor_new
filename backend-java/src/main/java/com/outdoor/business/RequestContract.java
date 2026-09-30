package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Component
public class RequestContract {
    private final JsonSupport json;
    public RequestContract(JsonSupport json) { this.json = json; }
    public ObjectNode body(JsonNode input) {
        if (input == null || !input.isObject() || input.toString().length() > 32768) throw ApiException.invalid("请求必须是有效 JSON 对象，且不超过 32 KB。");
        return ((ObjectNode) input).deepCopy();
    }
    public String text(JsonNode body, String field, int max, boolean required) {
        JsonNode value = body.get(field);
        if (value == null || value.isNull()) { if (required) throw ApiException.invalid(field + " 必填。"); return ""; }
        if (!value.isTextual() || value.textValue().length() > max || (required && value.textValue().isBlank())) throw ApiException.invalid(field + " 格式或长度不正确。");
        return value.textValue().trim();
    }
    public String identifier(JsonNode body, String field, boolean required) {
        String value = text(body, field, 128, required);
        if (!value.isEmpty() && !value.matches("[A-Za-z0-9_.:-]+")) throw ApiException.invalid(field + " 格式不正确。");
        return value;
    }
    public String session(ObjectNode body, String header) {
        String fromBody = identifier(body, "anonymousSessionId", false);
        String value = header == null ? fromBody : header;
        if (value.isBlank() || !value.matches("[A-Za-z0-9_.:-]{8,128}")) throw ApiException.invalid("需要有效 anonymousSessionId。");
        if (header != null && !fromBody.isEmpty() && !header.equals(fromBody)) throw ApiException.invalid("会话标识不一致。");
        return value;
    }
    public String key(ObjectNode body, String header) {
        String value = header == null ? identifier(body, "clientRequestId", true) : header;
        if (!value.matches("[A-Za-z0-9_.:-]{1,128}")) throw ApiException.invalid("需要有效 Idempotency-Key。");
        return value;
    }
    public void strings(JsonNode body, String field, int maxItems, int maxLength) {
        JsonNode value = body.get(field);
        if (value == null || value.isNull()) return;
        if (!value.isArray() || value.size() > maxItems) throw ApiException.invalid(field + " 必须是有效数组。");
        for (JsonNode item : value) if (!item.isTextual() || item.textValue().length() > maxLength) throw ApiException.invalid(field + " 内容格式不正确。");
    }
    public void bool(JsonNode body, String field) {
        if (body.hasNonNull(field) && !body.get(field).isBoolean()) throw ApiException.invalid(field + " 必须是布尔值。");
    }
    public ObjectNode search(ObjectNode body, String requestId) {
        ObjectNode result = json.object();
        String queryField = body.has("query") ? "query" : body.has("message") ? "message" : "destinationHint";
        String query = searchString(body.get(queryField), "query", 120, true);
        result.put("query", query).put("message", query).put("requestId", requestId).put("criteriaVersion", "1");
        ObjectNode origin = json.object();
        if (body.has("origin") && body.get("origin").isNull()) throw ApiException.invalid("origin 必须是对象。");
        if (body.hasNonNull("origin") && body.get("origin").isObject()) origin = ((ObjectNode)body.get("origin")).deepCopy();
        else if (body.hasNonNull("origin") && body.get("origin").isTextual()) origin.put("label", body.get("origin").asText());
        else if (body.hasNonNull("origin") && !body.get("origin").isTextual()) throw ApiException.invalid("origin 必须是对象。");
        Map<String,Integer> originLimits = Map.of("label", 120, "city", 80, "source", 80);
        for (String field : List.of("label", "city", "source")) {
            String alias = "label".equals(field) ? "originLabel" : field;
            if (!origin.has(field) && body.has(alias)) origin.set(field, body.get(alias));
            if (origin.hasNonNull(field)) searchString(origin.get(field), "origin." + field, originLimits.get(field), false);
            else origin.remove(field);
        }
        if (body.hasNonNull("originPoint")) {
            if (!body.get("originPoint").isObject()) throw ApiException.invalid("originPoint 必须是对象。");
            JsonNode point = body.get("originPoint");
            for (String f : List.of("lng", "lat")) {
                String alias = "lng".equals(f) ? "longitude" : "latitude";
                if (!origin.has(f) && point.has(f)) origin.set(f, point.get(f));
                if (!origin.has(f) && point.has(alias)) origin.set(f, point.get(alias));
            }
        }
        origin.retain(List.of("label","city","source","lng","lat"));
        validatePoint(origin, false);
        result.set("origin", origin); result.put("originLabel", origin.path("label").asText());
        ObjectNode preferences = json.object();
        if (body.has("preferences") && body.get("preferences").isNull()) throw ApiException.invalid("preferences 必须是对象。");
        if (body.hasNonNull("preferences")) {
            if (!body.get("preferences").isObject()) throw ApiException.invalid("preferences 必须是对象。");
            preferences = ((ObjectNode)body.get("preferences")).deepCopy();
        }
        for (String f : List.of("ageRange", "duration", "difficulty", "transport", "activityType", "driveLimitMinutes", "scenePreferences", "safetyNeeds", "companions")) {
            if (!preferences.has(f) && body.has(f)) preferences.set(f, body.get(f));
        }
        preferences.retain(List.of("ageRange","duration","difficulty","transport","activityType","driveLimitMinutes","scenePreferences","safetyNeeds","companions"));
        for (String f : List.of("ageRange", "duration", "difficulty", "transport", "activityType")) if (preferences.has(f)) searchString(preferences.get(f), "preferences." + f, 80, false);
        for (String f : List.of("scenePreferences", "safetyNeeds", "companions")) if (preferences.has(f)) {
            JsonNode values = preferences.get(f);
            if (!values.isArray() || values.size() > 12) throw ApiException.invalid(f + " 必须是最多 12 项的数组。");
            for (JsonNode value : values) searchString(value, "preferences." + f, 80, true);
        }
        if (preferences.has("driveLimitMinutes")) integer(preferences.get("driveLimitMinutes"), "driveLimitMinutes", 1, 1440);
        result.set("preferences", preferences);
        // Flat aliases keep the existing Agent adapters compatible without losing canonical fields.
        preferences.fields().forEachRemaining(e -> result.set(e.getKey(), e.getValue()));
        if (body.hasNonNull("departureTime")) {
            if (!body.get("departureTime").isObject()) throw ApiException.invalid("departureTime 必须是对象。");
            ObjectNode departure=((ObjectNode)body.get("departureTime")).deepCopy();
            // Local picker metadata is not part of the Agent contract.
            departure.remove("userSelected");
            Map<String,Integer> departureLimits = Map.of("mode",80,"iso",64,"timezone",64,"date",10,"time",8,"label",120);
            var fields = departure.fields();
            while (fields.hasNext()) { var field = fields.next(); if (!departureLimits.containsKey(field.getKey())) throw ApiException.invalid("departureTime 包含未知字段。"); searchString(field.getValue(), "departureTime." + field.getKey(), departureLimits.get(field.getKey()), false); }
            if (departure.hasNonNull("iso") && !departure.get("iso").asText().isEmpty()) {
                try { OffsetDateTime.parse(departure.get("iso").asText()); } catch (Exception e) { throw ApiException.invalid("departureTime.iso 必须是包含时区的 ISO 时间。"); }
            }
            ObjectNode cleanDeparture=((ObjectNode)departure).deepCopy();
            cleanDeparture.retain(List.of("mode","iso","timezone","date","time","label"));
            result.set("departureTime",cleanDeparture);
        }
        ObjectNode policy=json.object();
        if (body.has("sourcePolicy") && body.get("sourcePolicy").isNull()) throw ApiException.invalid("sourcePolicy 必须是对象。");
        if (body.hasNonNull("sourcePolicy")) {
            if (!body.get("sourcePolicy").isObject()) throw ApiException.invalid("sourcePolicy 必须是对象。");
            policy=((ObjectNode)body.get("sourcePolicy")).deepCopy();
        }
        policy.retain(List.of("includeSystem","includeMap","includeGuide","includeUserShared","limit"));
        for (String f:List.of("includeSystem","includeMap","includeGuide","includeUserShared")) {
            if (!policy.has(f)) { if (body.has(f)) policy.set(f,body.get(f)); else policy.put(f,true); }
            if (!policy.get(f).isBoolean()) throw ApiException.invalid(f + " 必须是布尔值。");
        }
        if (!policy.has("limit")) { if (body.has("limit")) policy.set("limit",body.get("limit")); else policy.put("limit",10); }
        integer(policy.get("limit"), "limit", 1, 50);
        result.set("sourcePolicy",policy);
        return result;
    }

    private String searchString(JsonNode value, String field, int max, boolean required) {
        if (value == null || !value.isTextual()) throw ApiException.invalid(field + " 必须是字符串。");
        String valueText = value.textValue();
        if (valueText.codePointCount(0, valueText.length()) > max || (required && valueText.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c) || c == 0x85))) throw ApiException.invalid(field + " 格式或长度不正确。");
        for (int i = 0; i < valueText.length(); i++) {
            char c = valueText.charAt(i);
            if (Character.isHighSurrogate(c)) { if (++i >= valueText.length() || !Character.isLowSurrogate(valueText.charAt(i))) throw ApiException.invalid(field + " 包含无效字符。"); }
            else if (Character.isLowSurrogate(c)) throw ApiException.invalid(field + " 包含无效字符。");
        }
        return valueText;
    }
    private void integer(JsonNode value, String field, int minimum, int maximum) {
        if (!value.isIntegralNumber() || !value.canConvertToInt() || value.intValue() < minimum || value.intValue() > maximum) throw ApiException.invalid(field + " 必须在 " + minimum + "–" + maximum + " 之间。");
    }
    public void validatePoint(ObjectNode point, boolean strict) {
        boolean hasLng=point.hasNonNull("lng"), hasLat=point.hasNonNull("lat");
        if (!hasLng && !hasLat) { point.remove(List.of("lng","lat")); return; }
        if (!hasLng || !hasLat || !point.get("lng").isNumber() || !point.get("lat").isNumber()) throw new ApiException(400,"ORIGIN_INVALID","坐标必须是成对的有限数值。");
        double lng = point.get("lng").asDouble(), lat = point.get("lat").asDouble();
        if (!Double.isFinite(lng) || !Double.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) throw new ApiException(400,"ORIGIN_INVALID","坐标超出有效范围。");
        boolean valid=hasLng && hasLat && Double.isFinite(point.get("lng").asDouble()) && Double.isFinite(point.get("lat").asDouble()) && point.get("lng").asDouble()>=73 && point.get("lng").asDouble()<=135 && point.get("lat").asDouble()>=3 && point.get("lat").asDouble()<=54;
        if (!valid && strict) throw new ApiException(400,"ORIGIN_INVALID","坐标不在支持范围内。");
        if (!valid) point.remove(List.of("lng","lat"));
    }
    public ObjectNode feedback(ObjectNode body) {
        strings(body,"tags",12,80); text(body,"note",2000,false); bool(body,"shareExperience");
        if ((!body.has("tags") || body.path("tags").size()==0) && text(body,"note",2000,false).isBlank()) throw ApiException.invalid("请填写反馈内容。");
        ObjectNode result=json.object();
        for (String f:List.of("tags","note","shareExperience")) if (body.has(f)) result.set(f,body.get(f));
        return result;
    }
    public ObjectNode submission(ObjectNode body) {
        strings(body,"tags",12,80); text(body,"note",2000,false); bool(body,"shareExperience");
        ObjectNode result=json.object();
        for (String f:List.of("tags","note","shareExperience")) if (body.has(f)) result.set(f,body.get(f));
        result.put("title",text(body,"title",120,true));
        for (String f:List.of("startPoint","endPoint")) {
            JsonNode point=body.get(f);
            if (point==null || point.isNull() || (point.isTextual() && point.asText().isBlank())) {
                if ("endPoint".equals(f)) continue;
                throw ApiException.invalid(f + " 必填。");
            }
            if (point.isTextual()) result.put(f,text(body,f,255,true));
            else if (point.isObject()) {
                ObjectNode copy=((ObjectNode)point).deepCopy();
                copy.retain(List.of("name","address","lng","lat"));
                text(copy,"name",255,true); text(copy,"address",500,false); validatePoint(copy,true); result.set(f,copy);
            } else throw ApiException.invalid(f + " 格式不正确。");
        }
        return result;
    }
}
