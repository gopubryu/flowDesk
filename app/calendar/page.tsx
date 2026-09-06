"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { TEAM_MEMBERS } from "@/lib/mock-data";
import type { CalendarEvent, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewMode = "month" | "week" | "day";
type AssigneeFilter = "all" | "unassigned" | string;

const WEEK_STARTS_ON = 1 as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 52;

const TYPE_META: Record<
  EventType,
  { label: string; accent: string; fill: string; text: string; selected: string; dot: string }
> = {
  meeting: {
    label: "미팅",
    accent: "border-l-blue-500",
    fill: "bg-blue-50",
    text: "text-blue-900",
    selected: "bg-blue-500 text-white border-blue-500",
    dot: "bg-blue-500",
  },
  lecture: {
    label: "강의",
    accent: "border-l-violet-500",
    fill: "bg-violet-50",
    text: "text-violet-900",
    selected: "bg-violet-500 text-white border-violet-500",
    dot: "bg-violet-500",
  },
  trip: {
    label: "출장",
    accent: "border-l-amber-500",
    fill: "bg-amber-50",
    text: "text-amber-900",
    selected: "bg-amber-500 text-white border-amber-500",
    dot: "bg-amber-500",
  },
  leave: {
    label: "휴가",
    accent: "border-l-emerald-500",
    fill: "bg-emerald-50",
    text: "text-emerald-900",
    selected: "bg-emerald-500 text-white border-emerald-500",
    dot: "bg-emerald-500",
  },
  deadline: {
    label: "마감",
    accent: "border-l-rose-500",
    fill: "bg-rose-50",
    text: "text-rose-900",
    selected: "bg-rose-500 text-white border-rose-500",
    dot: "bg-rose-500",
  },
  other: {
    label: "기타",
    accent: "border-l-slate-400",
    fill: "bg-slate-50",
    text: "text-slate-800",
    selected: "bg-slate-600 text-white border-slate-600",
    dot: "bg-slate-400",
  },
};

const PROJECT_OPTIONS = [
  "[26-1] 그린테크 업무자동화 시스템 구축",
  "블루웨이브 SaaS 도입",
  "한빛소프트 ERP",
  "네오푸드 온보딩",
  "내부",
];

function eventEndDate(ev: CalendarEvent): string {
  return ev.endDate || ev.date;
}

function eventStart(ev: CalendarEvent): Date {
  return startOfDay(parseISO(ev.date));
}

function eventEnd(ev: CalendarEvent): Date {
  return endOfDay(parseISO(eventEndDate(ev)));
}

function eventOverlapsRange(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date) {
  const s = eventStart(ev);
  const e = eventEnd(ev);
  return s <= endOfDay(rangeEnd) && e >= startOfDay(rangeStart);
}

function eventOnDay(ev: CalendarEvent, day: Date) {
  const key = format(day, "yyyy-MM-dd");
  return key >= ev.date && key <= eventEndDate(ev);
}

function isAllDayEvent(ev: CalendarEvent) {
  return !!ev.allDay || (!ev.startTime && !ev.endTime) || ev.date !== eventEndDate(ev);
}

function isUnassigned(ev: CalendarEvent) {
  return !ev.attendees || ev.attendees.length === 0;
}

function matchesAssignee(ev: CalendarEvent, filter: AssigneeFilter) {
  if (filter === "all") return true;
  if (filter === "unassigned") return isUnassigned(ev);
  return (ev.attendees ?? []).includes(filter);
}

function parseTimeToMinutes(t?: string) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDuration(startTime: string, minutes: number) {
  return minutesToTime(parseTimeToMinutes(startTime) + minutes);
}

function eventChipClass(type: EventType) {
  const meta = TYPE_META[type];
  return cn("border border-transparent border-l-[3px]", meta.accent, meta.fill, meta.text);
}

type FormState = {
  title: string;
  description: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  type: EventType;
  location: string;
  project: string;
  company: string;
  attendees: string[];
  durationChip: 30 | 60 | 120 | null;
};

function emptyForm(day?: Date): FormState {
  const d = format(day ?? new Date(), "yyyy-MM-dd");
  return {
    title: "",
    description: "",
    date: d,
    endDate: d,
    startTime: "10:00",
    endTime: "11:00",
    allDay: false,
    type: "meeting",
    location: "",
    project: "",
    company: "",
    attendees: [],
    durationChip: 60,
  };
}

function formFromEvent(ev: CalendarEvent): FormState {
  return {
    title: ev.title,
    description: ev.description ?? "",
    date: ev.date,
    endDate: eventEndDate(ev),
    startTime: ev.startTime ?? "10:00",
    endTime: ev.endTime ?? "11:00",
    allDay: isAllDayEvent(ev) && !ev.startTime,
    type: ev.type,
    location: ev.location ?? "",
    project: ev.project ?? "",
    company: ev.company ?? "",
    attendees: ev.attendees ?? [],
    durationChip: null,
  };
}

type WeekSegment = {
  event: CalendarEvent;
  colStart: number;
  colSpan: number;
  lane: number;
};

function layoutWeekSegments(weekDays: Date[], events: CalendarEvent[]): WeekSegment[] {
  const segs: Omit<WeekSegment, "lane">[] = [];
  for (const ev of events) {
    if (!isAllDayEvent(ev)) continue;
    let startIdx = -1;
    let endIdx = -1;
    weekDays.forEach((d, i) => {
      if (eventOnDay(ev, d)) {
        if (startIdx === -1) startIdx = i;
        endIdx = i;
      }
    });
    if (startIdx === -1) continue;
    segs.push({ event: ev, colStart: startIdx + 1, colSpan: endIdx - startIdx + 1 });
  }
  segs.sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan);
  const laneEnds: number[] = [];
  const result: WeekSegment[] = [];
  for (const seg of segs) {
    const endCol = seg.colStart + seg.colSpan - 1;
    let lane = laneEnds.findIndex((end) => seg.colStart > end);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endCol);
    } else {
      laneEnds[lane] = endCol;
    }
    result.push({ ...seg, lane });
  }
  return result;
}

