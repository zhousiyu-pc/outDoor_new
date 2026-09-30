-- Phase one reliable route reference schema.
-- Do not apply to production without explicit DB change approval.

CREATE TABLE IF NOT EXISTS recommendation_request (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id VARCHAR(64) NOT NULL UNIQUE,
  natural_language_query TEXT NOT NULL,
  origin_label VARCHAR(255),
  anonymous_session_id VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_candidate (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  candidate_id VARCHAR(64) NOT NULL UNIQUE,
  request_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  source_type VARCHAR(64) NOT NULL,
  source_label VARCHAR(255) NOT NULL,
  collected_at TIMESTAMP NULL,
  trust_status VARCHAR(64) NOT NULL DEFAULT 'CANDIDATE_REFERENCE',
  raw_payload JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_route_candidate_request FOREIGN KEY (request_id) REFERENCES recommendation_request(request_id)
);

CREATE TABLE IF NOT EXISTS route_candidate_source (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  candidate_id VARCHAR(64) NOT NULL,
  source_type VARCHAR(64) NOT NULL,
  source_label VARCHAR(255) NOT NULL,
  source_url TEXT,
  access_mode VARCHAR(64) NOT NULL,
  collected_at TIMESTAMP NULL,
  evidence_payload JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_candidate_source_candidate FOREIGN KEY (candidate_id) REFERENCES route_candidate(candidate_id)
);

CREATE TABLE IF NOT EXISTS route_asset (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  route_asset_id VARCHAR(64) NOT NULL UNIQUE,
  adopted_from_candidate_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'ADOPTED_FROM_USER',
  recommendation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_route_asset_candidate FOREIGN KEY (adopted_from_candidate_id) REFERENCES route_candidate(candidate_id)
);

CREATE TABLE IF NOT EXISTS route_adoption_event (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  route_asset_id VARCHAR(64) NOT NULL,
  candidate_id VARCHAR(64) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  anonymous_session_id VARCHAR(128),
  adopted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  adoption_context JSON,
  CONSTRAINT fk_adoption_asset FOREIGN KEY (route_asset_id) REFERENCES route_asset(route_asset_id),
  CONSTRAINT fk_adoption_candidate FOREIGN KEY (candidate_id) REFERENCES route_candidate(candidate_id),
  CONSTRAINT fk_adoption_request FOREIGN KEY (request_id) REFERENCES recommendation_request(request_id)
);

CREATE TABLE IF NOT EXISTS user_route_feedback (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  route_asset_id VARCHAR(64) NOT NULL,
  feedback_type VARCHAR(64) NOT NULL,
  content TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_asset FOREIGN KEY (route_asset_id) REFERENCES route_asset(route_asset_id)
);
