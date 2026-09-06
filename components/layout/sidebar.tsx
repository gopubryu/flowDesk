"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  FilePlus2,
  BarChart3,
  ShoppingCart,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLeaf = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavGroup = {
  type: "group";
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

const nav: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/tasks", label: "할 일", icon: CheckSquare },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/finance", label: "매출·재무", icon: Wallet },
  {
    type: "group",
    id: "purchase-requests",
    label: "발주요청",
    icon: ClipboardList,
    children: [
      { href: "/purchase-requests", label: "발주요청조회", icon: ClipboardList, exact: true },
      { href: "/purchase-requests/new", label: "발주요청입력", icon: FilePlus2, exact: true },
      { href: "/purchase-requests/status", label: "발주요청현황", icon: BarChart3, exact: true },
    ],
  },
  {
    type: "group",
    id: "purchases",
    label: "구매",
    icon: ShoppingCart,
    children: [
      { href: "/purchases", label: "구매조회", icon: ClipboardList, exact: true },
      { href: "/purchases/new", label: "구매입력", icon: FilePlus2, exact: true },
      { href: "/purchases/status", label: "구매현황", icon: BarChart3, exact: true },
    ],
  },
  { href: "/exchange", label: "환율", icon: ArrowLeftRight },
  { href: "/mail", label: "메일", icon: Mail },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function Sidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of nav) {
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
          if ("type" in item && item.type === "group") {
            const GroupIcon = item.icon;
            const groupActive = item.children.some((c) =>
              isActive(pathname, c.href, c.exact)
            );
            const open = openGroups[item.id] ?? groupActive;
            return (
              <div key={item.id} className="space-y-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  aria-expanded={open}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                    groupActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      open ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                {open && (
                  <div className="ml-2 space-y-0.5 border-l border-slate-200 pl-2">
                    {item.children.map((child) => {
                      const active = isActive(pathname, child.href, child.exact);
                      const Icon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-sidebar-accent text-primary shadow-sm"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const leaf = item as NavLeaf;
          const active = isActive(pathname, leaf.href, leaf.exact);
          const Icon = leaf.icon;
          return (
            <Link
              key={leaf.href}
              href={leaf.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {leaf.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg bg-sidebar-accent/80 p-3">
          <p className="text-xs font-medium">SMB 업무 한곳에</p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            할 일 · 일정 · 매출 · 구매를 하나의 흐름으로 관리하세요.
          </p>
        </div>
      </div>
    </aside>
  );
}
