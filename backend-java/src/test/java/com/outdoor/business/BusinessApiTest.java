package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.ArrayList;
import java.util.concurrent.Executors;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:business_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000"})
@AutoConfigureMockMvc
class BusinessApiTest {
    @Autowired MockMvc mvc;
    @Autowired JsonSupport json;
    @Autowired JdbcTemplate jdbc;
    @MockBean AgentClient agent;
    private String session;
    @BeforeEach void resetData() {
        for (String table:new String[]{"idempotency_record","business_status_history","user_route_feedback","route_submission","search_event","route_adoption_event","route_asset","recommendation_result_item","recommendation_result","route_candidate_source","route_candidate","recommendation_request"}) jdbc.update("DELETE FROM "+table);
        session="session_"+System.nanoTime();
        when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(evidenceResponse(),null));
    }
    private JsonNode evidenceResponse() {
        ObjectNode candidate=json.object().put("title","湖边步道").put("subtitle","湖边步行").put("sourceType","GUIDE_PUBLIC").put("sourceLabel","授权来源").put("collectedAt",Instant.now().toString()).put("previewOnly",false);
        candidate.put("query","private query").put("anonymousSessionId","private session").put("note","private note");
        candidate.putArray("matchReasons").add("强度较低");candidate.putArray("missingItems").add("核实开放时间");candidate.putArray("riskWarnings").add("雨后路滑");
        candidate.putObject("routeStats").put("walkDistanceText","3 km");candidate.putObject("geo").put("name","步道入口").put("lng",114.1).put("lat",22.6);
        candidate.putArray("sourceEvidence").addObject().put("sourceId","authorized-record-1").put("type","GUIDE_PUBLIC").put("accessMode","AUTHORIZED_API").put("label","授权测试来源").put("collectedAt",Instant.now().toString()).put("expiresAt",Instant.now().plusSeconds(3600).toString());
        ObjectNode response=json.object().put("ok",true).put("status","READY");response.putArray("items").add(candidate);response.putArray("warnings");return response;
    }
    private JsonNode postJson(String path,JsonNode body,String key,int status) throws Exception {
        String response=mvc.perform(post(path).contentType("application/json").header("X-Anonymous-Session-Id",session).header("Idempotency-Key",key).content(body.toString())).andExpect(status().is(status)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return json.read(response);
    }
    private JsonNode search() throws Exception { return postJson("/api/v1/user/search/recommendations",json.object().put("query","亲子步道"),json.id("search"),200); }
    private ObjectNode adoption(JsonNode search) { return json.object().put("requestId",search.path("requestId").asText()).put("candidateId",search.path("items").get(0).path("candidateId").asText()); }
    private int count(String table) { return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class); }
    @Test void forwardsAllCriteriaAndStripsReservedKeys() throws Exception {
        ObjectNode request=json.object().put("query","亲子步道");
        request.putObject("origin").put("label","深圳").put("lng",114.1).put("lat",22.6).put("secret","no");
        request.putObject("preferences").put("ageRange","6-10岁").put("duration","半天").put("difficulty","轻松").put("transport","自驾").put("driveLimitMinutes",45).put("requestId","injected").putArray("scenePreferences").add("绿道");
        ((ObjectNode)request.get("preferences")).putArray("safetyNeeds").add("停车方便");
        request.putObject("departureTime").put("iso","2026-09-29T10:00:00Z").put("mode","CUSTOM").put("timezone","Asia/Shanghai");
        request.putObject("sourcePolicy").put("includeGuide",true).put("limit",5);
        JsonNode response=postJson("/api/v1/user/search/recommendations",request,"forward",200);
        var capture=org.mockito.ArgumentCaptor.forClass(ObjectNode.class);verify(agent).search(capture.capture(),anyString());JsonNode sent=capture.getValue();
        assertEquals(response.path("requestId"),sent.path("requestId"));assertEquals(45,sent.path("preferences").path("driveLimitMinutes").asInt());
        assertEquals("停车方便",sent.path("preferences").path("safetyNeeds").get(0).asText());assertEquals(request.get("departureTime"),sent.get("departureTime"));
        assertFalse(sent.path("origin").has("secret"));assertFalse(sent.path("preferences").has("requestId"));assertFalse(sent.has("anonymousSessionId"));
        assertEquals(1,count("recommendation_request"));assertEquals(1,count("route_candidate_source"));assertEquals(1,count("recommendation_result_item"));assertEquals(0,count("route_asset"));
        String candidate=response.path("items").get(0).path("candidateId").asText();
        // No frontend cache/session is supplied. Details come from the persistent snapshot.
        mvc.perform(get("/api/v1/user/candidates/"+candidate)).andExpect(status().isOk()).andExpect(jsonPath("$.plan.title").value("湖边步道")).andExpect(jsonPath("$.plan.query").doesNotExist()).andExpect(jsonPath("$.plan.anonymousSessionId").doesNotExist()).andExpect(jsonPath("$.plan.note").doesNotExist()).andExpect(jsonPath("$.plan.rawRef.candidateId").value(candidate));
    }
    @Test void legacyFlatCriteriaAndInvalidOriginAreNormalized() throws Exception {
        ObjectNode body=json.object().put("query","步道").put("originLabel","深圳").put("ageRange","6岁").put("driveLimitMinutes",45);
        body.putObject("originPoint").put("lng",0).put("lat",0);body.putArray("scenePreferences").add("绿道");
        postJson("/api/v1/user/search/recommendations",body,"flat",200);
        var capture=org.mockito.ArgumentCaptor.forClass(ObjectNode.class);verify(agent).search(capture.capture(),anyString());
        assertFalse(capture.getValue().path("origin").has("lng"));assertEquals("深圳",capture.getValue().path("origin").path("label").asText());assertEquals("6岁",capture.getValue().path("preferences").path("ageRange").asText());
    }
    @Test void replayConflictAndDifferentKeysKeepSingleAdoption() throws Exception {
        ObjectNode body=json.object().put("query","步道");JsonNode first=postJson("/api/v1/user/search/recommendations",body,"same-search",200);
        assertEquals(first,postJson("/api/v1/user/search/recommendations",body,"same-search",200));verify(agent,times(1)).search(any(),anyString());
        JsonNode conflict=postJson("/api/v1/user/search/recommendations",json.object().put("query","不同步道"),"same-search",409);assertEquals("IDEMPOTENCY_CONFLICT",conflict.path("error").path("code").asText());
        ObjectNode adoption=adoption(first);JsonNode route=postJson("/api/v1/user/routes/adoptions",adoption,"adopt1",200);
        assertEquals(route,postJson("/api/v1/user/routes/adoptions",adoption,"adopt1",200));assertEquals(route,postJson("/api/v1/user/routes/adoptions",adoption,"adopt2",200));
        assertEquals(1,count("route_asset"));assertEquals(1,count("route_adoption_event"));
        mvc.perform(get("/api/v1/user/routes/"+route.path("routeAssetId").asText())).andExpect(status().isOk()).andExpect(jsonPath("$.plan.routeAssetId").value(route.path("routeAssetId").asText()));
    }
    @Test void competingAdoptionsWithSameAndDifferentKeysAreAtomic() throws Exception {
        ObjectNode body=adoption(search());var pool=Executors.newFixedThreadPool(6);
        try {
            var futures=new ArrayList<java.util.concurrent.Future<JsonNode>>();
            for (int i=0;i<8;i++) {String key=i<4?"concurrent":("concurrent-"+i);futures.add(pool.submit(() -> postJson("/api/v1/user/routes/adoptions",body,key,200)));}
            String route=futures.get(0).get().path("routeAssetId").asText();
            for (var future:futures) assertEquals(route,future.get().path("routeAssetId").asText());
            assertEquals(1,count("route_asset"));assertEquals(1,count("route_adoption_event"));
        } finally { pool.shutdownNow(); }
    }
    @Test void rejectUnknownWrongSessionExpiredDisabledAndMock() throws Exception {
        JsonNode search=search();ObjectNode body=adoption(search);String candidate=body.path("candidateId").asText();
        postJson("/api/v1/user/routes/adoptions",json.object().put("candidateId","unknown").put("requestId",search.path("requestId").asText()),"unknown",404);
        String owner=session;session="another_session";assertEquals("CANDIDATE_NOT_OWNED_BY_REQUEST",postJson("/api/v1/user/routes/adoptions",body,"foreign",403).path("error").path("code").asText());session=owner;
        jdbc.update("UPDATE route_candidate SET expires_at=? WHERE candidate_id=?",Instant.now().minusSeconds(5).toString(),candidate);
        assertEquals("CANDIDATE_EXPIRED",postJson("/api/v1/user/routes/adoptions",body,"expired",409).path("error").path("code").asText());
        jdbc.update("UPDATE route_candidate SET expires_at=?,status='DISABLED' WHERE candidate_id=?",Instant.now().plusSeconds(3600).toString(),candidate);
        assertEquals("CANDIDATE_DISABLED",postJson("/api/v1/user/routes/adoptions",body,"disabled",409).path("error").path("code").asText());
        ObjectNode mock=(ObjectNode)evidenceResponse();((ObjectNode)mock.path("items").get(0)).put("previewOnly",true);
        when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(mock,null));JsonNode preview=search();assertTrue(preview.path("items").get(0).path("previewOnly").asBoolean());
        assertEquals("CANDIDATE_NOT_ADOPTABLE",postJson("/api/v1/user/routes/adoptions",adoption(preview),"mock",409).path("error").path("code").asText());
        assertEquals(0,count("route_asset"));assertEquals(0,count("route_adoption_event"));
    }
    @Test void evidenceExpiryAndMissingEvidenceBlockAdoption() throws Exception {
        JsonNode result=search();String candidate=result.path("items").get(0).path("candidateId").asText();
        ObjectNode payload=(ObjectNode)result.path("items").get(0);((ObjectNode)payload.path("sourceEvidence").get(0)).put("expiresAt",Instant.now().minusSeconds(5).toString());
        jdbc.update("UPDATE route_candidate SET payload=? WHERE candidate_id=?",payload.toString(),candidate);
        assertEquals("CANDIDATE_NOT_ADOPTABLE",postJson("/api/v1/user/routes/adoptions",adoption(result),"source-expired",409).path("error").path("code").asText());
        ObjectNode empty=(ObjectNode)evidenceResponse();((ObjectNode)empty.path("items").get(0)).putArray("sourceEvidence");when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(empty,null));
        JsonNode missing=search();assertTrue(missing.path("items").get(0).path("previewOnly").asBoolean());assertEquals(0,count("route_asset"));
    }
    @Test void feedbackEventsSubmissionsPersistWithoutCreatingAssets() throws Exception {
        JsonNode result=search();ObjectNode body=adoption(result);body.put("note","入口标注有误").put("shareExperience",false).putArray("tags").add("入口");
        JsonNode feedback=postJson("/api/v1/user/route-feedback",body,"feedback",201);assertEquals(feedback,postJson("/api/v1/user/route-feedback",body,"feedback",201));
        postJson("/api/v1/user/search/events",adoption(result).put("eventType","MAP_OPEN"),"event",201);
        ObjectNode submission=json.object().put("title","湖边小路").put("startPoint","公园北门").put("note","私人备注").put("shareExperience",false);
        assertEquals("REVIEW_PENDING",postJson("/api/v1/user/route-submissions",submission,"submission",201).path("status").asText());
        postJson("/api/v1/user/route-submissions",json.object().put("title","最小投稿").put("startPoint","东门"),"minimal",201);
        assertEquals(1,count("user_route_feedback"));assertEquals(1,count("search_event"));assertEquals(2,count("route_submission"));assertEquals(0,count("route_asset"));
        String stored=jdbc.queryForObject("SELECT payload FROM route_submission WHERE payload LIKE '%私人备注%'",String.class);assertFalse(json.read(stored).path("shareExperience").asBoolean(true));
    }
    @Test void noSourcesAndTimeoutNeverInventCandidates() throws Exception {
        when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(json.read("{\"ok\":true,\"status\":\"NO_SEARCH_RESULTS\",\"items\":[],\"warnings\":[\"SOURCE_NOT_CONFIGURED\"]}"),null));
        JsonNode none=search();assertEquals("NO_SEARCH_RESULTS",none.path("status").asText());assertEquals(0,none.path("items").size());
        when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(null,"AGENT_TIMEOUT"));JsonNode failed=search();assertEquals("DEGRADED",failed.path("status").asText());assertEquals(0,failed.path("items").size());assertEquals(0,count("route_candidate"));
    }
    @Test void sharedAssetFeedbackDoesNotClaimOriginalSearchOwnership() throws Exception {
        JsonNode result=search();JsonNode route=postJson("/api/v1/user/routes/adoptions",adoption(result),"adopt",200);
        session="shared_viewer_session";
        ObjectNode feedback=json.object().put("routeAssetId",route.path("routeAssetId").asText()).put("requestId",result.path("requestId").asText()).put("note","路径已更新");
        postJson("/api/v1/user/route-feedback",feedback,"shared-feedback",201);
        assertNull(jdbc.queryForObject("SELECT request_id FROM user_route_feedback",String.class));
        assertEquals(session,jdbc.queryForObject("SELECT session_id FROM user_route_feedback",String.class));
    }
    @Test void missingSessionKeyAndOversizedBodiesFailBeforePersistence() throws Exception {
        mvc.perform(post("/api/v1/user/search/recommendations").contentType("application/json").content("{\"query\":\"walk\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/user/search/recommendations").contentType("application/json").header("X-Anonymous-Session-Id",session).content("{\"query\":\"walk\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/user/search/recommendations").contentType("application/json").content("x".repeat(66000))).andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
        assertEquals(0,count("recommendation_request"));
    }
    @Test void partialSourceFailurePreservesUsefulDegradedResult() throws Exception {
        ObjectNode upstream=(ObjectNode)evidenceResponse();upstream.put("status","DEGRADED");upstream.putArray("warnings").add("CONNECTOR_TIMEOUT");
        when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(upstream,null));
        JsonNode response=search();assertEquals("DEGRADED",response.path("status").asText());assertEquals(1,response.path("items").size());
        assertFalse(response.path("items").get(0).path("previewOnly").asBoolean());assertEquals("CONNECTOR_TIMEOUT",response.path("warnings").get(0).asText());
        assertEquals("DEGRADED",jdbc.queryForObject("SELECT status FROM recommendation_request",String.class));
    }
    @Test void evidenceUrlsDropQueryAndFragmentInSearchSnapshotsAndColdDetails() throws Exception {
        ObjectNode upstream=(ObjectNode)evidenceResponse();ObjectNode evidence=(ObjectNode)upstream.path("items").get(0).path("sourceEvidence").get(0);
        evidence.put("url","https://source.example/routes/path%2Fone?signature=private-query#private-fragment");
        when(agent.search(any(),anyString())).thenReturn(new AgentClient.Outcome(upstream,null));
        JsonNode response=search();JsonNode item=response.path("items").get(0);String clean="https://source.example/routes/path%2Fone";
        assertEquals(clean,item.path("sourceEvidence").get(0).path("url").asText());assertEquals(clean,item.path("rawRef").path("sourceEvidence").get(0).path("url").asText());
        assertFalse(jdbc.queryForObject("SELECT payload FROM route_candidate_source",String.class).contains("private-"));
        assertFalse(jdbc.queryForObject("SELECT payload FROM recommendation_result",String.class).contains("private-"));
        ObjectNode oldPayload=((ObjectNode)item).deepCopy();((ObjectNode)oldPayload.path("sourceEvidence").get(0)).put("url",clean+"?legacy-secret=x#old-token");
        ((ObjectNode)oldPayload.path("rawRef").path("sourceEvidence").get(0)).put("url",clean+"?legacy-secret=x#old-token");
        jdbc.update("UPDATE route_candidate SET payload=? WHERE candidate_id=?",oldPayload.toString(),item.path("candidateId").asText());
        mvc.perform(get("/api/v1/user/candidates/"+item.path("candidateId").asText())).andExpect(status().isOk()).andExpect(jsonPath("$.plan.sourceEvidence[0].url").value(clean)).andExpect(jsonPath("$.plan.rawRef.sourceEvidence[0].url").value(clean));
    }
    @Test void invalidAgentBoundariesReturn400WithoutCallingAgent() throws Exception {
        ObjectNode body=json.object().put("query","路线").put("driveLimitMinutes",0);postJson("/api/v1/user/search/recommendations",body,"bad-drive",400);
        body.remove("driveLimitMinutes");body.putObject("origin").put("label","地".repeat(121));postJson("/api/v1/user/search/recommendations",body,"bad-label",400);
        verifyNoInteractions(agent);assertEquals(0,count("recommendation_request"));
    }
    @Test void validationAndMapDegradationAreExplicit() throws Exception {
        postJson("/api/v1/user/search/recommendations",json.object().put("query",7),"type",400);
        ObjectNode invalid=json.object().put("query","步道");invalid.putObject("preferences").put("scenePreferences","oops");postJson("/api/v1/user/search/recommendations",invalid,"array",400);
        mvc.perform(post("/api/v1/user/search/recommendations").contentType("application/json").content("{oops")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_REQUEST")).andExpect(jsonPath("$.correlationId").exists());
        mvc.perform(get("/api/v1/user/search/recommendations")).andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.error.code").value("METHOD_NOT_ALLOWED"));
        JsonNode geo=postJson("/api/v1/map/reverse-geocode",json.object().put("lng",114.1).put("lat",22.6).put("name","用户地点"),"geo",200);assertEquals("DEGRADED",geo.path("status").asText());assertEquals("用户地点",geo.path("label").asText());assertTrue(geo.path("provider").isNull());
        postJson("/api/v1/map/reverse-geocode",json.object().put("lng",0).put("lat",0),"bad-geo",400);
        assertEquals(0,count("recommendation_request"));
    }
}
