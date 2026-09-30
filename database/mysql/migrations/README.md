# B1 schema draft

`V001__business_baseline_draft.sql` describes the fresh-database JDBC model used by the new Java business service. It has not been applied to MySQL. It intentionally uses `CREATE TABLE` without `IF NOT EXISTS` so an old incompatible schema does not appear to upgrade successfully.

Before running it, explicitly approve a disposable test MySQL database and verify its version, character set, privileges, backup and rollback path. Do not apply it over `phase_one_schema.sql`: those six old tables use different keys/columns and require a dedicated upgrade/backfill migration. The old schema remains historical design material, not the active runtime initializer.

Opaque IDs and session/idempotency keys use binary collation to match H2 case sensitivity. JSON snapshots are stored as `LONGTEXT` and parsed with Jackson; timestamps are UTC ISO-8601 strings. The local H2 initializer is in `backend-java/src/main/resources/schema-local.sql` and does not prove MySQL compatibility. Fresh MySQL execution and rollback remain B4 acceptance work.
