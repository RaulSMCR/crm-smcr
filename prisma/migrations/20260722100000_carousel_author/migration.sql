-- Autor atribuido del carrusel (ProfessionalProfile id, plano sin FK).
ALTER TABLE "Carousel" ADD COLUMN "authorId" TEXT;
CREATE INDEX "Carousel_authorId_idx" ON "Carousel"("authorId");
