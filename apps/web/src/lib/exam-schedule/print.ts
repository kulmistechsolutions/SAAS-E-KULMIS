"use client";

import { PRINT_HEADER_CSS, escapeHtml, printHeaderHtml } from "@/lib/print/header";
import type { ExamRoom, ExamTimetable, TimetableEntry } from "./api";
import { seatLabel } from "./seating";

export interface SeatStudentInfo {
  id: string;
  code: string;
  fullName: string;
  className: string;
}

/** Up to twelve colours to tell the classes apart on a seat map. */
export const CLASS_COLOURS = [
  "#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed", "#0891b2",
  "#ca8a04", "#dc2626", "#4f46e5", "#059669", "#9333ea", "#0d9488",
];

export function colourFor(classNames: string[], cls: string): string {
  const i = classNames.indexOf(cls);
  return CLASS_COLOURS[(i < 0 ? 0 : i) % CLASS_COLOURS.length]!;
}

export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function open(title: string, body: string, landscape = false) {
  const w = window.open("", "_blank", "width=1100,height=900");
  if (!w) return false;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 18px; }
  @media print { body { padding: 0; } }
  ${PRINT_HEADER_CSS}
  h2 { font-size: 15px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eef2ff; }
  .day { background: #f8fafc; font-weight: bold; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .board { text-align: center; font-size: 11px; letter-spacing: .2em; color: #475569; border: 1px dashed #94a3b8; border-radius: 6px; padding: 4px; margin: 6px 0 10px; }
  .grid { display: grid; gap: 6px; }
  .seat { border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 5px 6px; min-height: 54px; font-size: 10.5px; line-height: 1.25; position: relative; }
  .seat .lbl { position: absolute; top: 3px; right: 5px; font-size: 9px; color: #64748b; font-weight: bold; }
  .seat .nm { font-weight: bold; padding-right: 18px; }
  .seat .cd { font-family: monospace; color: #475569; }
  .seat .cl { display: inline-block; margin-top: 2px; padding: 0 5px; border-radius: 4px; color: #fff; font-size: 9px; font-weight: bold; }
  .seat.empty { border-style: dashed; background: #f8fafc; color: #94a3b8; }
  .legend span { display: inline-block; margin: 0 10px 4px 0; font-size: 11px; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  .foot { margin-top: 14px; font-size: 10px; color: #94a3b8; }
</style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`);
  w.document.close();
  return true;
}

/** The timetable, day by day, on school paper. */
export function printTimetable(t: ExamTimetable, rooms: ExamRoom[]): boolean {
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "";
  const byDay = new Map<string, TimetableEntry[]>();
  for (const e of [...t.entries].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  const rows = [...byDay.entries()]
    .map(
      ([day, list]) =>
        `<tr><td class="day" colspan="5">${escapeHtml(longDate(day))}</td></tr>` +
        list
          .map(
            (e) =>
              `<tr><td>${escapeHtml(e.startTime)} – ${escapeHtml(e.endTime)}</td><td><b>${escapeHtml(e.subject)}</b>${
                e.note ? `<br/><small>${escapeHtml(e.note)}</small>` : ""
              }</td><td>${escapeHtml(e.classNames.join(", "))}</td><td>${escapeHtml(
                e.roomIds.map(roomName).filter(Boolean).join(", ") || "—",
              )}</td><td>${durationText(e)}</td></tr>`,
          )
          .join(""),
    )
    .join("");
  return open(
    t.name,
    `${printHeaderHtml(`Exam Timetable — ${t.name} · ${t.academicYear}`)}
     <table><thead><tr><th style="width:120px">Time</th><th>Subject</th><th>Classes</th><th>Room(s)</th><th style="width:80px">Duration</th></tr></thead>
     <tbody>${rows || `<tr><td colspan="5">No papers yet.</td></tr>`}</tbody></table>
     <div class="foot">${t.entries.length} paper(s) · Generated ${escapeHtml(new Date().toLocaleString())}</div>`,
  );
}

export function durationText(e: { startTime: string; endTime: string }): string {
  const [sh, sm] = e.startTime.split(":").map(Number);
  const [eh, em] = e.endTime.split(":").map(Number);
  const mins = (eh! * 60 + em!) - (sh! * 60 + sm!);
  if (!(mins > 0)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** One sheet per room: the board, every desk with who sits there, and a legend. */
export function printSeatMaps(
  t: ExamTimetable,
  rooms: ExamRoom[],
  students: Map<string, SeatStudentInfo>,
): boolean {
  const plan = t.seating;
  if (!plan) return false;
  const pages = plan.rooms
    .map((pr) => {
      const room = rooms.find((r) => r.id === pr.roomId);
      if (!room) return "";
      const seated = pr.seats.flat().filter(Boolean).length;
      const cells = pr.seats
        .map((row, r) =>
          row
            .map((id, c) => {
              const st = id ? students.get(id) : undefined;
              if (!st) return `<div class="seat empty"><span class="lbl">${seatLabel(r, c)}</span>Empty</div>`;
              const col = colourFor(plan.classNames, st.className);
              return `<div class="seat" style="border-color:${col}"><span class="lbl">${seatLabel(r, c)}</span>
                <div class="nm">${escapeHtml(st.fullName)}</div><div class="cd">${escapeHtml(st.code)}</div>
                <span class="cl" style="background:${col}">${escapeHtml(st.className)}</span></div>`;
            })
            .join(""),
        )
        .join("");
      const legend = plan.classNames
        .map((c) => `<span><i style="background:${colourFor(plan.classNames, c)}"></i>${escapeHtml(c)}</span>`)
        .join("");
      return `<div class="page">${printHeaderHtml(`Seating Plan — ${room.name}${room.building ? ` (${room.building})` : ""} · ${t.name}`)}
        <div class="legend">${legend}</div>
        <div class="board">FRONT · BOARD / INVIGILATOR</div>
        <div class="grid" style="grid-template-columns:repeat(${room.cols},1fr)">${cells}</div>
        <div class="foot">${seated} student(s) · ${room.rows * room.cols} seats</div></div>`;
    })
    .join("");
  return open(`Seating — ${t.name}`, pages, true);
}

/** The list for each room's door: who sits where, alphabetically. */
export function printDoorLists(
  t: ExamTimetable,
  rooms: ExamRoom[],
  students: Map<string, SeatStudentInfo>,
): boolean {
  const plan = t.seating;
  if (!plan) return false;
  const pages = plan.rooms
    .map((pr) => {
      const room = rooms.find((r) => r.id === pr.roomId);
      if (!room) return "";
      const list = pr.seats
        .flatMap((row, r) => row.map((id, c) => ({ id, seat: seatLabel(r, c) })))
        .filter((x) => x.id && students.get(x.id))
        .map((x) => ({ ...students.get(x.id!)!, seat: x.seat }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      const rows = list
        .map(
          (s, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.fullName)}</td><td>${escapeHtml(s.className)}</td><td><b>${s.seat}</b></td><td></td></tr>`,
        )
        .join("");
      return `<div class="page">${printHeaderHtml(`Room List — ${room.name} · ${t.name}`)}
        <table><thead><tr><th style="width:30px">#</th><th>Student ID</th><th>Student</th><th>Class</th><th>Seat</th><th style="width:120px">Signature</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="foot">${list.length} student(s)</div></div>`;
    })
    .join("");
  return open(`Room lists — ${t.name}`, pages);
}
