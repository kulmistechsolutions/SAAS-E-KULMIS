-- Examinations, Quiz, Promotions, Notifications, Backup, Import jobs

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('TEACHER_ASSESSMENT', 'SCHOOL_IMPORT');
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'LOCKED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LOCKED');
CREATE TYPE "PromotionType" AS ENUM ('INDIVIDUAL', 'CLASS', 'SCHOOL_WIDE');
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- Exam groups
CREATE TABLE "exam_groups" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exam_groups_schoolId_academicYearId_name_key" ON "exam_groups"("schoolId", "academicYearId", "name");
CREATE INDEX "exam_groups_schoolId_idx" ON "exam_groups"("schoolId");
ALTER TABLE "exam_groups" ADD CONSTRAINT "exam_groups_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exams
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examGroupId" TEXT,
    "name" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL DEFAULT 'TEACHER_ASSESSMENT',
    "term" TEXT NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "weightPercent" INTEGER NOT NULL DEFAULT 100,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exams_schoolId_idx" ON "exams"("schoolId");
CREATE INDEX "exams_classId_sectionId_idx" ON "exams"("classId", "sectionId");
ALTER TABLE "exams" ADD CONSTRAINT "exams_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_examGroupId_fkey" FOREIGN KEY ("examGroupId") REFERENCES "exam_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exam subjects
CREATE TABLE "exam_subjects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "submissionStatus" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exam_subjects_schoolId_examId_subjectId_key" ON "exam_subjects"("schoolId", "examId", "subjectId");
CREATE INDEX "exam_subjects_examId_idx" ON "exam_subjects"("examId");
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exam marks
CREATE TABLE "exam_marks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "marks" INTEGER,
    "enteredByUserId" TEXT,
    "enteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exam_marks_schoolId_examId_studentId_subjectId_key" ON "exam_marks"("schoolId", "examId", "studentId", "subjectId");
CREATE INDEX "exam_marks_examId_idx" ON "exam_marks"("examId");
CREATE INDEX "exam_marks_studentId_idx" ON "exam_marks"("studentId");
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Blocked students
CREATE TABLE "blocked_students" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedByUserId" TEXT,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blocked_students_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "blocked_students_schoolId_idx" ON "blocked_students"("schoolId");
CREATE INDEX "blocked_students_studentId_idx" ON "blocked_students"("studentId");
ALTER TABLE "blocked_students" ADD CONSTRAINT "blocked_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blocked_students" ADD CONSTRAINT "blocked_students_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Promotions
CREATE TABLE "promotion_records" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "fromSectionId" TEXT,
    "toClassId" TEXT,
    "toSectionId" TEXT,
    "graduated" BOOLEAN NOT NULL DEFAULT false,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedByUserId" TEXT,
    CONSTRAINT "promotion_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "promotion_records_schoolId_idx" ON "promotion_records"("schoolId");
CREATE INDEX "promotion_records_studentId_idx" ON "promotion_records"("studentId");
ALTER TABLE "promotion_records" ADD CONSTRAINT "promotion_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quizzes
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "timeLimitMin" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quizzes_schoolId_code_key" ON "quizzes"("schoolId", "code");
CREATE INDEX "quizzes_schoolId_idx" ON "quizzes"("schoolId");
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quiz_questions_quizId_idx" ON "quiz_questions"("quizId");
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "percentage" DOUBLE PRECISION,
    "result" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quiz_attempts_quizId_idx" ON "quiz_attempts"("quizId");
CREATE INDEX "quiz_attempts_studentId_idx" ON "quiz_attempts"("studentId");
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_answers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "marks" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quiz_answers_schoolId_attemptId_questionId_key" ON "quiz_answers"("schoolId", "attemptId", "questionId");
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Announcements & notifications
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_schoolId_idx" ON "announcements"("schoolId");

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_schoolId_idx" ON "notifications"("schoolId");
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_parentId_idx" ON "notifications"("parentId");

-- Backup & import jobs
CREATE TABLE "backup_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "sizeBytes" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "backup_jobs_schoolId_idx" ON "backup_jobs"("schoolId");

CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "fileKey" TEXT,
    "summary" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_jobs_schoolId_idx" ON "import_jobs"("schoolId");

-- RLS policies (tenant isolation)
ALTER TABLE "exam_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_marks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocked_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "promotion_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backup_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
