"use client";
import { useEffect, useState } from "react";
import { nextDepartmentCode, createDepartment, type Department } from "@/lib/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
type Props = { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (row: Department) => void };
export function DepartmentRegisterDialog({ open, onOpenChange, onSaved }: Props) {
  const { alert, dialog } = useAppDialog(); const [form, setForm] = useState({ code: "", name: "", memo: "" });
  useEffect(() => { if (open) void nextDepartmentCode().then((code) => setForm({ code, name: "", memo: "" })).catch(() => setForm({ code: "", name: "", memo: "" })); }, [open]);
  async function save() { if (!form.code.trim() || !form.name.trim()) return void await alert({ title: "알림", description: "부서코드와 부서명은 필수입니다." }); try { const row = await createDepartment({ code: form.code, name: form.name, memo: form.memo || undefined }); onSaved(row); onOpenChange(false); } catch (error) { await alert({ title: "저장 실패", description: error instanceof Error ? error.message : "부서를 저장하지 못했습니다." }); } }
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>부서 등록</DialogTitle></DialogHeader><div className="space-y-3"><Field label="부서코드" value={form.code} onChange={(code) => setForm({ ...form, code })} /><Field label="부서명" value={form.name} onChange={(name) => setForm({ ...form, name })} /><Field label="메모" value={form.memo} onChange={(memo) => setForm({ ...form, memo })} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button><Button onClick={() => void save()}>저장</Button></DialogFooter></DialogContent></Dialog>{dialog}</>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
