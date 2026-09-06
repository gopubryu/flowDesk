"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const titles: { match: (pathname: string) => boolean; title: string; desc: string }[] = [
  {
    match: (p) => p === "/dashboard",
    title: "대시보드",
    desc: "오늘 할 일과 매출 현황을 한눈에",
  },
  {
    match: (p) => p === "/tasks" || p.startsWith("/tasks/"),
    title: "할 일 보드",
    desc: "드래그로 진행 상태를 바꿔보세요",
  },
  {
    match: (p) => p === "/calendar" || p.startsWith("/calendar/"),
    title: "일정",
    desc: "팀 일정을 한곳에서 보고 잡으세요.",
  },
  {
    match: (p) => p === "/finance" || p.startsWith("/finance/"),
    title: "매출·정산",
    desc: "입금·미수금과 매출 추이",
  },
  {
    match: (p) => p === "/purchase-requests/status",
    title: "발주요청현황",
    desc: "발주요청 진행 상태를 집계·요약합니다.",
  },
  {
    match: (p) => p === "/purchase-requests/new",
    title: "발주요청입력",
    desc: "발주요청 전표를 입력합니다.",
  },
  {
    match: (p) => p.startsWith("/purchase-requests"),
    title: "발주요청조회",
    desc: "발주요청 전표를 조회하고 진행상태를 관리합니다.",
  },
  {
    match: (p) => p === "/purchases/status",
    title: "구매현황",
    desc: "구매 진행 상태를 집계·요약합니다.",
  },
  {
    match: (p) => p === "/purchases/new",
    title: "구매입력",
    desc: "구매 전표를 입력합니다.",
  },
  {
    match: (p) => p.startsWith("/purchases"),
    title: "구매조회",
    desc: "구매 전표를 조회하고 진행상태를 관리합니다.",
  },
  {
    match: (p) => p === "/mail" || p.startsWith("/mail/"),
    title: "메일",
    desc: "업무 메일을 한곳에서 읽고 보내세요.",
  },
  {
    match: (p) => p === "/exchange" || p.startsWith("/exchange/"),
    title: "환율",
    desc: "은행 고시와 시장 시세를 함께 비교하세요.",
  },
];

function resolveMeta(pathname: string) {
  for (const t of titles) {
    if (t.match(pathname)) return { title: t.title, desc: t.desc };
  }
  return { title: "플로우데스크", desc: "" };
}

export function Header({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const { resetDemo } = useStore();
  const meta = resolveMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} type="button">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1 min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">{meta.title}</h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.desc}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            if (confirm("데모 데이터를 초기화할까요?")) void resetDemo();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">데모 초기화</span>
        </Button>
        <Button variant="ghost" size="icon" type="button" aria-label="알림">
          <Bell className="h-4 w-4" />
        </Button>
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        >
          JD
        </Link>
      </div>
    </header>
  );
}
