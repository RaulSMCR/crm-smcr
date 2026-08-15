-- Datos de facturación del paciente, para que pueda pedir la factura a nombre
-- de su empresa y deducirla. Si van vacíos rige la identidad de la cuenta, que
-- es el comportamiento que ya existía.
ALTER TABLE "User" ADD COLUMN "billingName"     VARCHAR(100);
ALTER TABLE "User" ADD COLUMN "billingIdType"   VARCHAR(2);
ALTER TABLE "User" ADD COLUMN "billingIdNumber" VARCHAR(20);
ALTER TABLE "User" ADD COLUMN "billingEmail"    TEXT;

-- El tipo de identificación se venía deduciendo del largo del número al emitir.
-- Cédula jurídica y NITE tienen ambos 10 dígitos, así que se guarda el que se
-- usó en vez de volver a adivinarlo.
ALTER TABLE "Invoice" ADD COLUMN "contactIdType" VARCHAR(2);
