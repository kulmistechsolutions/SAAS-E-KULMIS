"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { QUESTION_TYPES, questionTypeLabel } from "@/lib/quiz/format";
import { addBankItem, deleteBankItem, useQuizState } from "@/lib/quiz/store";
import type { Difficulty, QuestionType } from "@/lib/quiz/types";
import { toast } from "@/lib/toast";

export default function QuestionBankPage() {
  const state = useQuizState();
  const [subject, setSubject] = useState("Mathematics");
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("MCQ_SINGLE");
  const [marks, setMarks] = useState("5");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");

  function handleAdd() {
    const res = addBankItem({
      subject,
      difficulty,
      marks: Number(marks) || 5,
      type,
      text,
      correctAnswer: answer,
    });
    if (res.ok) {
      toast("Question added to bank", "success");
      setText("");
      setAnswer("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Question Bank</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reusable questions by subject and difficulty.</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{questionTypeLabel(t)}</option>)}
        </Select>
        <Input placeholder="Question text" value={text} onChange={(e) => setText(e.target.value)} className="sm:col-span-2" />
        <Input placeholder="Correct answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} />
        <Button onClick={handleAdd} className="sm:col-span-2"><Plus className="mr-2 h-4 w-4" />Add to Bank</Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Subject</th>
              <th className="px-4 py-2.5">Question</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Marks</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {state.questionBank.map((q) => (
              <tr key={q.id} className="border-t">
                <td className="px-4 py-2.5">{q.subject}</td>
                <td className="px-4 py-2.5">{q.text}</td>
                <td className="px-4 py-2.5">{questionTypeLabel(q.type)}</td>
                <td className="px-4 py-2.5">{q.marks}</td>
                <td className="px-4 py-2.5">
                  <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => deleteBankItem(q.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
