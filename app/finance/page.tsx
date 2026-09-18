"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useWorkspaceRole } from "@/lib/use-workspace-role";
import type { FinanceRecord, PaymentStatus } from "@/lib/types";
import { formatKRW } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusLabel: Record<PaymentStatus, string> = {
  paid: "입금완료",
  pending: "대기",
  overdue: "연체",
};

const statusVariant: Record<PaymentStatus, "success" | "warning" | "danger"> = {
  paid: "success",
  pending: "warning",
  overdue: "danger",
};

const emptyForm = {
  client: "",
  description: "",
  amount: "",
  status: "pending" as PaymentStatus,
  date: new Date().toISOString().slice(0, 10),
  dueDate: "",
  category: "sales" as FinanceRecord["category"],
};

export default function FinancePage() {
  const { finances, addFinance, deleteFinance, updateFinance } = useStore();
  const { canWrite: allowWrite, canDelete: allowDelete } = useWorkspaceRole();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const totals = useMemo(() => {
    const income = finances.filter((f) => f.amount > 0);
    const paid = income.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
    const pending = income.filter((f) => f.status === "pending").reduce((s, f) => s + f.amount, 0);
    const overdue = income.filter((f) => f.status === "overdue").reduce((s, f) => s + f.amount, 0);
    const expense = finances.filter((f) => f.amount < 0).reduce((s, f) => s + Math.abs(f.amount), 0);
    return { paid, pending, overdue, expense, total: paid + pending + overdue };
  }, [finances]);

  const chartData = useMemo(() => {
    const map = new Map<string, { month: string; sales: number; paid: number }>();
    for (const f of finances) {
      if (f.amount <= 0) continue;
      const month = f.date.slice(0, 7);
      const row = map.get(month) ?? { month, sales: 0, paid: 0 };
      row.sales += f.amount;
      if (f.status === "paid") row.paid += f.amount;
      map.set(month, row);
    }
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        ...r,
        label: `${r.month.slice(5)}월`,
      }));
  }, [finances]);

  const sorted = useMemo(
    () => [...finances].sort((a, b) => b.date.localeCompare(a.date)),
    [finances]
  );

  function save() {
    const amount = Number(form.amount);
    if (!form.client.trim() || !form.description.trim() || Number.isNaN(amount)) return;
    addFinance({
      client: form.client.trim(),
      description: form.description.trim(),
      amount,
      status: form.status,
      date: form.date,
      dueDate: form.dueDate || undefined,
      category: form.category,
    });
    setOpen(false);
    setForm(emptyForm);
  }

  function cycleStatus(rec: FinanceRecord) {
    const order: PaymentStatus[] = ["pending", "paid", "overdue"];
    const next = order[(order.indexOf(rec.status) + 1) % order.length];
    updateFinance(rec.id, { status: next });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          매출·입금·미수금을 한곳에서 추적합니다. (데모 데이터)
        </p>
        <Button
          type="button"
          disabled={!allowWrite}
          onClick={() => {
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> 거래 추가
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">총 매출(청구)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatKRW(totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">입금 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">{formatKRW(totals.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">미수금</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{formatKRW(totals.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">연체 / 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-rose-700">{formatKRW(totals.overdue)}</p>
            <p className="text-xs text-muted-foreground mt-1">지출 {formatKRW(totals.expense)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">월별 매출 · 입금</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => formatKRW(value)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ""}
              />
              <Bar dataKey="sales" name="청구" fill="hsl(221 83% 70%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="입금" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">거래 내역</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-3 font-medium">날짜</th>
                <th className="pb-3 pr-3 font-medium">거래처</th>
                <th className="pb-3 pr-3 font-medium">내용</th>
                <th className="pb-3 pr-3 font-medium text-right">금액</th>
                <th className="pb-3 pr-3 font-medium">상태</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-3 pr-3 whitespace-nowrap">{f.date}</td>
                  <td className="py-3 pr-3 font-medium">{f.client}</td>
                  <td className="py-3 pr-3 text-muted-foreground max-w-[220px] truncate">
                    {f.description}
                  </td>
                  <td
                    className={`py-3 pr-3 text-right font-semibold whitespace-nowrap ${
                      f.amount < 0 ? "text-rose-600" : ""
                    }`}
                  >
                    {formatKRW(f.amount)}
                  </td>
                  <td className="py-3 pr-3">
                    <button type="button" onClick={() => cycleStatus(f)}>
                      <Badge variant={statusVariant[f.status]}>{statusLabel[f.status]}</Badge>
                    </button>
                  </td>
                  <td className="py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      type="button"
                      disabled={!allowDelete}
                      onClick={() => deleteFinance(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} className="relative">
          <DialogHeader>
            <DialogTitle>거래 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fin-client">거래처</Label>
                <Input
                  id="fin-client"
                  value={form.client}
                  onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-amount">금액 (지출은 음수)</Label>
                <Input
                  id="fin-amount"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="1200000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-desc">내용</Label>
              <Input
                id="fin-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fin-date">거래일</Label>
                <Input
                  id="fin-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-due">지급기한</Label>
                <Input
                  id="fin-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fin-status">상태</Label>
                <select
                  id="fin-status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as PaymentStatus }))
                  }
                >
                  <option value="paid">입금완료</option>
                  <option value="pending">대기</option>
                  <option value="overdue">연체</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-cat">분류</Label>
                <select
                  id="fin-cat"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as FinanceRecord["category"],
                    }))
                  }
                >
                  <option value="sales">매출</option>
                  <option value="subscription">구독</option>
                  <option value="expense">지출</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={save}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
