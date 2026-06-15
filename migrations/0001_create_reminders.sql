CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  guild_id TEXT,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  target_user_id TEXT,
  text TEXT NOT NULL,
  timezone TEXT NOT NULL,
  local_date_time TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS reminders_due_idx
  ON reminders (remind_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS reminders_user_active_idx
  ON reminders (user_id, remind_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;
