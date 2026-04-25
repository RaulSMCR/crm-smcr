-- Add proposal/review fields for service assignments
ALTER TABLE "ServiceAssignment"
  ADD COLUMN IF NOT EXISTS "proposedSessionPrice" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "approvedSessionPrice" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adminReviewNote"       TEXT;
