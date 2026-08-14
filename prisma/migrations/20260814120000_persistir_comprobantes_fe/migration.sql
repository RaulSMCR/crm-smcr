-- Persistir el comprobante firmado y la respuesta de Hacienda.
--
-- Hasta ahora el XML se generaba, se enviaba y se descartaba. Hacienda exige
-- conservar los comprobantes cinco anios y entregarle el XML al receptor, asi
-- que no tener copia era un incumplimiento, no solo una molestia.
--
-- Se guardan en la base y no en Storage: pesan ~8 KB cada uno y asi no dependen
-- de permisos de buckets.

ALTER TABLE "Invoice" ADD COLUMN "feXml" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "feRespuestaXml" TEXT;
