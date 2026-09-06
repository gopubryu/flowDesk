"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Wallet,
  Mail,
  ArrowLeftRight,
  ClipboardList,
  X,
} from "lucide-react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const mobileNav = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/tasks", label: "할 일", icon: CheckSquare },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/finance", label: "매출", icon: Wallet },
  { href: "/purchase-requests", label: "발주요청", icon: ClipboardList },
  { href: "/exchange", label: "환율", icon: ArrowLeftRight },
  { href: "/mail", label: "메일", icon: Mail },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { loading, error, refresh } = useStore();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold">플로우데스크</p>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} type="button">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="space-y-1">
              {mobileNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      active ? "bg-sidebar-accent text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setOpen(true)} />
        {loading && (
          <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground md:px-6">
            데이터를 불러오는 중…
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive md:px-6">
            <span>데이터를 불러오지 못했습니다. DB 연결을 확인해 주세요.</span>
            <Button variant="outline" size="sm" type="button" onClick={() => void refresh()}>
              다시 시도
            </Button>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
