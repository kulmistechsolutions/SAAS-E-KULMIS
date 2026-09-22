"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  fontStack,
  resolveDirection,
  type DirectionSetting,
} from "@ekulmis/shared";
import { cn } from "@/lib/utils";

/**
 * Quiz text, running the way it is meant to.
 *
 * The same component wherever a question or an option is shown — the editor,
 * the student's screen, the preview, the result sheet — because a question
 * that reads right-to-left while being written and left-to-right while being
 * answered is worse than one that never supported Arabic at all.
 *
 * `direction` on the question wins; failing that the quiz's; failing that the
 * text decides for itself, which is almost always right and is why a teacher
 * typing Arabic has nothing to configure.
 */
export function QuizText({
  text,
  direction,
  quizDirection,
  font,
  quizFont,
  as: Tag = "span",
  className,
  children,
}: {
  text: string;
  direction?: DirectionSetting | null;
  quizDirection?: DirectionSetting | null;
  font?: string | null;
  quizFont?: string | null;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "label";
  className?: string;
  children?: ReactNode;
}) {
  const setting = direction ?? quizDirection ?? "AUTO";
  const dir = resolveDirection(setting, text);
  const family = fontStack(font ?? quizFont);

  const style: CSSProperties = {};
  if (family) style.fontFamily = family;
  // Arabic sits lower and needs more room between lines than Latin at the
  // same size; without this the text looks cramped and the descenders clip.
  if (dir === "rtl") style.lineHeight = 1.9;

  return (
    <Tag dir={dir} style={style} className={cn(dir === "rtl" && "text-right", className)}>
      {children ?? text}
    </Tag>
  );
}

/**
 * The same decision, for a control the teacher types into.
 *
 * An input that does not turn round as Arabic is typed puts the cursor on the
 * wrong side and the question mark at the wrong end, which is the point at
 * which a teacher gives up and writes the paper in Word instead.
 */
export function quizFieldProps(
  text: string,
  direction?: DirectionSetting | null,
  quizDirection?: DirectionSetting | null,
  font?: string | null,
  quizFont?: string | null,
): { dir: "ltr" | "rtl"; style: CSSProperties } {
  const dir = resolveDirection(direction ?? quizDirection ?? "AUTO", text);
  const family = fontStack(font ?? quizFont);
  const style: CSSProperties = {};
  if (family) style.fontFamily = family;
  if (dir === "rtl") style.lineHeight = 1.9;
  return { dir, style };
}
