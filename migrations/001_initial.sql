CREATE TABLE IF NOT EXISTS lab_states (
  owner_key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS lab_states_updated_at ON lab_states(updated_at);
CREATE TABLE IF NOT EXISTS ai_usage (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count >= 0)
);
CREATE TABLE IF NOT EXISTS ai_calls (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_calls_created_at ON ai_calls(created_at);
