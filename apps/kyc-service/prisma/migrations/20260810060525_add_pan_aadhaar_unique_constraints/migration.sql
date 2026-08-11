-- This is an empty migration.
CREATE UNIQUE INDEX "kyc_documents_pan_number_unique"
ON "kyc_documents"("documentNumber")
WHERE "documentType" = 'PAN_CARD'
  AND "documentNumber" IS NOT NULL;

CREATE UNIQUE INDEX "kyc_documents_aadhaar_number_unique"
ON "kyc_documents"("documentNumber")
WHERE "documentType" = 'AADHAAR_FRONT'
  AND "documentNumber" IS NOT NULL;