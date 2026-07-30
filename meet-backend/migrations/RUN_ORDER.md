# Database Migrations

These migrations transform an empty `meetdb` database into the schema used by
the backend. Apply them in order, top to bottom, on a fresh database:

```sh
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/001_add_chat_messages.sql
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/002_admin_tables.sql
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/002_add_performance_indexes.sql
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/003_add_room_settings.sql
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/004_add_waiting_room.sql
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/005_add_admin_schema.sql
psql "postgres://USER:PASS@HOST:5432/meetdb" -f migrations/006_active_meeting_unique_index.sql
```

Every file is idempotent (uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
`ON CONFLICT DO NOTHING`) so re-running is safe.

## Order rationale

- `001_add_chat_messages.sql` &mdash; adds the `chat_messages` table.
- `002_admin_tables.sql` &mdash; adds the admin panel tables
  (`admin_audit_logs`, `admin_alerts`, `user_activity`, `system_settings`).
- `002_add_performance_indexes.sql` &mdash; adds lookup indexes referenced by
  hot paths (no schema dependencies on the files above; runs after so it
  indexes existing tables).
- `003_add_room_settings.sql` &mdash; adds `rooms.settings` JSONB.
- `004_add_waiting_room.sql` &mdash; adds `rooms.waiting_room_enabled`.
- `005_add_admin_schema.sql` &mdash; adds `users.role`, default rows for
  `system_settings`, and the additional admin-panel indexes that pair with
  `002_admin_tables.sql`.
- `006_active_meeting_unique_index.sql` &mdash; creates the partial unique
  index that prevents two active meetings per room.

## Notes

- The `src/db/schema.sql` file is a self-contained, single-file snapshot of
  the **end state** of these migrations, with the tables inlined in the
  correct dependency order. A fresh `psql -d meetdb -f src/db/schema.sql`
  produces the same database as running the migrations above. Use
  `schema.sql` for bootstrap and `migrations/` when you need a step-by-step
  trail.
- There is no automated migration runner. The backend's `initDatabase()`
  helper only checks connectivity; it does **not** apply these files.
  Operators run them by hand.
- The two files with prefix `002_` are both numbered because they were
  authored in parallel and only one is ever applied. The runbook above
  applies both, in the listed order.