export default function CalendarPage() {
  const { confirm: appConfirm, dialog: appDialog } = useAppDialog();
  const { events, addEvent, updateEvent, deleteEvent } = useStore();
  const [cursor, setCursor] = useState(() => new Date(2026, 8, 4));
  const [view, setView] = useState<ViewMode>("month");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
    }
    if (view === "week") {
      return {
        start: startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON }),
      };
    }
    return { start: startOfDay(cursor), end: endOfDay(cursor) };
  }, [cursor, view]);

  const rangeEvents = useMemo(
    () => events.filter((e) => eventOverlapsRange(e, range.start, range.end)),
    [events, range]
  );

  const filteredEvents = useMemo(
    () => rangeEvents.filter((e) => matchesAssignee(e, assigneeFilter)),
    [rangeEvents, assigneeFilter]
  );

  const unassignedCount = useMemo(
    () => rangeEvents.filter(isUnassigned).length,
    [rangeEvents]
  );

  const participantCount = useMemo(() => {
    const set = new Set<string>();
    for (const ev of rangeEvents) {
      for (const a of ev.attendees ?? []) set.add(a);
    }
    return set.size;
  }, [rangeEvents]);

  const personCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of TEAM_MEMBERS) map[m.name] = 0;
    for (const ev of rangeEvents) {
      for (const a of ev.attendees ?? []) {
        if (a in map) map[a] += 1;
      }
    }
    return map;
  }, [rangeEvents]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const monthWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
    return weeks;
  }, [monthDays]);

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON }),
      }),
    [cursor]
  );

  const datePill = useMemo(() => {
    if (view === "month") return format(cursor, "yyyy년 M월", { locale: ko });
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
      const e = endOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
      if (s.getMonth() === e.getMonth()) {
        return format(s, "yyyy년 M월", { locale: ko });
      }
      return `${format(s, "yyyy년 M월 d일", { locale: ko })} – ${format(e, "M월 d일", { locale: ko })}`;
    }
    return format(cursor, "yyyy년 M월 d일 (EEE)", { locale: ko });
  }, [cursor, view]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const goPrev = useCallback(() => {
    setCursor((c) =>
      view === "month" ? subMonths(c, 1) : view === "week" ? subWeeks(c, 1) : addDays(c, -1)
    );
  }, [view]);

  const goNext = useCallback(() => {
    setCursor((c) =>
      view === "month" ? addMonths(c, 1) : view === "week" ? addWeeks(c, 1) : addDays(c, 1)
    );
  }, [view]);

  const goToday = useCallback(() => {
    setCursor(new Date());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (createOpen || detail || notifOpen) return;
      const key = e.key.toLowerCase();
      if (key === "m") setView("month");
      else if (key === "w") setView("week");
      else if (key === "d") setView("day");
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, detail, notifOpen, goPrev, goNext]);

  function openCreate(day?: Date) {
    setEditing(null);
    setForm(emptyForm(day ?? (view === "day" ? cursor : new Date())));
    setDetail(null);
    setCreateOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditing(ev);
    setForm(formFromEvent(ev));
    setDetail(null);
    setCreateOpen(true);
  }

  function openDetail(ev: CalendarEvent) {
    setDetail(ev);
  }

  function applyDuration(mins: 30 | 60 | 120) {
    setForm((f) => ({
      ...f,
      durationChip: mins,
      allDay: false,
      endTime: addDuration(f.startTime || "10:00", mins),
      endDate: f.date,
    }));
  }

  function saveEvent() {
    if (!form.title.trim() || !form.date) return;
    const payload: Omit<CalendarEvent, "id"> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      date: form.date,
      endDate: form.endDate && form.endDate !== form.date ? form.endDate : undefined,
      allDay: form.allDay || undefined,
      startTime: form.allDay ? undefined : form.startTime || undefined,
      endTime: form.allDay ? undefined : form.endTime || undefined,
      type: form.type,
      location: form.location.trim() || undefined,
      project: form.project.trim() || undefined,
      company: form.company.trim() || undefined,
      attendees: form.attendees.length ? [...form.attendees] : [],
    };
    if (editing) updateEvent(editing.id, payload);
    else addEvent(payload);
    setCreateOpen(false);
    setEditing(null);
    showToast(editing ? "일정이 수정되었습니다." : "일정이 등록되었습니다.");
  }

  async function confirmDelete(ev: CalendarEvent) {
    const ok = await appConfirm({
      title: "삭제",
      description: `「${ev.title}」 일정을 삭제할까요?`,
      confirmLabel: "삭제",
      confirmVariant: "danger",
    });
    if (!ok) return;
    deleteEvent(ev.id);
    setDetail(null);
    showToast("일정이 삭제되었습니다.");
  }

  const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];

  function dayNumberClass(day: Date, idx: number) {
    const isTod = isSameDay(day, new Date());
    if (isTod) {
      return "bg-primary text-primary-foreground font-semibold shadow-sm ring-2 ring-primary/30";
    }
    if (idx >= 5) return "text-slate-400";
    return "text-slate-800";
  }

  function headerDayClass(idx: number) {
    if (idx >= 5) return "text-slate-400";
    return "text-slate-500";
  }

  /* ---------- Month view ---------- */
  function MonthView() {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
          {weekdayLabels.map((d, i) => (
            <div
              key={d}
              className={cn("py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide", headerDayClass(i))}
            >
              {d}
            </div>
          ))}
        </div>
        {monthWeeks.map((week, wi) => {
          const segments = layoutWeekSegments(week, filteredEvents);
          const laneCount = segments.reduce((m, s) => Math.max(m, s.lane + 1), 0);
          return (
            <div key={wi} className="border-b border-slate-100 last:border-b-0">
              <div className="grid grid-cols-7">
                {week.map((day, di) => {
                  const inMonth = isSameMonth(day, cursor);
                  const isWeekend = di >= 5;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setCursor(day)}
                      onDoubleClick={() => openCreate(day)}
                      className={cn(
                        "flex min-h-[36px] items-center justify-start border-r border-slate-100 p-1.5 last:border-r-0",
                        !inMonth && "bg-slate-50/60 opacity-40",
                        inMonth && isWeekend && "bg-slate-50/40"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs",
                          dayNumberClass(day, di)
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </button>
                  );
                })}
              </div>
              {laneCount > 0 && (
                <div
                  className="grid grid-cols-7 gap-y-0.5 px-0.5 pb-1"
                  style={{ gridAutoRows: "22px" }}
                >
                  {segments.map((seg) => (
                    <button
                      key={`${seg.event.id}-${seg.colStart}`}
                      type="button"
                      onClick={() => openDetail(seg.event)}
                      style={{
                        gridColumn: `${seg.colStart} / span ${seg.colSpan}`,
                        gridRow: seg.lane + 1,
                      }}
                      className={cn(
                        "mx-0.5 truncate rounded-md px-1.5 text-left text-[11px] font-medium hover:brightness-[0.98]",
                        eventChipClass(seg.event.type)
                      )}
                    >
                      {seg.event.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-7 pb-1.5">
                {week.map((day, di) => {
                  const timed = filteredEvents.filter(
                    (e) => eventOnDay(e, day) && !isAllDayEvent(e)
                  );
                  const inMonth = isSameMonth(day, cursor);
                  const isWeekend = di >= 5;
                  return (
                    <div
                      key={day.toISOString() + "-t"}
                      className={cn(
                        "min-h-[72px] space-y-0.5 border-r border-slate-100 px-0.5 last:border-r-0",
                        !inMonth && "bg-slate-50/60",
                        inMonth && isWeekend && "bg-slate-50/40"
                      )}
                    >
                      {timed.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => openDetail(ev)}
                          className={cn(
                            "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            eventChipClass(ev.type)
                          )}
                        >
                          <span className="truncate">
                            {ev.startTime ? `${ev.startTime} ` : ""}
                            {ev.title}
                          </span>
                        </button>
                      ))}
                      {timed.length > 3 && (
                        <p className="pl-1.5 text-[10px] text-slate-400">+{timed.length - 3}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------- Week / Day timeline ---------- */
  function TimelineView({ days }: { days: Date[] }) {
    const allDayEvents = filteredEvents.filter((e) =>
      days.some((d) => eventOnDay(e, d) && isAllDayEvent(e))
    );
    const segments = layoutWeekSegments(days, allDayEvents);
    const laneCount = Math.max(
      1,
      segments.reduce((m, s) => Math.max(m, s.lane + 1), 0)
    );

    const timedByDay = days.map((day) =>
      filteredEvents.filter((e) => eventOnDay(e, day) && !isAllDayEvent(e))
    );

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div
          className="grid border-b border-slate-100 bg-slate-50/80"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div />
          {days.map((day) => {
            const isTod = isSameDay(day, new Date());
            const monIdx = (getDay(day) + 6) % 7;
            return (
              <div key={day.toISOString()} className="flex flex-col items-center gap-1 py-2.5">
                <span className={cn("text-[11px] font-semibold", headerDayClass(monIdx))}>
                  {weekdayLabels[monIdx]}
                </span>
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm",
                    isTod
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-2 ring-primary/30"
                      : dayNumberClass(day, monIdx)
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day chip row */}
        <div
          className="grid border-b border-slate-100"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div className="flex items-start justify-center px-1 pt-2 text-[10px] font-medium text-slate-400">
            종일
          </div>
          <div
            className="relative border-l border-slate-100"
            style={{
              gridColumn: `2 / span ${days.length}`,
              minHeight: Math.max(36, laneCount * 24 + 10),
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
            >
              {days.map((d, i) => (
                <div key={d.toISOString()} className={cn(i > 0 && "border-l border-slate-100")} />
              ))}
            </div>
            <div
              className="relative grid gap-y-0.5 p-1"
              style={{
                gridTemplateColumns: `repeat(${days.length}, 1fr)`,
                gridAutoRows: "22px",
              }}
            >
              {segments.map((seg) => (
                <button
                  key={`${seg.event.id}-allday`}
                  type="button"
                  onClick={() => openDetail(seg.event)}
                  style={{
                    gridColumn: `${seg.colStart} / span ${seg.colSpan}`,
                    gridRow: seg.lane + 1,
                  }}
                  className={cn(
                    "mx-0.5 truncate rounded-md px-1.5 text-left text-[11px] font-medium",
                    eventChipClass(seg.event.type)
                  )}
                >
                  {seg.event.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
          <div
            className="grid"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
          >
            <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-1.5 text-[10px] tabular-nums text-slate-400"
                  style={{ top: h * HOUR_HEIGHT - 6 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((day, di) => (
              <div
                key={day.toISOString()}
                className="relative border-l border-slate-100"
                style={{ height: HOURS.length * HOUR_HEIGHT }}
                onDoubleClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const mins = Math.round(y / HOUR_HEIGHT) * 60;
                  const start = minutesToTime(Math.max(0, Math.min(23 * 60, mins)));
                  setEditing(null);
                  setForm({
                    ...emptyForm(day),
                    startTime: start,
                    endTime: addDuration(start, 60),
                    durationChip: 60,
                  });
                  setCreateOpen(true);
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100/80"
                    style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}
                {timedByDay[di].map((ev) => {
                  const startM = parseTimeToMinutes(ev.startTime);
                  const endM = Math.max(startM + 30, parseTimeToMinutes(ev.endTime) || startM + 60);
                  const top = (startM / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, ((endM - startM) / 60) * HOUR_HEIGHT);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => openDetail(ev)}
                      className={cn(
                        "absolute left-1 right-1 z-10 overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] shadow-sm",
                        eventChipClass(ev.type)
                      )}
                      style={{ top, height }}
                    >
                      <div className="truncate font-semibold">{ev.title}</div>
                      <div className="opacity-70">
                        {ev.startTime}
                        {ev.endTime ? ` – ${ev.endTime}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const empty = filteredEvents.length === 0;

  return (
    <div className="space-y-3">
      {/* Toolbar + slim stats */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-8 w-8 text-slate-600"
            onClick={goPrev}
            aria-label="이전"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="h-8 px-2.5 text-xs font-medium"
            onClick={goToday}
          >
            오늘
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-8 w-8 text-slate-600"
            onClick={goNext}
            aria-label="다음"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-base font-semibold tracking-tight text-slate-900">{datePill}</h2>

        <p className="hidden text-xs text-slate-500 sm:inline">
          <span className="font-medium text-slate-700">일정 {rangeEvents.length}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span>참여자 {participantCount}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span>미배정 {unassignedCount}</span>
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                ["month", "월"],
                ["week", "주"],
                ["day", "일"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  view === id
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" type="button" className="h-8" onClick={() => setNotifOpen(true)}>
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">알림</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => openCreate(view === "day" || view === "week" ? cursor : undefined)}
          >
            <Plus className="h-3.5 w-3.5" />
            일정 등록
          </Button>
        </div>
      </div>

      {/* Horizontal assignee filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          active={assigneeFilter === "all"}
          label="전체"
          count={rangeEvents.length}
          onClick={() => setAssigneeFilter("all")}
        />
        <FilterChip
          active={assigneeFilter === "unassigned"}
          label="미배정"
          count={unassignedCount}
          onClick={() => setAssigneeFilter("unassigned")}
        />
        <span className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:inline-block" />
        {TEAM_MEMBERS.map((m) => (
          <FilterChip
            key={m.name}
            active={assigneeFilter === m.name}
            label={m.name}
            count={personCounts[m.name] ?? 0}
            onClick={() => setAssigneeFilter(m.name)}
          />
        ))}
      </div>

      {/* Full-width calendar */}
      <div className="min-w-0">
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
            <div className="rounded-full bg-slate-100 p-3.5">
              <Inbox className="h-7 w-7 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-slate-800">표시할 일정이 없습니다</p>
              <p className="mt-1 text-sm text-slate-500">
                필터를 바꾸거나 새 일정을 등록해 보세요.
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => openCreate(cursor)}>
              <Plus className="h-3.5 w-3.5" />
              일정 등록
            </Button>
          </div>
        ) : view === "month" ? (
          <MonthView />
        ) : view === "week" ? (
          <TimelineView days={weekDays} />
        ) : (
          <TimelineView days={[startOfDay(cursor)]} />
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)} className="relative max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "일정 수정" : "일정 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">
                제목 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="일정 제목"
              />
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.allDay}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      allDay: e.target.checked,
                      durationChip: e.target.checked ? null : f.durationChip,
                    }))
                  }
                />
                종일
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>시작</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          date: e.target.value,
                          endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
                        }))
                      }
                    />
                    {!form.allDay && (
                      <Input
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            startTime: e.target.value,
                            endTime:
                              f.durationChip != null
                                ? addDuration(e.target.value, f.durationChip)
                                : f.endTime,
                          }))
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>종료</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                    {!form.allDay && (
                      <Input
                        type="time"
                        value={form.endTime}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            endTime: e.target.value,
                            durationChip: null,
                          }))
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              {!form.allDay && (
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      [30, "30분"],
                      [60, "1시간"],
                      [120, "2시간"],
                    ] as const
                  ).map(([mins, label]) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => applyDuration(mins)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        form.durationChip === mins
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="space-y-1.5">
                <Label>유형</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TYPE_META) as EventType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        form.type === t
                          ? TYPE_META[t].selected
                          : cn("border-slate-200 bg-white hover:bg-slate-50", TYPE_META[t].text)
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          form.type === t ? "bg-white/80" : TYPE_META[t].dot
                        )}
                      />
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-loc">장소</Label>
                  <Input
                    id="ev-loc"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="장소"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-project">프로젝트</Label>
                  <select
                    id="ev-project"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.project}
                    onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}
                  >
                    <option value="">선택 안 함</option>
                    {PROJECT_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="space-y-1.5">
                <Label>참석자</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {TEAM_MEMBERS.map((m) => {
                    const checked = form.attendees.includes(m.name);
                    return (
                      <label
                        key={m.name}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors",
                          checked
                            ? "border-primary/30 bg-primary/5"
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={checked}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              attendees: checked
                                ? f.attendees.filter((a) => a !== m.name)
                                : [...f.attendees, m.name],
                            }))
                          }
                        />
                        <span className="font-medium">{m.name}</span>
                        {m.department && (
                          <span className="text-xs text-slate-400">{m.department}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ev-memo">메모</Label>
                <Textarea
                  id="ev-memo"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="메모"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={saveEvent} disabled={!form.title.trim()}>
              {editing ? "저장" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent onClose={() => setDetail(null)} className="relative max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 pr-6">
                  <span
                    className={cn(
                      "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
                      TYPE_META[detail.type].dot
                    )}
                  />
                  {detail.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-0 divide-y divide-slate-100 text-sm">
                <DetailRow
                  label="시작"
                  value={format(parseISO(detail.date), "yyyy. M. d.", { locale: ko })}
                />
                <DetailRow
                  label="종료"
                  value={format(parseISO(eventEndDate(detail)), "yyyy. M. d.", { locale: ko })}
                />
                {!isAllDayEvent(detail) && (
                  <DetailRow
                    label="시간"
                    value={`${detail.startTime ?? ""}${detail.endTime ? ` – ${detail.endTime}` : ""}`}
                  />
                )}
                <DetailRow
                  label="종일"
                  value={isAllDayEvent(detail) && !detail.startTime ? "예" : "아니오"}
                />
                <DetailRow
                  label="유형"
                  value={
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                        eventChipClass(detail.type)
                      )}
                    >
                      {TYPE_META[detail.type].label}
                    </span>
                  }
                />
                {detail.location && <DetailRow label="장소" value={detail.location} />}
                {detail.project && (
                  <DetailRow
                    label="프로젝트"
                    value={<span className="text-primary">{detail.project}</span>}
                  />
                )}
                <DetailRow
                  label="참석자"
                  value={
                    detail.attendees && detail.attendees.length
                      ? detail.attendees.join(", ")
                      : "미배정"
                  }
                />
                {detail.description && <DetailRow label="메모" value={detail.description} />}
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="destructive" type="button" onClick={() => confirmDelete(detail)}>
                  삭제
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" type="button" onClick={() => setDetail(null)}>
                    닫기
                  </Button>
                  <Button type="button" onClick={() => openEdit(detail)}>
                    수정
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Notification stub */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent onClose={() => setNotifOpen(false)} className="relative max-w-sm">
          <DialogHeader>
            <DialogTitle>알림설정</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-slate-500">
            Slack 알림 연동은 데모에서 제공되지 않습니다. 실제 환경에서는 일정 등록·변경 시
            채널 알림을 보낼 수 있습니다.
          </p>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setNotifOpen(false);
                showToast("알림설정은 데모용 스텁입니다.");
              }}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      {appDialog}
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2 py-2.5 first:pt-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className="break-words font-medium text-slate-800">{value}</span>
    </div>
  );
}
