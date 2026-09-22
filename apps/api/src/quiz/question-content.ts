import { Prisma } from "@prisma/client";
import {
  cleanTfAccepted,
  hasFormatting,
  sanitizeRichText,
  type QuizQuestionInput,
} from "@ekulmis/shared";

/**
 * A question as it is stored — in a quiz or in the question bank.
 *
 * One function for both writes, because the rules that make a stored
 * question safe are not optional anywhere: the formatting is sanitised here,
 * on the server, since a question written at one school is rendered in the
 * browsers of every student who sits it; the accepted True / False words are
 * cleaned; and fields that belong to another question type are cleared. A
 * question saved to the bank and taken back out into a quiz goes through this
 * twice and comes out the same.
 */
export function questionContent(q: QuizQuestionInput) {
  const html = sanitizeRichText(q.questionHtml);
  const optionHtml = (q.optionsHtml ?? []).map((o) => sanitizeRichText(o));
  return {
    question: q.question,
    // Null when the teacher formatted nothing: the plain text is then the
    // whole truth, which is what every question in the system is today.
    questionHtml: hasFormatting(html) ? html : null,
    // DbNull, not undefined: on an update undefined means "leave it", and a
    // teacher who removed the formatting from every option would find it
    // still there after saving.
    optionsHtml: optionHtml.some((o) => hasFormatting(o))
      ? (optionHtml as Prisma.InputJsonValue)
      : Prisma.DbNull,
    // Only a written True / False question has words to accept; on anything
    // else a leftover list from a changed question type would be noise.
    acceptedAnswers:
      q.questionType === "TRUE_FALSE_WRITTEN"
        ? ((cleanTfAccepted(q.acceptedAnswers ?? null) ?? Prisma.DbNull) as
            | Prisma.InputJsonValue
            | typeof Prisma.DbNull)
        : Prisma.DbNull,
    questionType: q.questionType,
    options: q.options,
    correctAnswer: q.correctAnswer ?? "",
    gradingMode: q.gradingMode,
    pairs: q.questionType === "MATCH" ? q.pairs : undefined,
    blanks:
      q.questionType === "FILL_BLANK"
        ? q.blanks.length
          ? q.blanks
          : [q.correctAnswer]
        : undefined,
    marks: q.marks,
    // Null follows the quiz, which is what almost every question wants.
    direction: q.direction ?? null,
    contentFont: q.contentFont ?? null,
  };
}
