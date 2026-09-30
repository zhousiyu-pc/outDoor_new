package com.outdoor.business;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class RequestContractTest {
    private final JsonSupport json = new JsonSupport(new ObjectMapper());
    private final RequestContract contract = new RequestContract(json);
    private ObjectNode request() { return json.object().put("query", "户外路线"); }
    private ObjectNode normalize(ObjectNode body) { return contract.search(body, "req_server"); }

    @Test void originLengthsAndFlatAliasesMatchAgentBoundary() {
        Map<String,Integer> limits = Map.of("label",120,"city",80,"source",80);
        for (var entry : limits.entrySet()) {
            ObjectNode body = request(); body.putObject("origin").put(entry.getKey(), "城".repeat(entry.getValue()));
            assertEquals(entry.getValue(), normalize(body).path("origin").path(entry.getKey()).asText().length());
            ((ObjectNode)body.get("origin")).put(entry.getKey(), "城".repeat(entry.getValue()+1));
            assertThrows(ApiException.class, () -> normalize(body));
        }
        ObjectNode body=request().put("city","深圳").put("originLabel","龙岗").put("source","wx_location");
        body.putObject("originPoint").put("longitude",114.1).put("latitude",22.6);
        ObjectNode result=normalize(body);
        assertEquals("深圳",result.path("origin").path("city").asText());
        assertEquals(114.1,result.path("origin").path("lng").asDouble());
        body.putObject("origin").put("city","广州");
        assertEquals("广州",normalize(body).path("origin").path("city").asText());
    }
    @Test void numericAndCoordinateBoundsMatchAgent() {
        for (int value : new int[]{1,1440}) assertEquals(value,normalize(request().put("driveLimitMinutes",value)).path("preferences").path("driveLimitMinutes").asInt());
        for (int value : new int[]{0,1441}) assertThrows(ApiException.class,()->normalize(request().put("driveLimitMinutes",value)));
        for (int value : new int[]{1,50}) assertEquals(value,normalize(request().put("limit",value)).path("sourcePolicy").path("limit").asInt());
        for (int value : new int[]{0,51}) assertThrows(ApiException.class,()->normalize(request().put("limit",value)));
        ObjectNode body=request();body.putObject("origin").put("lng",135).put("lat",54);
        assertEquals(135,normalize(body).path("origin").path("lng").asInt());
        ((ObjectNode)body.get("origin")).put("lng",135.1);assertFalse(normalize(body).path("origin").has("lng"));
        ((ObjectNode)body.get("origin")).put("lng",181);assertThrows(ApiException.class,()->normalize(body));
        ((ObjectNode)body.get("origin")).put("lng",114).remove("lat");assertThrows(ApiException.class,()->normalize(body));
    }
    @Test void departureAndOptionalFieldTypesFailBeforeAgent() {
        Map<String,Integer> lengths=Map.of("mode",80,"timezone",64,"date",10,"time",8,"label",120);
        for (var entry:lengths.entrySet()) {
            ObjectNode body=request();body.putObject("departureTime").put(entry.getKey(),"x".repeat(entry.getValue()));normalize(body);
            ((ObjectNode)body.get("departureTime")).put(entry.getKey(),"x".repeat(entry.getValue()+1));assertThrows(ApiException.class,()->normalize(body));
            ((ObjectNode)body.get("departureTime")).putNull(entry.getKey());assertThrows(ApiException.class,()->normalize(body));
        }
        ObjectNode iso=request();iso.putObject("departureTime").put("iso","2026-09-29T15:00:00+08:00");normalize(iso);
        ((ObjectNode)iso.get("departureTime")).put("iso","2026-09-29T15:00:00");assertThrows(ApiException.class,()->normalize(iso));
        ((ObjectNode)iso.get("departureTime")).put("iso"," ");assertThrows(ApiException.class,()->normalize(iso));
        for (String field:List.of("origin","preferences","sourcePolicy","driveLimitMinutes","scenePreferences","ageRange","includeMap","limit")) assertThrows(ApiException.class,()->normalize(request().putNull(field)));
        ObjectNode list=request();list.putArray("scenePreferences").add(" ");assertThrows(ApiException.class,()->normalize(list));
    }
    @Test void unicodeQueryNestedOverridesAndExtraPreferencesStayCompatible() {
        assertEquals(120,normalize(request().put("query","🌲".repeat(120))).path("query").asText().codePointCount(0,240));
        assertThrows(ApiException.class,()->normalize(request().put("query","🌲".repeat(121))));
        assertThrows(ApiException.class,()->normalize(request().put("query"," ").put("message","不能掩盖空query")));
        assertThrows(ApiException.class,()->normalize(request().put("query",String.valueOf((char)0xD800))));
        ObjectNode body=request().put("includeMap",false).put("activityType","hiking");
        body.putArray("companions").add("children");body.putObject("sourcePolicy").put("includeMap",true);
        assertTrue(normalize(body).path("sourcePolicy").path("includeMap").asBoolean());
        assertEquals("children",normalize(body).path("preferences").path("companions").get(0).asText());
        assertFalse(normalize(body).has("anonymousSessionId"));
    }
    @Test void realClientCustomDepartureStripsPickerMetadata() {
        ObjectNode body=request();
        body.putObject("departureTime").put("mode","CUSTOM").put("iso","2026-10-01T01:00:00Z").put("date","2026-10-01").put("time","09:00").put("label","自定义时间").put("userSelected",true);
        ObjectNode normalized=normalize(body);
        assertEquals("2026-10-01T01:00:00Z",normalized.path("departureTime").path("iso").asText());
        assertFalse(normalized.path("departureTime").has("userSelected"));
        assertTrue(body.path("departureTime").path("userSelected").asBoolean());
    }
}
