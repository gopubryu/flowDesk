"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchesSlipImport, type ImportSearchRow } from "@/lib/slip-import";

export type SlipImportSource<T> = ImportSearchRow & { id: string; sourceType?: string; value: T };

export function SlipImportDialog<T>({ open, onOpenChange, load, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; load: () => Promise<SlipImportSource<T>[]>; onSelect: (value: SlipImportSource<T>) => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SlipImportSource<T>[]>([]);
  useEffect(() => { if (open) void load().then(setRows); }, [open, load]);
  const filtered = useMemo(() => rows.filter((row) => matchesSlipImport(row, query)), [rows, query]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl" onClose={() => onOpenChange(false)}><DialogHeader><DialogTitle>전표불러오기</DialogTitle></DialogHeader><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="일자 · 전표번호 · 거래처 · 품목 검색" autoFocus /><div className="mt-3 max-h-72 overflow-auto border rounded"><table className="w-full text-xs"><tbody>{filtered.map((row) => <tr key={`${row.sourceType ?? ""}:${row.id}`} className="border-b"><td className="p-2">{row.sourceType}</td><td className="p-2">{String(row.date ?? "")}</td><td className="p-2">{row.slipNo}</td><td className="p-2">{row.vendorName ?? row.vendor}</td><td className="p-2">{row.item}</td><td className="p-2 text-right"><Button size="sm" type="button" onClick={() => { onSelect(row); onOpenChange(false); }}>선택</Button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-5 text-center text-muted-foreground">전표가 없어요.</p>}</div></DialogContent></Dialog>;
}
