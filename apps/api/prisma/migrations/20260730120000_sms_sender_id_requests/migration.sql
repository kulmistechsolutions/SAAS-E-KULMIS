-- A school applies for the name recipients see on its SMS; the platform owner
-- approves it. Schools cannot set the sending name themselves.
CREATE TABLE "sms_sender_id_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestedName" TEXT NOT NULL,
    "approvedName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "licenseDocKey" TEXT,
    "licenseDocName" TEXT,
    "contactPhone" TEXT,
    "contactPerson" TEXT,
    "note" TEXT,
    "reviewNote" TEXT,
    "reviewedByUsername" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_sender_id_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sms_sender_id_requests_schoolId_idx"
    ON "sms_sender_id_requests"("schoolId");
CREATE INDEX "sms_sender_id_requests_status_idx"
    ON "sms_sender_id_requests"("status");

ALTER TABLE "sms_sender_id_requests"
    ADD CONSTRAINT "sms_sender_id_requests_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, like every other tenant table. The platform owner reads these through
-- the privileged connection, which is how the other platform screens work.
ALTER TABLE "sms_sender_id_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_sender_id_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sms_sender_id_requests ON "sms_sender_id_requests"
    USING ("schoolId" = current_setting('app.current_tenant', true));

-- Schools that already had a sending name keep it, recorded as an approved
-- application so the history explains where the name came from.
INSERT INTO "sms_sender_id_requests"
    ("id", "schoolId", "requestedName", "approvedName", "status",
     "reviewNote", "reviewedAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    s."id",
    s."smsSenderName",
    s."smsSenderName",
    'APPROVED',
    'Carried over from the sending name already in use before approvals existed.',
    now(), now(), now()
FROM "schools" s
WHERE s."smsSenderName" IS NOT NULL AND trim(s."smsSenderName") <> '';
