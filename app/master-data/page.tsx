"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { EmployeeRegisterDialog } from "@/components/employees/employee-register-dialog";
import { WarehouseRegisterDialog } from "@/components/warehouses/warehouse-register-dialog";
import { VendorRegisterDialog } from "@/components/vendors/vendor-register-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { deleteEmployee, loadEmployees, updateEmployee, type Employee } from "@/lib/employees";
import { deleteWarehouse, loadWarehouses, updateWarehouse, type Warehouse } from "@/lib/warehouses";
import { deleteVendor, loadVendors, updateVendor, VENDOR_CODE_TYPE_OPTIONS, type Vendor } from "@/lib/vendors";
import { filterRecords } from "@/lib/master-data-utils";

type Tab = "employees" | "warehouses" | "vendors";
type MasterRow = Employee | Warehouse | Vendor;
const tabs: { id: Tab; label: string }[] = [
  { id: "employees", label: "담당자" }, { id: "warehouses", label: "창고" }, { id: "vendors", label: "거래처" },
];

export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>("employees");
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ tab: Tab; row: MasterRow } | null>(null);
  const { confirm, alert, dialog } = useAppDialog();

  useEffect(() => { void Promise.all([loadEmployees(), loadWarehouses(), loadVendors()]).then(([e, w, v]) => { setEmployees(e); setWarehouses(w); setVendors(v); }).catch((error) => void alert({ title: "조회 실패", description: error instanceof Error ? error.message : "기준정보를 불러오지 못했습니다." })); }, []);
  useEffect(() => { setQuery(""); }, [tab]);

  const currentRows = tab === "employees" ? employees : tab === "warehouses" ? warehouses : vendors;
  const filtered = useMemo(() => {
    if (tab === "employees") return filterRecords(employees, query, ["code", "name", "phone", "email", "memo"]);
    if (tab === "warehouses") return filterRecords(warehouses, query, ["code", "name", "memo"]);
    return filterRecords(vendors, query, ["code", "name", "codeType", "bizRegNo", "ceo", "phone", "contactPerson", "email"]);
  }, [tab, query, employees, warehouses, vendors]);

  async function reload(kind: Tab) {
    try {
      if (kind === "employees") setEmployees(await loadEmployees());
      else if (kind === "warehouses") setWarehouses(await loadWarehouses());
      else setVendors(await loadVendors());
    } catch (error) { await alert({ title: "조회 실패", description: error instanceof Error ? error.message : "기준정보를 불러오지 못했습니다." }); }
  }

  async function remove(row: MasterRow) {
    const ok = await confirm({ title: "코드 삭제", description: `${row.code} · ${row.name}을(를) 삭제하시겠습니까?`, confirmLabel: "삭제", confirmVariant: "danger" });
    if (!ok) return;
    try {
      if (tab === "employees") await deleteEmployee(row.code);
      else if (tab === "warehouses") await deleteWarehouse(row.code);
      else await deleteVendor(row.code);
      await reload(tab);
    } catch (error) { await alert({ title: "삭제 실패", description: error instanceof Error ? error.message : "삭제하지 못했습니다." }); }
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-600 p-2.5 text-white"><Database className="h-5 w-5" /></div><div><h1 className="text-xl font-bold text-slate-900">기준정보 관리</h1><p className="mt-1 text-sm text-slate-600">담당자·창고·거래처 코드를 한곳에서 관리합니다.</p></div></div>
      <p className="mt-4 rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-500">변경 내용은 공유 데이터베이스에 저장되어 모든 등록·검색 화면에서 바로 사용됩니다.</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex overflow-x-auto border-b px-3 pt-3">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`min-w-[100px] border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}<span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item.id === "employees" ? employees.length : item.id === "warehouses" ? warehouses.length : vendors.length}</span></button>)}</div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder={`${tabs.find((item) => item.id === tab)?.label} 코드·이름 검색`} /></div><Button onClick={() => setCreateOpen(true)} className="shrink-0"><Plus className="h-4 w-4" /> 신규 등록</Button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3">코드</th><th className="px-4 py-3">명칭</th>{tab === "employees" && <><th className="px-4 py-3">연락처</th><th className="px-4 py-3">이메일</th></>}{tab === "warehouses" && <th className="px-4 py-3">메모/적요</th>}{tab === "vendors" && <><th className="px-4 py-3">구분</th><th className="px-4 py-3">대표자/담당자</th><th className="px-4 py-3">연락처</th></>}<th className="px-4 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row.code} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-indigo-700">{row.code}</td><td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>{tab === "employees" && <><td className="px-4 py-3 text-slate-600">{(row as Employee).phone || "-"}</td><td className="px-4 py-3 text-slate-600">{(row as Employee).email || "-"}</td></>}{tab === "warehouses" && <td className="px-4 py-3 text-slate-600">{(row as Warehouse).memo || "-"}</td>}{tab === "vendors" && <><td className="px-4 py-3 text-slate-600">{(row as Vendor).codeType}</td><td className="px-4 py-3 text-slate-600">{[(row as Vendor).ceo, (row as Vendor).contactPerson].filter(Boolean).join(" / ") || "-"}</td><td className="px-4 py-3 text-slate-600">{(row as Vendor).phone || (row as Vendor).mobile || "-"}</td></>}<td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing({ tab, row })} aria-label={`${row.code} 수정`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-rose-600" onClick={() => void remove(row)} aria-label={`${row.code} 삭제`}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">검색 결과가 없습니다.</td></tr>}</tbody></table></div>
      <div className="border-t bg-slate-50/60 px-4 py-3 text-xs text-slate-500">전체 {currentRows.length}건 · 검색 결과 {filtered.length}건</div>
    </div>
    <EmployeeRegisterDialog open={createOpen && tab === "employees"} onOpenChange={setCreateOpen} onSaved={() => void reload("employees")} />
    <WarehouseRegisterDialog open={createOpen && tab === "warehouses"} onOpenChange={setCreateOpen} onSaved={() => void reload("warehouses")} />
    <VendorRegisterDialog open={createOpen && tab === "vendors"} onOpenChange={setCreateOpen} onSaved={() => void reload("vendors")} />
    <EditDialog editing={editing} onClose={() => setEditing(null)} onSave={async (original, replacement) => { if (!editing) return; try { if (editing.tab === "employees") await updateEmployee(original, replacement as Employee); else if (editing.tab === "warehouses") await updateWarehouse(original, replacement as Warehouse); else await updateVendor(original, replacement as Vendor); setEditing(null); await reload(editing.tab); } catch (error) { await alert({ title: "저장 실패", description: error instanceof Error ? error.message : "수정하지 못했습니다." }); } }} />
    {dialog}
  </div>;
}

