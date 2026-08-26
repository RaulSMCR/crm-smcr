-- Tasa de impuesto con la que se calculó cada liquidación.
--
-- La factura del profesional se desglosaba con un 4% fijo mientras el cálculo de
-- la liquidación usaba la tasa de cada transacción. Mientras todo fuera 4% las
-- dos cifras coincidían; con cualquier otra tasa, la validación de coincidencia
-- exacta habría rechazado una factura correcta. Guardar la tasa permite que la
-- factura se desglose con la misma con la que se liquidó.
--
-- Migración aditiva: dos columnas nuevas, sin borrar ni reescribir nada.
-- `SettlementItem.taxRatePct` lleva DEFAULT 4 para que las filas existentes
-- queden con la tasa que de hecho se les aplicó.

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN "taxRatePct" INTEGER;

-- AlterTable
ALTER TABLE "SettlementItem" ADD COLUMN "taxRatePct" INTEGER NOT NULL DEFAULT 4;
