package com.outdoor.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/** Public details are allow-listed; Agent payloads must never become a query/session/notes echo endpoint. */
@Component
public class CandidatePolicy {
    private final JsonSupport json;
    private final Clock clock;
    public CandidatePolicy(JsonSupport json,Clock clock) { this.json=json; this.clock=clock; }
    public ObjectNode normalize(JsonNode source,String requestId,int rank) {
        if (!source.isObject() || !source.path("title").isTextual() || source.path("title").asText().isBlank() || source.path("title").asText().length()>255) throw new IllegalArgumentException("Invalid candidate title");
        ObjectNode result=json.object();
        for (String field:List.of("title","subtitle","summary","sourceType","sourceLabel","collectedAt","trustLevel","duration","difficulty","distance","activityType")) copyText(source,result,field,1000);
        String candidateId=json.id("cand");
        result.put("candidateId",candidateId).put("id",candidateId).put("requestId",requestId).put("rank",rank);
        for (String field:List.of("matchReasons","missingItems","riskWarnings","highlights","routeSteps","tips")) {
            var values=result.putArray(field);
            if (source.path(field).isArray()) for (JsonNode value:source.get(field)) if (value.isTextual() && value.asText().length()<=1000 && values.size()<20) values.add(value);
        }
        ObjectNode stats=result.putObject("routeStats");
        for (String field:List.of("driveTimeText","walkDistanceText","childDurationText","durationText","distanceText","elevationText")) copyText(source.path("routeStats"),stats,field,255);
        ObjectNode geo=result.putObject("geo");
        for (String field:List.of("name","address")) copyText(source.path("geo"),geo,field,500);
        JsonNode rawGeo=source.path("geo");
        if (rawGeo.path("lng").isNumber() && rawGeo.path("lat").isNumber() && rawGeo.path("lng").asDouble()>=73 && rawGeo.path("lng").asDouble()<=135 && rawGeo.path("lat").asDouble()>=3 && rawGeo.path("lat").asDouble()<=54) {
            geo.set("lng",rawGeo.get("lng"));geo.set("lat",rawGeo.get("lat"));
        }
        var evidence=result.putArray("sourceEvidence");
        JsonNode upstream=source.has("sourceEvidence")?source.get("sourceEvidence"):source.path("rawRef").path("sourceEvidence");
        if (upstream.isArray()) for (JsonNode item:upstream) {
            if (!item.isObject() || evidence.size()>=20) continue;
            ObjectNode clean=json.object();
            for (String field:List.of("sourceId","sourceRecordId","type","label","url","accessMode","collectedAt","expiresAt")) copyText(item,clean,field,2048);
            sanitizeUrl(clean);
            evidence.add(clean);
        }
        boolean preview=source.path("previewOnly").asBoolean(false) || source.path("rawRef").path("previewOnly").asBoolean(false) || source.path("sourceType").asText().toUpperCase().contains("MOCK") || !realEvidence(result);
        result.put("previewOnly",preview).put("adoptionRequired",!preview);
        ObjectNode ref=result.putObject("rawRef");
        ref.put("candidateId",candidateId).put("requestId",requestId).put("adoptionRequired",!preview).put("previewOnly",preview);
        ref.set("sourceEvidence",evidence.deepCopy());
        return result;
    }
    public void sanitizeEvidenceUrls(ObjectNode candidate) {
        for (JsonNode container : List.of(candidate, candidate.path("rawRef"))) {
            JsonNode evidence = container.path("sourceEvidence");
            if (evidence.isArray()) for (JsonNode source : evidence) if (source.isObject()) sanitizeUrl((ObjectNode) source);
        }
    }
    private void sanitizeUrl(ObjectNode source) {
        if (!source.has("url")) return;
        String value = source.path("url").asText();
        if (!publicUrl(value)) { source.remove("url"); return; }
        URI uri = URI.create(value);
        source.put("url", uri.getScheme() + "://" + uri.getRawAuthority() + uri.getRawPath());
    }
    public boolean realEvidence(JsonNode candidate) {
        JsonNode evidence=candidate.path("sourceEvidence");
        if (!evidence.isArray() || evidence.isEmpty()) return false;
        for (JsonNode source:evidence) {
            String type=source.path("type").asText("");
            String access=source.path("accessMode").asText("");
            if (type.isBlank() || type.toUpperCase().contains("MOCK") || !Set.of("AUTHORIZED_API","AUTHORIZED_PUBLIC","SYSTEM_ASSET","USER_AUTHORIZED","MANUAL_VERIFIED").contains(access)) continue;
            if (source.path("sourceId").asText("").isBlank() && source.path("sourceRecordId").asText("").isBlank() && !publicUrl(source.path("url").asText(""))) continue;
            try {
                Instant collected=Instant.parse(source.path("collectedAt").asText());
                if (collected.isAfter(Instant.now(clock).plusSeconds(300))) continue;
                if (source.has("expiresAt") && !Instant.parse(source.get("expiresAt").asText()).isAfter(Instant.now(clock))) continue;
                return true;
            } catch (RuntimeException ignored) { /* Invalid provider evidence is never adoptable. */ }
        }
        return false;
    }
    private boolean publicUrl(String value) {
        try { URI uri=URI.create(value); return Set.of("http","https").contains(uri.getScheme()) && uri.getHost()!=null && uri.getUserInfo()==null; }
        catch (Exception e) { return false; }
    }
    private void copyText(JsonNode from,ObjectNode to,String field,int max) {
        if (from.path(field).isTextual() && from.get(field).asText().length()<=max) to.put(field,from.get(field).asText());
    }
}