function EditDialog({ editing, onClose, onSave }: { editing: { tab: Tab; row: MasterRow } | null; onClose: () => void; onSave: (original: string, replacement: MasterRow) => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => { if (editing) setForm(Object.fromEntries(Object.entries(editing.row).map(([k, v]) => [k, String(v ?? "")]))); }, [editing]);
  if (!editing) return null;
  const fields = editing.tab === "employees" ? [["phone", "연락처"], ["email", "이메일"], ["memo", "메모"]] : editing.tab === "warehouses" ? [["memo", "메모/적요"]] : [["bizRegNo", "사업자등록번호"], ["ceo", "대표자명"], ["contactPerson", "담당자"], ["phone", "전화"], ["mobile", "모바일"], ["email", "이메일"], ["address", "주소"]];
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return <Dialog open onOpenChange={(next) => !next && onClose()}><DialogContent className="max-w-lg" onClose={onClose}><DialogHeader><DialogTitle>{tabs.find((t) => t.id === editing.tab)?.label} 수정</DialogTitle></DialogHeader><div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1"><Field label="코드" value={form.code || ""} onChange={(v) => set("code", v)} /><Field label="명칭" value={form.name || ""} onChange={(v) => set("name", v)} />{editing.tab === "vendors" && <div className="space-y-1.5"><Label>거래처코드구분</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.codeType} onChange={(e) => set("codeType", e.target.value)}>{VENDOR_CODE_TYPE_OPTIONS.map((v) => <option key={v}>{v}</option>)}</select></div>}{fields.map(([key, label]) => <Field key={key} label={label} value={form[key] || ""} onChange={(v) => set(key, v)} />)}</div><DialogFooter><Button variant="outline" onClick={onClose}>취소</Button><Button onClick={() => { if (!form.code?.trim() || !form.name?.trim()) return; const replacement = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined])) as unknown as MasterRow; void onSave(editing.row.code, replacement); }}>저장</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
