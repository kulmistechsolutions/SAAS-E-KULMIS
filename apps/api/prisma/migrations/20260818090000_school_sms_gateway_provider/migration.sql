-- Adds multi-provider support to a school's own SMS gateway (previously
-- hardcoded to Hormuud's username/password auth). Existing rows default to
-- HORMUUD so nothing already configured changes behavior.
ALTER TABLE "school_sms_gateways" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'HORMUUD';
ALTER TABLE "school_sms_gateways" ADD COLUMN "apiToken" TEXT NOT NULL DEFAULT '';
