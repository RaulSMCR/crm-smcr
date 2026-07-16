-- Campos SEO editoriales. Todos opcionales; el metadata cae al contenido si van vacíos.
ALTER TABLE "Post"
  ADD COLUMN "metaTitle" TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "ogImage" TEXT,
  ADD COLUMN "focusKeyword" TEXT,
  ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Service"
  ADD COLUMN "metaTitle" TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "ogImage" TEXT,
  ADD COLUMN "focusKeyword" TEXT,
  ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProfessionalProfile"
  ADD COLUMN "metaTitle" TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "ogImage" TEXT,
  ADD COLUMN "focusKeyword" TEXT,
  ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;
