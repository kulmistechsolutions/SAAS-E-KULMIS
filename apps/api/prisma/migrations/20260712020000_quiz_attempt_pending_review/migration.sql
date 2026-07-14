-- Add PENDING_REVIEW to QuizAttemptStatus (was applied manually on the live DB;
-- this migration makes fresh deploys match).
ALTER TYPE "QuizAttemptStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'GRADED';
