-- Saved ID-card layouts, shared across a school.
--
-- The designer previously kept edits in the browser's localStorage, so a layout
-- one admin drew was invisible to every other admin and to every other machine.
-- `designKey` is the client's "style|orientation|WxH" key: a layout is only
-- valid for the exact card shape it was drawn on, and the unique constraint
-- makes the save an upsert rather than a growing pile of revisions.
CREATE TABLE "card_designs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "designKey" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "orientation" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "elements" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_designs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_designs_schoolId_designKey_key" ON "card_designs"("schoolId", "designKey");
CREATE INDEX "card_designs_schoolId_idx" ON "card_designs"("schoolId");

-- Same forced tenant isolation as every other school-scoped table, so one
-- school can never read or overwrite another school's card layouts.
ALTER TABLE "card_designs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_designs" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_card_designs ON "card_designs"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
