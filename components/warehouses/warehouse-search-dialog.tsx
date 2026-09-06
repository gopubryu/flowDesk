"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { loadWarehouses, searchWarehouses, type Warehouse } from "@/lib/warehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WarehouseRegisterDialog } from "./warehouse-register-dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (warehouse: Warehouse) => void;
};

export function WarehouseSearchDialog({ open, onOpenChange, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedCode(null);
      setTick((n) => n + 1);
      // ensure seed persisted on first open
      loadWarehouses();
    }
  }, [open]);

  const rows = useMemo(() => searchWarehouses(query), [query, tick]);

  function confirmSelect(wh: Warehouse) {
    onSelect(wh);
    onOpenChange(false);
  }

  function handleRowActivate(wh: Warehouse) {
    setSelectedCode(wh.code);
    confirmSelect(wh);
  }

  function handleRegisterSaved(wh: Warehouse) {
    setTick((n) => n + 1);
    setSelectedCode(wh.code);
    confirmSelect(wh);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-lg rounded-2xl border-slate-200 p-0 shadow-xl"
          onClose={() => onOpenChange(false)}
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4 pr-12">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-base text-slate-900">창고 검색</DialogTitle>
              <p className="mt-1 text-xs text-slate-500">
                창고를 선택하거나 신규 등록하세요.
              </p>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 rounded-lg border-slate-200 pl-8 text-sm focus-visible:ring-indigo-500"
                placeholder="창고코드 · 창고명 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-[280px] overflow-auto scrollbar-thin">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">창고코드</th>
                      <th className="px-3 py-2">창고명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-8 text-center text-slate-400"
                        >
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      rows.map((wh) => (
                        <tr
                          key={wh.code}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 transition-colors hover:bg-indigo-50/60",
                            selectedCode === wh.code && "bg-indigo-50"
                          )}
                          onClick={() => handleRowActivate(wh)}
                          onDoubleClick={() => handleRowActivate(wh)}
                        >
                          <td className="px-3 py-2 font-medium tabular-nums text-slate-800">
                            {wh.code}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{wh.name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-0 gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => setRegisterOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              신규
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-slate-600"
              onClick={() => onOpenChange(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WarehouseRegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSaved={handleRegisterSaved}
      />
    </>
  );
}
