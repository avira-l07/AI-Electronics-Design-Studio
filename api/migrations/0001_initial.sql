-- Initial schema: apply once to an empty PostgreSQL database.

BEGIN;

CREATE TABLE schema_migrations (version VARCHAR(30) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());


CREATE TABLE audit_logs (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	action VARCHAR(100) NOT NULL, 
	ip_hash VARCHAR(64) NOT NULL, 
	created INTEGER NOT NULL, 
	PRIMARY KEY (id)
)

;

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);


CREATE TABLE mail_outbox (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	payload TEXT NOT NULL, 
	attempts INTEGER NOT NULL, 
	available INTEGER NOT NULL, 
	sent BOOLEAN NOT NULL, 
	PRIMARY KEY (id)
)

;

CREATE INDEX ix_mail_outbox_user_id ON mail_outbox (user_id);


CREATE TABLE plans (
	id VARCHAR(24) NOT NULL, 
	profile_limit INTEGER NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE rate_limits (
	id VARCHAR(100) NOT NULL, 
	count INTEGER NOT NULL, 
	expires INTEGER NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	password TEXT, 
	name VARCHAR(100) NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	verified BOOLEAN NOT NULL, 
	banned BOOLEAN NOT NULL, 
	deleted BOOLEAN NOT NULL, 
	epoch INTEGER NOT NULL, 
	failures INTEGER NOT NULL, 
	locked_until INTEGER NOT NULL, 
	google_sub VARCHAR(255), 
	totp TEXT, 
	totp_pending TEXT, 
	totp_last INTEGER NOT NULL, 
	recovery TEXT NOT NULL, 
	customer VARCHAR(255), 
	trial_used BOOLEAN NOT NULL, 
	checkout_id VARCHAR(255), 
	checkout_url TEXT, 
	checkout_expires INTEGER NOT NULL, 
	checkout_price VARCHAR(255), 
	created INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (email), 
	UNIQUE (google_sub), 
	UNIQUE (customer)
)

;


CREATE TABLE webhook_events (
	id VARCHAR(255) NOT NULL, 
	kind VARCHAR(100) NOT NULL, 
	created INTEGER NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE action_tokens (
	digest VARCHAR(64) NOT NULL, 
	user_id VARCHAR(36), 
	purpose VARCHAR(30) NOT NULL, 
	data TEXT NOT NULL, 
	expires INTEGER NOT NULL, 
	used BOOLEAN NOT NULL, 
	attempts INTEGER NOT NULL, 
	PRIMARY KEY (digest), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

CREATE INDEX ix_action_tokens_user_id ON action_tokens (user_id);


CREATE TABLE notifications (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	message VARCHAR(1000) NOT NULL, 
	read BOOLEAN NOT NULL, 
	created INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

CREATE INDEX ix_notifications_user_id ON notifications (user_id);


CREATE TABLE payments (
	id VARCHAR(255) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	subscription_id VARCHAR(255), 
	status VARCHAR(30) NOT NULL, 
	amount INTEGER NOT NULL, 
	refunded INTEGER NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	invoice_url TEXT, 
	created INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

CREATE INDEX ix_payments_user_id ON payments (user_id);


CREATE TABLE profiles (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	bio VARCHAR(1000) NOT NULL, 
	created BIGINT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

CREATE INDEX ix_profiles_user_id ON profiles (user_id);


CREATE TABLE sessions (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	profile_id VARCHAR(36), 
	refresh VARCHAR(64) NOT NULL, 
	expires INTEGER NOT NULL, 
	revoked BOOLEAN NOT NULL, 
	device VARCHAR(200) NOT NULL, 
	ip_hash VARCHAR(64) NOT NULL, 
	created INTEGER NOT NULL, 
	authenticated INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (refresh)
)

;

CREATE INDEX ix_sessions_user_id ON sessions (user_id);


CREATE TABLE subscriptions (
	id VARCHAR(255) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	price VARCHAR(255) NOT NULL, 
	ends INTEGER NOT NULL, 
	cancel_at_end BOOLEAN NOT NULL, 
	updated INTEGER NOT NULL, 
	refunded_invoice VARCHAR(255), 
	disputed BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

CREATE INDEX ix_subscriptions_user_id ON subscriptions (user_id);


CREATE TABLE projects (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	profile_id VARCHAR(36) NOT NULL, 
	data TEXT NOT NULL, 
	updated INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(profile_id) REFERENCES profiles (id)
)

;

CREATE INDEX ix_projects_user_id ON projects (user_id);

CREATE INDEX ix_projects_profile_id ON projects (profile_id);


CREATE TABLE used_refresh_tokens (
	digest VARCHAR(64) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	expires INTEGER NOT NULL, 
	PRIMARY KEY (digest), 
	FOREIGN KEY(session_id) REFERENCES sessions (id)
)

;

CREATE INDEX ix_used_refresh_tokens_session_id ON used_refresh_tokens (session_id);

INSERT INTO plans (id, profile_limit) VALUES ('free', 1), ('premium', 5);

INSERT INTO schema_migrations (version) VALUES ('0001');

COMMIT;