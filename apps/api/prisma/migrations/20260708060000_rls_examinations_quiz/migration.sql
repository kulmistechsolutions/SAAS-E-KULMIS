-- RLS policies for examinations, quiz, promotions, notifications, jobs tables.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'exam_groups', 'exams', 'exam_subjects', 'exam_marks', 'blocked_students',
    'promotion_records', 'quizzes', 'quiz_questions', 'quiz_attempts', 'quiz_answers',
    'announcements', 'notifications', 'backup_jobs', 'import_jobs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', replace(t, '.', '_'), t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%s ON %I USING ("schoolId" = current_setting(''app.current_tenant'', true)) WITH CHECK ("schoolId" = current_setting(''app.current_tenant'', true))',
      replace(t, '.', '_'),
      t
    );
  END LOOP;
END $$;
