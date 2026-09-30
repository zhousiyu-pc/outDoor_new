CREATE TABLE IF NOT EXISTS recommendation_request (
 request_id VARCHAR(64) PRIMARY KEY, session_id VARCHAR(128) NOT NULL, query_text CLOB NOT NULL,
 criteria_version VARCHAR(32) NOT NULL, payload CLOB NOT NULL, status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL
);
CREATE TABLE IF NOT EXISTS route_candidate (
 candidate_id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64) NOT NULL, session_id VARCHAR(128) NOT NULL,
 payload CLOB NOT NULL, status VARCHAR(32) NOT NULL, preview_only BOOLEAN NOT NULL, expires_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
);
CREATE TABLE IF NOT EXISTS route_candidate_source (
 source_id VARCHAR(64) PRIMARY KEY, candidate_id VARCHAR(64) NOT NULL, payload CLOB NOT NULL,
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id)
);
CREATE TABLE IF NOT EXISTS recommendation_result (
 request_id VARCHAR(64) PRIMARY KEY, payload CLOB NOT NULL, FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
);
CREATE TABLE IF NOT EXISTS recommendation_result_item (
 request_id VARCHAR(64) NOT NULL, candidate_id VARCHAR(64) NOT NULL, rank_value INT NOT NULL,
 PRIMARY KEY(request_id, candidate_id), FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id),
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id)
);
CREATE TABLE IF NOT EXISTS route_asset (
 route_asset_id VARCHAR(64) PRIMARY KEY, candidate_id VARCHAR(64) NOT NULL UNIQUE,
 payload CLOB NOT NULL, status VARCHAR(32) NOT NULL, recommendation_enabled BOOLEAN NOT NULL, created_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id)
);
CREATE TABLE IF NOT EXISTS route_adoption_event (
 adoption_id VARCHAR(64) PRIMARY KEY, route_asset_id VARCHAR(64) NOT NULL, candidate_id VARCHAR(64) NOT NULL,
 request_id VARCHAR(64) NOT NULL, session_id VARCHAR(128) NOT NULL, created_at VARCHAR(40) NOT NULL,
 UNIQUE(candidate_id, session_id), FOREIGN KEY(route_asset_id) REFERENCES route_asset(route_asset_id),
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id), FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
);
CREATE TABLE IF NOT EXISTS search_event (
 event_id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64) NOT NULL, session_id VARCHAR(128) NOT NULL,
 event_type VARCHAR(64) NOT NULL, payload CLOB NOT NULL, created_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
);
CREATE TABLE IF NOT EXISTS user_route_feedback (
 feedback_id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64), candidate_id VARCHAR(64), route_asset_id VARCHAR(64),
 session_id VARCHAR(128) NOT NULL, payload CLOB NOT NULL, status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id), FOREIGN KEY(route_asset_id) REFERENCES route_asset(route_asset_id)
);
CREATE TABLE IF NOT EXISTS route_submission (
 submission_id VARCHAR(64) PRIMARY KEY, session_id VARCHAR(128) NOT NULL,
 payload CLOB NOT NULL, status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL
);
CREATE TABLE IF NOT EXISTS business_status_history (
 history_id VARCHAR(64) PRIMARY KEY, entity_type VARCHAR(32) NOT NULL, entity_id VARCHAR(64) NOT NULL,
 status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotency_record (
 session_id VARCHAR(128) NOT NULL, operation VARCHAR(128) NOT NULL, idem_key VARCHAR(128) NOT NULL,
 body_hash VARCHAR(64) NOT NULL, response_payload CLOB, http_status INT, created_at VARCHAR(40) NOT NULL,
 PRIMARY KEY(session_id, operation, idem_key)
);
