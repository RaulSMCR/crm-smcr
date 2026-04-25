-- Add discretionary display order for services
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Preserve current UX order by initializing from alphabetical order
WITH ordered_services AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "title" ASC, "createdAt" ASC) AS rn
  FROM "Service"
  WHERE "displayOrder" = 0
)
UPDATE "Service" s
SET "displayOrder" = o.rn
FROM ordered_services o
WHERE s."id" = o."id";

CREATE INDEX IF NOT EXISTS "Service_displayOrder_idx" ON "Service"("displayOrder");
