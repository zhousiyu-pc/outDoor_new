package com.outdoor.business;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.Map;
import java.util.Optional;

@Repository
public class BusinessRepository {
    private final JdbcTemplate jdbc;
    public BusinessRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public int update(String sql, Object... args) { return jdbc.update(sql,args); }
    public Optional<Map<String,Object>> one(String sql,Object... args) {
        var rows=jdbc.queryForList(sql,args); return rows.isEmpty()?Optional.empty():Optional.of(rows.get(0));
    }
    public Map<String,Object> candidate(String candidateId, boolean lock) {
        return one("SELECT * FROM route_candidate WHERE candidate_id=?"+(lock?" FOR UPDATE":""),candidateId)
            .orElseThrow(() -> new ApiException(404,"CANDIDATE_NOT_FOUND","路线参考不存在。"));
    }
    public Map<String,Object> asset(String assetId) {
        return one("SELECT * FROM route_asset WHERE route_asset_id=?",assetId)
            .orElseThrow(() -> new ApiException(404,"ROUTE_ASSET_NOT_FOUND","路线不存在。"));
    }
    public String value(Map<String,Object> row,String field) { Object v=row.get(field);
        if (v instanceof java.sql.Clob clob) {
            try { return clob.getSubString(1, Math.toIntExact(clob.length())); }
            catch (java.sql.SQLException e) { throw new IllegalStateException("Unreadable stored payload",e); }
        }
        return v==null?"":v.toString(); }
    public void ownsRequest(String requestId,String session) {
        var row=one("SELECT session_id FROM recommendation_request WHERE request_id=?",requestId)
            .orElseThrow(() -> new ApiException(404,"REQUEST_NOT_FOUND","搜索记录不存在。"));
        if (!session.equals(value(row,"session_id"))) throw new ApiException(403,"CANDIDATE_NOT_OWNED_BY_REQUEST","无权使用该搜索记录。");
    }
}
