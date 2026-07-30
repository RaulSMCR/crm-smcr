ALTER TABLE "SettlementItem"
  ADD COLUMN "consultationNumber" INTEGER,
  ADD COLUMN "commissionPlanVersion" TEXT;

ALTER TABLE "SettlementItem"
  ADD CONSTRAINT "SettlementItem_consultationNumber_check"
  CHECK ("consultationNumber" IS NULL OR "consultationNumber" >= 1);
