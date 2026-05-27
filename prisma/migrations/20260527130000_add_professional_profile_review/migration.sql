ALTER TABLE "ProfessionalProfile"
ADD COLUMN "profileReview" TEXT,
ADD COLUMN "profileReviewDraft" TEXT,
ADD COLUMN "profileReviewStatus" TEXT NOT NULL DEFAULT 'EMPTY',
ADD COLUMN "profileReviewSubmittedAt" TIMESTAMP(3),
ADD COLUMN "profileReviewReviewedAt" TIMESTAMP(3),
ADD COLUMN "profileReviewAdminNote" TEXT;

UPDATE "ProfessionalProfile"
SET
  "profileReview" = "bio",
  "profileReviewStatus" = CASE
    WHEN "bio" IS NULL OR btrim("bio") = '' THEN 'EMPTY'
    ELSE 'APPROVED'
  END,
  "profileReviewReviewedAt" = CASE
    WHEN "bio" IS NULL OR btrim("bio") = '' THEN NULL
    ELSE NOW()
  END
WHERE "profileReview" IS NULL;

CREATE INDEX "ProfessionalProfile_profileReviewStatus_idx"
ON "ProfessionalProfile"("profileReviewStatus");
