-- Custom SMS contacts and groups.
--
-- A school's SMS list previously covered only students/parents/teachers.
-- There was no way to message people who are none of those — a school
-- committee, a landlord, a supplier — without pasting numbers by hand into
-- the bulk-paste box every single time. A contact now has a name and phone,
-- can belong to a named group ("Xisaabta"), and a group can be picked as a
-- send audience in one step.
CREATE TABLE "sms_contact_groups" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_contact_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_contact_groups_schoolId_name_key" ON "sms_contact_groups"("schoolId", "name");
CREATE INDEX "sms_contact_groups_schoolId_idx" ON "sms_contact_groups"("schoolId");

ALTER TABLE "sms_contact_groups" ADD CONSTRAINT "sms_contact_groups_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sms_contacts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sms_contacts_schoolId_idx" ON "sms_contacts"("schoolId");
CREATE INDEX "sms_contacts_groupId_idx" ON "sms_contacts"("groupId");

ALTER TABLE "sms_contacts" ADD CONSTRAINT "sms_contacts_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_contacts" ADD CONSTRAINT "sms_contacts_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "sms_contact_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same forced tenant isolation as every other school-scoped table.
ALTER TABLE "sms_contact_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_contact_groups" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sms_contact_groups ON "sms_contact_groups"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "sms_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_contacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sms_contacts ON "sms_contacts"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
