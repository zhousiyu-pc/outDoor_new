-- DRAFT: B1 fresh dedicated test database baseline, NOT an upgrade for phase_one_schema.sql.
-- Requires explicit database-change approval. Not wired to Spring auto-initialization.
-- UTC instants are ISO-8601 text to preserve identical H2/MySQL snapshot semantics.
-- Binary collation makes opaque session/idempotency identifiers case-sensitive like local H2.
-- Existing six-table installations require a separately reviewed backfill/upgrade migration.

CREATE TABLE recommendation_request (
 request_id VARCHAR(64) PRIMARY KEY, session_id VARCHAR(128) NOT NULL, query_text LONGTEXT NOT NULL,
 criteria_version VARCHAR(32) NOT NULL, payload LONGTEXT NOT NULL, status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE route_candidate (
 candidate_id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64) NOT NULL, session_id VARCHAR(128) NOT NULL,
 payload LONGTEXT NOT NULL, status VARCHAR(32) NOT NULL, preview_only BOOLEAN NOT NULL, expires_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE route_candidate_source (
 source_id VARCHAR(64) PRIMARY KEY, candidate_id VARCHAR(64) NOT NULL, payload LONGTEXT NOT NULL,
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE recommendation_result (
 request_id VARCHAR(64) PRIMARY KEY, payload LONGTEXT NOT NULL, FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE recommendation_result_item (
 request_id VARCHAR(64) NOT NULL, candidate_id VARCHAR(64) NOT NULL, rank_value INT NOT NULL,
 PRIMARY KEY(request_id, candidate_id), FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id),
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE route_asset (
 route_asset_id VARCHAR(64) PRIMARY KEY, candidate_id VARCHAR(64) NOT NULL UNIQUE,
 payload LONGTEXT NOT NULL, status VARCHAR(32) NOT NULL, recommendation_enabled BOOLEAN NOT NULL, created_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE route_adoption_event (
 adoption_id VARCHAR(64) PRIMARY KEY, route_asset_id VARCHAR(64) NOT NULL, candidate_id VARCHAR(64) NOT NULL,
 request_id VARCHAR(64) NOT NULL, session_id VARCHAR(128) NOT NULL, created_at VARCHAR(40) NOT NULL,
 UNIQUE(candidate_id, session_id), FOREIGN KEY(route_asset_id) REFERENCES route_asset(route_asset_id),
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id), FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE search_event (
 event_id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64) NOT NULL, session_id VARCHAR(128) NOT NULL,
 event_type VARCHAR(64) NOT NULL, payload LONGTEXT NOT NULL, created_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(request_id) REFERENCES recommendation_request(request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE user_route_feedback (
 feedback_id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64), candidate_id VARCHAR(64), route_asset_id VARCHAR(64),
 session_id VARCHAR(128) NOT NULL, payload LONGTEXT NOT NULL, status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL,
 FOREIGN KEY(candidate_id) REFERENCES route_candidate(candidate_id), FOREIGN KEY(route_asset_id) REFERENCES route_asset(route_asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE route_submission (
 submission_id VARCHAR(64) PRIMARY KEY, session_id VARCHAR(128) NOT NULL,
 payload LONGTEXT NOT NULL, status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE business_status_history (
 history_id VARCHAR(64) PRIMARY KEY, entity_type VARCHAR(32) NOT NULL, entity_id VARCHAR(64) NOT NULL,
 status VARCHAR(32) NOT NULL, created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE idempotency_record (
 session_id VARCHAR(128) NOT NULL, operation VARCHAR(128) NOT NULL, idem_key VARCHAR(128) NOT NULL,
 body_hash VARCHAR(64) NOT NULL, response_payload LONGTEXT, http_status INT, created_at VARCHAR(40) NOT NULL,
 PRIMARY KEY(session_id, operation, idem_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
