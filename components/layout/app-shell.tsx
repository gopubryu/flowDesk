"use client";

import { useEffect, useState } from "react";
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
  FilePlus2,
  BarChart3,
  X,
  ChevronDown,
  Database,
} from "lucide-react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

type MobileLeaf = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type MobileGroup = {
  type: "group";
  id: string;
  label: string;
  children: MobileLeaf[];
};

type MobileItem = MobileLeaf | MobileGroup;

const mobileNav: MobileItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/tasks", label: "할 일", icon: CheckSquare },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/finance", label: "매출·재무", icon: Wallet },
  {
    type: "group",
    id: "purchase-requests",
    label: "발주",
    children: [
      { href: "/purchase-requests", label: "발주요청조회", icon: ClipboardList, exact: true },
      { href: "/purchase-requests/new", label: "발주요청입력", icon: FilePlus2, exact: true },
      { href: "/purchase-requests/status", label: "발주요청현황", icon: BarChart3, exact: true },
    ],
  },
  {
    type: "group",
    id: "sales-plans",
    label: "판매",
    children: [
      { href: "/sales-plans", label: "판매계획조회", icon: ClipboardList, exact: true },
      { href: "/sales-plans/new", label: "판매계획입력", icon: FilePlus2, exact: true },
      { href: "/sales-plans/status", label: "판매계획현황", icon: BarChart3, exact: true },
    ],
  },
  {
    type: "group",
    id: "quotations",
    label: "견적",
    children: [
      { href: "/quotations", label: "견적서조회", icon: ClipboardList, exact: true },
      { href: "/quotations/new", label: "견적서입력", icon: FilePlus2, exact: true },
      { href: "/quotations/status", label: "견적서현황", icon: BarChart3, exact: true },
    ],
  },
  {
    type: "group",
    id: "purchases",
    label: "구매",
    children: [
      { href: "/purchases", label: "구매조회", icon: ClipboardList, exact: true },
      { href: "/purchases/new", label: "구매입력", icon: FilePlus2, exact: true },
      { href: "/purchases/status", label: "구매현황", icon: BarChart3, exact: true },
    ],
  },
  { href: "/exchange", label: "환율", icon: ArrowLeftRight },
  { href: "/mail", label: "메일", icon: Mail },
  { href: "/master-data", label: "기준정보 관리", icon: Database },
  { href: "/workspace-members", label: "사용자·권한 관리", icon: Database },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const { loading, error, refresh } = useStore();
  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/onboarding" || pathname === "/invitations/accept";

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of mobileNav) {
        if (!("type" in item) || item.type !== "group") continue;
        const groupActive = item.children.some((c) =>
          isActive(pathname, c.href, c.exact)
        );
        if (groupActive) next[item.id] = true;
        else if (!(item.id in next)) next[item.id] = false;
      }
      return next;
    });
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isAuthRoute) return <>{children}</>;

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
            <nav className="space-y-1 overflow-y-auto">
              {mobileNav.map((item) => {
                if ("type" in item && item.type === "group") {
                  const groupActive = item.children.some((c) =>
                    isActive(pathname, c.href, c.exact)
                  );
                  const expanded = openGroups[item.id] ?? groupActive;
                  return (
                    <div key={item.id} className="space-y-0.5 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        aria-expanded={expanded}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold",
                          groupActive ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <span className="flex-1">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            expanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </button>
                      {expanded &&
                        item.children.map((child) => {
                          const Icon = child.icon;
                          const active = isActive(pathname, child.href, child.exact);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                                active
                                  ? "bg-sidebar-accent text-primary"
                                  : "text-muted-foreground"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              {child.label}
                            </Link>
                          );
                        })}
                    </div>
                  );
                }
                const leaf = item as MobileLeaf;
                const Icon = leaf.icon;
                const active = isActive(pathname, leaf.href, leaf.exact);
                return (
                  <Link
                    key={leaf.href}
                    href={leaf.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      active ? "bg-sidebar-accent text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {leaf.label}
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
