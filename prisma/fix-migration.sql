CREATE INDEX IF NOT EXISTS "ServiceAssignment_onvoPaymentLinkId_idx" ON "ServiceAssignment"("onvoPaymentLinkId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'InsuranceClaim_patientId_fkey'
    AND table_name = 'InsuranceClaim'
  ) THEN
    ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'InsuranceClaim_appointmentId_fkey'
    AND table_name = 'InsuranceClaim'
  ) THEN
    ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'InsuranceClaim_professionalId_fkey'
    AND table_name = 'InsuranceClaim'
  ) THEN
    ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_professionalId_fkey"
      FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
