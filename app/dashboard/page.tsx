"use client";

import Link from "next/link";
import { format, isToday, parseISO, isAfter, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ListTodo,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatKRW } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { tasks, events, finances } = useStore();

  const todayTodos = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.dueDate &&
      (isToday(parseISO(t.dueDate)) || t.dueDate <= format(new Date(), "yyyy-MM-dd"))
  );

  const upcoming = events
    .filter((e) => !isAfter(startOfDay(new Date()), parseISO(e.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const paid = finances.filter((f) => f.status === "paid" && f.amount > 0);
  const pending = finances.filter((f) => f.status === "pending");
  const overdue = finances.filter((f) => f.status === "overdue");
  const paidSum = paid.reduce((s, f) => s + f.amount, 0);
  const pendingSum = pending.reduce((s, f) => s + f.amount, 0);
  const overdueSum = overdue.reduce((s, f) => s + f.amount, 0);

  const priorityVariant = {
    high: "danger" as const,
    medium: "warning" as const,
    low: "secondary" as const,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "yyyy년 M월 d일 EEEE", { locale: ko })}
        </p>
        <h2 className="text-2xl font-bold tracking-tight">안녕하세요 👋</h2>
        <p className="text-muted-foreground">오늘도 플로우데스크로 업무를 정리해 보세요.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">오늘 할 일</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayTodos.length}건</p>
            <p className="text-xs text-muted-foreground mt-1">마감 임박 · 미완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">입금 완료</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatKRW(paidSum)}</p>
            <p className="text-xs text-muted-foreground mt-1">{paid.length}건 정산</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">미수금</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatKRW(pendingSum)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pending.length}건 대기</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">연체</CardTitle>
            <Clock className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatKRW(overdueSum)}</p>
            <p className="text-xs text-muted-foreground mt-1">{overdue.length}건 확인 필요</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>오늘 · 임박 할 일</CardTitle>
            <Link
              href="/tasks"
              className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              전체 보기 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayTodos.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">임박한 할 일이 없습니다.</p>
            )}
            {todayTodos.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.assignee ?? "미지정"} · 마감 {t.dueDate}
                  </p>
                </div>
                <Badge variant={priorityVariant[t.priority]}>
                  {t.priority === "high" ? "높음" : t.priority === "medium" ? "보통" : "낮음"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> 다가오는 일정
            </CardTitle>
            <Link
              href="/calendar"
              className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              캘린더 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                  <span className="text-[10px] font-medium">
                    {format(parseISO(e.date), "MMM", { locale: ko })}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {format(parseISO(e.date), "d")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.startTime ? `${e.startTime}` : "종일"}
                    {e.company ? ` · ${e.company}` : ""}
                  </p>
                </div>
                <Badge variant="outline">
                  {e.type === "meeting"
                    ? "미팅"
                    : e.type === "lecture"
                      ? "강의"
                      : e.type === "trip"
                        ? "출장"
                        : e.type === "leave"
                          ? "휴가"
                          : e.type === "deadline"
                            ? "마감"
                            : "기타"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
