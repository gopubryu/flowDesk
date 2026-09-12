"use client";
import { useEffect, useState } from "react";
import { nextItemCode, createItem, type Item } from "@/lib/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
type Props = { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (row: Item) => void };
const empty = (code = "") => ({ code, name: "", spec: "", unit: "EA", minStock: "0", inboundPrice: "0", inboundVatIncluded: false, outboundPrice: "0", outboundVatIncluded: false });
export function ItemRegisterDialog({ open, onOpenChange, onSaved }: Props) {
  const { alert, dialog } = useAppDialog(); const [form, setForm] = useState(empty());
  useEffect(() => { if (open) void nextItemCode().then((code) => setForm(empty(code))).catch(() => setForm(empty())); }, [open]);
  async function save() { if (!form.code.trim() || !form.name.trim()) return void await alert({ title: "알림", description: "품목코드와 품목명은 필수입니다." }); try { const row = await createItem({ ...form, minStock: Number(form.minStock), inboundPrice: Number(form.inboundPrice), outboundPrice: Number(form.outboundPrice), spec: form.spec || undefined, unit: form.unit || undefined }); onSaved(row); onOpenChange(false); } catch (error) { await alert({ title: "저장 실패", description: error instanceof Error ? error.message : "품목을 저장하지 못했습니다." }); } }
  const set = (key: keyof typeof form, value: string | boolean) => setForm({ ...form, [key]: value } as typeof form);
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>품목 등록</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><Field label="품목코드" value={form.code} onChange={(v) => set("code", v)} /><Field label="품목명" value={form.name} onChange={(v) => set("name", v)} /><Field label="규격" value={form.spec} onChange={(v) => set("spec", v)} /><Field label="단위" value={form.unit} onChange={(v) => set("unit", v)} /><Field label="안전재고" value={form.minStock} type="number" onChange={(v) => set("minStock", v)} /><Field label="입고단가" value={form.inboundPrice} type="number" onChange={(v) => set("inboundPrice", v)} /><Check label="입고 부가세 포함" checked={form.inboundVatIncluded} onChange={(v) => set("inboundVatIncluded", v)} /><Field label="출고단가" value={form.outboundPrice} type="number" onChange={(v) => set("outboundPrice", v)} /><Check label="출고 부가세 포함" checked={form.outboundVatIncluded} onChange={(v) => set("outboundVatIncluded", v)} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button><Button onClick={() => void save()}>저장</Button></DialogFooter></DialogContent></Dialog>{dialog}</>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>; }
