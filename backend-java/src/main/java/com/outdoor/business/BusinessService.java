package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import static com.outdoor.business.IdempotencyService.Result;

@Service
public class BusinessService {
    private final BusinessRepository repository;
    private final JsonSupport json;
    private final RequestContract contract;
    private final CandidatePolicy policy;
    private final AgentClient agent;
    private final Clock clock;
    private final int ttlHours;
    public BusinessService(BusinessRepository repository,JsonSupport json,RequestContract contract,CandidatePolicy policy,AgentClient agent,Clock clock,@Value("${app.candidate.ttl-hours:24}") int ttlHours) {
        this.repository=repository;this.json=json;this.contract=contract;this.policy=policy;this.agent=agent;this.clock=clock;this.ttlHours=ttlHours;
    }
    public Result search(ObjectNode body,String session,String correlationId) {
        String requestId=json.id("req"),now=now();
        ObjectNode request=contract.search(body,requestId);
        repository.update("INSERT INTO recommendation_request(request_id,session_id,query_text,criteria_version,payload,status,created_at) VALUES(?,?,?,?,?,?,?)",requestId,session,request.path("query").asText(),"1",request.toString(),"SEARCHING",now);
        AgentClient.Outcome outcome=agent.search(request,correlationId);
        ObjectNode result=json.object().put("ok",true).put("requestId",requestId).put("resultType","CANDIDATE_REFERENCE").put("generatedAt",now);
        var items=result.putArray("items");var warnings=result.putArray("warnings");
        String status="NO_SEARCH_RESULTS";
        if (outcome.failed()) { status="DEGRADED";warnings.add(outcome.failureCode()); }
        else {
            JsonNode response=outcome.body();
            if (response.path("warnings").isArray()) for (JsonNode warning:response.get("warnings")) if (warning.isTextual() && warning.asText().length()<=500 && warnings.size()<20) warnings.add(warning);
            for (JsonNode raw:response.path("items")) {
                if (items.size()>=request.path("sourcePolicy").path("limit").asInt(10)) break;
                ObjectNode item;
                try { item=policy.normalize(raw,requestId,items.size()+1); }
                catch (IllegalArgumentException e) { warnings.add("INVALID_CANDIDATE_SKIPPED");continue; }
                String candidateId=item.path("candidateId").asText();
                repository.update("INSERT INTO route_candidate(candidate_id,request_id,session_id,payload,status,preview_only,expires_at) VALUES(?,?,?,?,?,?,?)",candidateId,requestId,session,item.toString(),"ACTIVE",item.path("previewOnly").asBoolean(),Instant.now(clock).plus(ttlHours,ChronoUnit.HOURS).toString());
                for (JsonNode source:item.path("sourceEvidence")) repository.update("INSERT INTO route_candidate_source(source_id,candidate_id,payload) VALUES(?,?,?)",json.id("src"),candidateId,source.toString());
                repository.update("INSERT INTO recommendation_result_item(request_id,candidate_id,rank_value) VALUES(?,?,?)",requestId,candidateId,items.size()+1);
                items.add(item);
            }
            if (!items.isEmpty()) {
                boolean allPreview=true;for (JsonNode item:items) if (!item.path("previewOnly").asBoolean()) allPreview=false;
                status=allPreview || "DEGRADED".equals(response.path("status").asText()) ? "DEGRADED" : "READY";
            } else if ("DEGRADED".equals(response.path("status").asText()) || !response.path("items").isEmpty()) status="DEGRADED";
        }
        result.put("status",status); result.putArray("nextActions");
        repository.update("UPDATE recommendation_request SET status=? WHERE request_id=?",status,requestId);
        repository.update("INSERT INTO recommendation_result(request_id,payload) VALUES(?,?)",requestId,result.toString());
        return new Result(200,result);
    }
    public ObjectNode detail(String kind,String id) {
        Map<String,Object> row;
        boolean asset="route".equals(kind);
        if ("either".equals(kind)) asset=repository.one("SELECT route_asset_id FROM route_asset WHERE route_asset_id=?",id).isPresent();
        row=asset?repository.asset(id):repository.candidate(id,false);
        if (!"ACTIVE".equals(repository.value(row,"status")) && !"ADOPTED".equals(repository.value(row,"status"))) throw new ApiException(410,"ROUTE_UNAVAILABLE","该路线暂不可用。");
        ObjectNode plan=(ObjectNode)json.read(repository.value(row,"payload"));
        policy.sanitizeEvidenceUrls(plan);
        if (asset) plan.put("routeAssetId",id).put("id",id).put("adoptionRequired",false);
        else if (!Instant.parse(repository.value(row,"expires_at")).isAfter(Instant.now(clock))) plan.put("expired",true).put("adoptionRequired",false);
        ObjectNode result=json.object().put("ok",true);result.set("plan",plan);return result;
    }
    public Result adopt(ObjectNode body,String session) {
        String requestId=contract.identifier(body,"requestId",true),candidateId=contract.identifier(body,"candidateId",true);
        Map<String,Object> candidate=ownedCandidate(candidateId,requestId,session,true);
        ObjectNode payload=(ObjectNode)json.read(repository.value(candidate,"payload"));
        if (!"ACTIVE".equals(repository.value(candidate,"status"))) throw new ApiException(409,"CANDIDATE_DISABLED","该路线参考已禁用。");
        if (!Instant.parse(repository.value(candidate,"expires_at")).isAfter(Instant.now(clock))) throw new ApiException(409,"CANDIDATE_EXPIRED","路线参考已过期，请重新搜索。");
        if (Boolean.parseBoolean(repository.value(candidate,"preview_only")) || payload.path("previewOnly").asBoolean() || !policy.realEvidence(payload)) throw new ApiException(409,"CANDIDATE_NOT_ADOPTABLE","预览或缺少有效来源的路线不能加入正式路线。");
        var existing=repository.one("SELECT a.route_asset_id,e.adoption_id FROM route_asset a JOIN route_adoption_event e ON a.route_asset_id=e.route_asset_id WHERE a.candidate_id=? AND e.session_id=?",candidateId,session);
        String routeId,adoptionId;
        if (existing.isPresent()) { routeId=repository.value(existing.get(),"route_asset_id");adoptionId=repository.value(existing.get(),"adoption_id"); }
        else {
            routeId=json.id("route");adoptionId=json.id("adopt");
            repository.update("INSERT INTO route_asset(route_asset_id,candidate_id,payload,status,recommendation_enabled,created_at) VALUES(?,?,?,?,?,?)",routeId,candidateId,payload.toString(),"ADOPTED",false,now());
            repository.update("INSERT INTO route_adoption_event(adoption_id,route_asset_id,candidate_id,request_id,session_id,created_at) VALUES(?,?,?,?,?,?)",adoptionId,routeId,candidateId,requestId,session,now());
            history("ROUTE_ASSET",routeId,"ADOPTED");
        }
        return new Result(200,json.object().put("ok",true).put("status","ADOPTED").put("routeAssetId",routeId).put("adoptionId",adoptionId).put("candidateId",candidateId).put("requestId",requestId));
    }
    public Result event(ObjectNode body,String session) {
        String requestId=contract.identifier(body,"requestId",true);repository.ownsRequest(requestId,session);
        String eventType=contract.text(body,"eventType",64,false);
        if (eventType.isBlank()) eventType=contract.text(body,"type",64,true);
        if (!eventType.matches("[A-Za-z][A-Za-z0-9_]{0,63}")) throw ApiException.invalid("eventType 格式不正确。");
        String candidateId=contract.identifier(body,"candidateId",false),assetId=contract.identifier(body,"routeAssetId",false);
        if (candidateId.isBlank()) candidateId=contract.identifier(body,"resultItemId",false);
        if (!candidateId.isBlank()) ownedCandidate(candidateId,requestId,session,false);
        if (!assetId.isBlank()) {
            var asset=repository.asset(assetId);ownedCandidate(repository.value(asset,"candidate_id"),requestId,session,false);
        }
        ObjectNode payload=json.object().put("eventType",eventType).put("candidateId",candidateId).put("routeAssetId",assetId);
        String eventId=json.id("evt");
        repository.update("INSERT INTO search_event(event_id,request_id,session_id,event_type,payload,created_at) VALUES(?,?,?,?,?,?)",eventId,requestId,session,eventType,payload.toString(),now());
        return new Result(201,json.object().put("ok",true).put("eventId",eventId).put("status","RECORDED").put("persistedAsFormalAsset",false));
    }
    public Result feedback(ObjectNode body,String session) {
        ObjectNode payload=contract.feedback(body);
        String requestId=contract.identifier(body,"requestId",false),candidateId=contract.identifier(body,"candidateId",false),routeId=contract.identifier(body,"routeAssetId",false);
        if (candidateId.isBlank()==routeId.isBlank()) throw ApiException.invalid("请提供 candidateId 或 routeAssetId 中的一项。");
        if (!routeId.isBlank()) {
            var asset=repository.asset(routeId);
            if (!"ADOPTED".equals(repository.value(asset,"status"))) throw new ApiException(409,"FEEDBACK_NOT_ACCEPTED","该路线暂不接受反馈。");
            candidateId=repository.value(asset,"candidate_id");
            // Public route feedback is available after sharing; session is an attribution key, not owner auth.
            // The requestId on a shared route belongs to its original search, not the viewer.
            // Keep public feedback attributed to the current session without asserting ownership of that search.
            requestId="";
        } else {
            if (requestId.isBlank()) throw ApiException.invalid("候选反馈需要 requestId。");
            ownedCandidate(candidateId,requestId,session,false);
        }
        String feedbackId=json.id("feedback");
        repository.update("INSERT INTO user_route_feedback(feedback_id,request_id,candidate_id,route_asset_id,session_id,payload,status,created_at) VALUES(?,?,?,?,?,?,?,?)",feedbackId,requestId.isBlank()?null:requestId,candidateId,routeId.isBlank()?null:routeId,session,payload.toString(),"RECEIVED",now());
        history("FEEDBACK",feedbackId,"RECEIVED");
        return new Result(201,json.object().put("ok",true).put("feedbackId",feedbackId).put("status","RECEIVED"));
    }
    public Result submit(ObjectNode body,String session) {
        ObjectNode payload=contract.submission(body);String submissionId=json.id("submission");
        repository.update("INSERT INTO route_submission(submission_id,session_id,payload,status,created_at) VALUES(?,?,?,?,?)",submissionId,session,payload.toString(),"REVIEW_PENDING",now());
        history("SUBMISSION",submissionId,"REVIEW_PENDING");
        return new Result(201,json.object().put("ok",true).put("submissionId",submissionId).put("status","REVIEW_PENDING"));
    }
    public Result reverseGeocode(ObjectNode body) {
        contract.validatePoint(body,true);
        String label=contract.text(body,"name",255,false);
        if (label.isBlank()) label=contract.text(body,"label",255,false);
        ObjectNode result=json.object().put("ok",true).put("status","DEGRADED").put("label",label);
        result.putNull("provider"); result.put("reason","MAP_PROVIDER_NOT_CONFIGURED");return new Result(200,result);
    }
    private Map<String,Object> ownedCandidate(String candidateId,String requestId,String session,boolean lock) {
        var candidate=repository.candidate(candidateId,lock);
        if (!requestId.equals(repository.value(candidate,"request_id")) || !session.equals(repository.value(candidate,"session_id"))) throw new ApiException(403,"CANDIDATE_NOT_OWNED_BY_REQUEST","路线参考不属于本次搜索。");
        return candidate;
    }
    private void history(String type,String id,String status) {
        repository.update("INSERT INTO business_status_history(history_id,entity_type,entity_id,status,created_at) VALUES(?,?,?,?,?)",json.id("history"),type,id,status,now());
    }
    private String now() { return Instant.now(clock).toString(); }
}
