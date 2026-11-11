ALTER TABLE paddle_subscriptions ADD COLUMN ended_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE supporter_checkouts (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  mode TEXT NOT NULL,
  transaction_id TEXT REFERENCES paddle_transactions(id),
  pending_until INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  PRIMARY KEY(account_id,mode)
);
-- Retain the latest previously issued checkout as a blocking transaction on upgrade.
INSERT INTO supporter_checkouts(account_id,mode,transaction_id,lease_id,lease_until)
SELECT account_id,mode,MAX(id),'',0 FROM paddle_transactions
WHERE product IN ('supporter-monthly','supporter-yearly') AND subscription IS NULL
GROUP BY account_id,mode;
