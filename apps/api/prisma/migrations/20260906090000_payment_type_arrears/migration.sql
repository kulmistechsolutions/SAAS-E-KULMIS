-- A payment that settled an earlier month, or a one-off charge, in full.
--
-- The recorded type was whichever button the clerk pressed, so clearing
-- August through the arrears line — or paying off a whole balance — was
-- written down as PARTIAL. Across the platform 250 of 266 payments marked
-- "Partial Payment" had left nothing unpaid, and schools read that column to
-- find the families who still owe.
--
-- Additive: no existing row changes, and nothing in the money maths reads
-- this column. It describes a payment; it never decides one.

ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'ARREARS';
