-- Add proposal/review fields for service assignments
ALTER TABLE "ServiceAssignment"
ADD COLUMN "proposedSessionPrice" DECIMAL(10,2),
ADD COLUMN "approvedSessionPrice" DECIMAL(10,2),
ADD COLUMN "adminReviewNote" TEXT;
