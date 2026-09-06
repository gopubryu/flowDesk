"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Wallet,
  Mail,
  Workflow,
  ArrowLeftRight,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/tasks", label: "할 일", icon: CheckSquare },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/finance", label: "매출·정산", icon: Wallet },
  { href: "/purchase-requests", label: "발주요청", icon: ClipboardList },
  { href: "/exchange", label: "환율", icon: ArrowLeftRight },
  { href: "/mail", label: "메일", icon: Mail },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Workflow className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">플로우데스크</p>
          <p className="text-[11px] text-muted-foreground">FlowDesk</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg bg-sidebar-accent/80 p-3">
          <p className="text-xs font-medium">SMB 업무 한곳에</p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            할 일 · 일정 · 매출 · 메일을 하나의 흐름으로 관리하세요.
          </p>
        </div>
      </div>
    </aside>
  );
}
