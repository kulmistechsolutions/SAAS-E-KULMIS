// Public quiz-taking route (outside the authenticated (app) group) so students
// can open the shared link and sign in with their own Student ID + password —
// no staff/teacher account required.
export { default } from "@/app/(app)/quiz/take/[code]/page";
