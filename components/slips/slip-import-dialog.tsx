"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchesSlipImport, resolveInitialSlipSourceType, type SlipImportAdapter, type SlipImportSource } from "@/lib/slip-import";

export type { SlipImportAdapter, SlipImportSource };

type Props<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceConfigs: SlipImportAdapter<T>[];
  onSelect: (value: SlipImportSource<T>, selectedLines?: number[]) => void;
  allowLineSelection?: boolean;
  initialSourceType?: SlipImportAdapter["sourceType"];
};

export function SlipImportDialog<T>({ open, onOpenChange, sourceConfigs, onSelect, allowLineSelection = false, initialSourceType }: Props<T>) {
  const [sourceType, setSourceType] = useState<string>(() => resolveInitialSlipSourceType(sourceConfigs, initialSourceType));
  const [reloadToken, setReloadToken] = useState(0);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SlipImportSource<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SlipImportSource<T> | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const adapter = sourceConfigs.find((source) => source.sourceType === sourceType) ?? sourceConfigs[0];

  useEffect(() => {
    if (!sourceConfigs.some((source) => source.sourceType === sourceType)) setSourceType(sourceConfigs[0]?.sourceType ?? "");
  }, [sourceConfigs, sourceType]);

  useEffect(() => {
    if (!open || !adapter) return;
    let cancelled = false;
    setLoading(true); setError(null); setRows([]); setDetail(null); setSelectedLines(new Set());
    adapter.load().then((values) => {
      if (!cancelled) setRows(values.map(adapter.normalize));
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "전표를 불러오지 못했습니다.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, sourceType, reloadToken]);

  const filtered = useMemo(() => rows.filter((row) => matchesSlipImport(row, query)), [rows, query]);
  function openDetail(row: SlipImportSource<T>) {
    setDetail(row);
    setSelectedLines(new Set((row.lines ?? []).map((_, index) => index)));
  }
  function applyDetail() {
    if (!detail) return;
    const indexes = allowLineSelection ? [...selectedLines].sort((a, b) => a - b) : undefined;
    onSelect(detail, indexes);
    onOpenChange(false);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl" onClose={() => onOpenChange(false)}>
      <DialogHeader><DialogTitle>{detail ? "전표 상세 · 적용 대상 확인" : "전표 목록"}</DialogTitle></DialogHeader>
      {!detail ? <>
        <div className="flex gap-2">
          <select aria-label="전표 원천" className="h-9 rounded border px-2 text-sm" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            {sourceConfigs.map((source) => <option key={source.sourceType} value={source.sourceType}>{source.label}</option>)}
          </select>
          <Input className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="일자 · 전표번호 · 거래처 · 품목 검색" autoFocus />
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded border">
          {loading && <p className="p-6 text-center text-muted-foreground">전표를 불러오는 중…</p>}
          {!loading && error && <div className="p-6 text-center text-red-600"><p>{error}</p><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setReloadToken((value) => value + 1)}>다시 시도</Button></div>}
          {!loading && !error && !filtered.length && <p className="p-6 text-center text-muted-foreground">{adapter ? `${adapter.label} 전표가 없습니다. 다른 원천을 선택하거나 해당 전표를 먼저 확정하세요.` : "조회할 전표 원천이 없습니다."}</p>}
          {!loading && !error && filtered.length > 0 && <table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-2 text-left">원천</th><th className="p-2 text-left">일자</th><th className="p-2 text-left">전표번호</th><th className="p-2 text-left">거래처</th><th className="p-2 text-left">품목</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={`${row.sourceType}:${row.id}`} className="border-b align-top"><td className="p-2">{row.sourceLabel}</td><td className="p-2">{String(row.date ?? "")}</td><td className="p-2">{row.slipNo ?? "—"}</td><td className="p-2">{row.vendorName ?? row.vendor ?? "—"}</td><td className="p-2">{row.item ?? row.lines?.[0]?.itemName ?? "—"}</td><td className="p-2 text-right"><Button size="sm" type="button" onClick={() => openDetail(row)}>상세보기</Button></td></tr>)}</tbody></table>}
        </div>
      </> : <>
        <div className="rounded border bg-slate-50 p-3 text-xs"><div className="grid grid-cols-2 gap-2"><span>원천: {detail.sourceLabel}</span><span>일자: {String(detail.date ?? "")}</span><span>전표번호: {detail.slipNo ?? "—"}</span><span>거래처: {detail.vendorName ?? detail.vendor ?? "—"}</span></div></div>
        <div className="mt-3 max-h-72 overflow-auto rounded border"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-2 text-left">선택</th><th className="p-2 text-left">품목</th><th className="p-2 text-right">원수량</th><th className="p-2 text-right">잔량</th><th className="p-2 text-right">단가</th></tr></thead><tbody>{(detail.lines ?? []).map((line, index) => <tr key={`${detail.id}:${index}`} className="border-b"><td className="p-2"><input type="checkbox" aria-label={`${line.itemName ?? line.itemCode ?? "품목"} 선택`} checked={selectedLines.has(index)} disabled={!allowLineSelection} onChange={(event) => setSelectedLines((old) => { const next = new Set(old); if (event.target.checked) next.add(index); else next.delete(index); return next; })} /></td><td className="p-2">{line.itemName ?? line.itemCode ?? "품목"}</td><td className="p-2 text-right">{line.qty ?? "—"}</td><td className="p-2 text-right">{line.remainingQty ?? line.qty ?? "—"}</td><td className="p-2 text-right">{line.unitPrice ?? "—"}</td></tr>)}</tbody></table></div>
        <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDetail(null)}>목록으로</Button><Button type="button" onClick={applyDetail} disabled={allowLineSelection && selectedLines.size === 0}>선택한 내용 적용</Button></div>
      </>}
    </DialogContent>
  </Dialog>;
}
