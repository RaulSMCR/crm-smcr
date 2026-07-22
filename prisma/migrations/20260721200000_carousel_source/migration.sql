-- Campos de artículo fuente en Carousel, para la acción "Enviar al blog".
ALTER TABLE "Carousel" ADD COLUMN "sourceText" TEXT;
ALTER TABLE "Carousel" ADD COLUMN "sourcePostId" TEXT;
ALTER TABLE "Carousel" ADD COLUMN "blogPostId" TEXT;
