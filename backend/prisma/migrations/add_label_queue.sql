-- Label Queue — auto-detected + manual label print queue
-- Run: npx prisma db execute --file prisma/migrations/add_label_queue.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS label_queue (
  "id"              SERIAL PRIMARY KEY,
  "orgId"           TEXT NOT NULL,
  "storeId"         TEXT,
  "masterProductId" INT NOT NULL REFERENCES master_products("id"),
  "reason"          TEXT NOT NULL,
  "oldPrice"        NUMERIC(10,4),
  "newPrice"        NUMERIC(10,4),
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "addedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "printedAt"       TIMESTAMPTZ,
  "printedBy"       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_label_queue_dedup ON label_queue("orgId", "storeId", "masterProductId", "status");
CREATE INDEX IF NOT EXISTS idx_label_queue_org_status ON label_queue("orgId", "storeId", "status");
CREATE INDEX IF NOT EXISTS idx_label_queue_reason ON label_queue("orgId", "status", "reason");
