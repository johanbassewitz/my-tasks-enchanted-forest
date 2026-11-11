CREATE TABLE accounts(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
CREATE TABLE paddle_customers(account_id TEXT NOT NULL REFERENCES accounts(id), mode TEXT NOT NULL, customer TEXT NOT NULL, PRIMARY KEY(account_id,mode), UNIQUE(mode,customer));
CREATE TABLE rate_limits(scope TEXT NOT NULL, subject TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(scope,subject,bucket));
CREATE INDEX rate_limits_expiry ON rate_limits(bucket);
CREATE TABLE codes(email TEXT PRIMARY KEY, digest TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE INDEX codes_expiry ON codes(expires);
CREATE TABLE sessions(digest TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);

CREATE TABLE paddle_transactions(
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), product TEXT NOT NULL,
  price TEXT NOT NULL, customer TEXT NOT NULL, subscription TEXT, mode TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0, starts INTEGER, expires INTEGER, revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE paddle_subscriptions(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), product TEXT NOT NULL, price TEXT NOT NULL, customer TEXT NOT NULL, mode TEXT NOT NULL);
CREATE INDEX paddle_account ON paddle_transactions(account_id, mode, granted);

CREATE TABLE ai_daily(day TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE ai_requests(
  account_id TEXT NOT NULL REFERENCES accounts(id), request_id TEXT NOT NULL,
  month TEXT NOT NULL, day TEXT NOT NULL, credit_mode TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('free','paid')),
  state TEXT NOT NULL CHECK(state IN ('pending','completed','failed')),
  payload_hash TEXT NOT NULL, attempt_id TEXT NOT NULL, reserved_until INTEGER NOT NULL,
  result TEXT, result_until INTEGER, created INTEGER NOT NULL,
  PRIMARY KEY(account_id,request_id)
);
CREATE INDEX ai_quota ON ai_requests(account_id, month, source, state);
CREATE INDEX ai_result_expiry ON ai_requests(result_until) WHERE result IS NOT NULL;
CREATE TABLE ai_totals(account_id TEXT NOT NULL REFERENCES accounts(id), period TEXT NOT NULL, source TEXT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(account_id,period,source));
CREATE TRIGGER ai_reserve_daily AFTER INSERT ON ai_requests
BEGIN
  INSERT INTO ai_daily(day,attempts) VALUES(NEW.day,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1;
END;
CREATE TRIGGER ai_retry_daily AFTER UPDATE OF attempt_id ON ai_requests WHEN NEW.attempt_id <> OLD.attempt_id
BEGIN
  INSERT INTO ai_daily(day,attempts) VALUES(NEW.day,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1;
END;
CREATE TRIGGER ai_complete AFTER UPDATE OF state ON ai_requests WHEN NEW.state='completed' AND OLD.state='pending'
BEGIN
  INSERT INTO ai_totals(account_id,period,source,used)
  VALUES(NEW.account_id,CASE NEW.source WHEN 'free' THEN NEW.month ELSE NEW.credit_mode END,NEW.source,1)
  ON CONFLICT(account_id,period,source) DO UPDATE SET used=used+1;
END;
CREATE TABLE paddle_events(
  id TEXT NOT NULL, mode TEXT NOT NULL, transaction_id TEXT NOT NULL, received INTEGER NOT NULL,
  next_attempt INTEGER NOT NULL, attempt INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(id,mode)
);
CREATE INDEX paddle_event_pending ON paddle_events(mode,done,next_attempt);
CREATE INDEX paddle_event_expiry ON paddle_events(received);
