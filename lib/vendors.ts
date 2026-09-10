import { masterDataRequest } from "./master-data-client";
import { nextCode, type Vendor } from "./master-data";
export type { Vendor, VendorCodeType } from "./master-data";
export { SEED_VENDORS, VENDOR_CODE_TYPE_OPTIONS } from "./master-data";
export const loadVendors = () => masterDataRequest<Vendor[]>("/api/vendors");
export const createVendor = (row: Vendor) => masterDataRequest<Vendor>("/api/vendors", { method: "POST", body: JSON.stringify(row) });
export const updateVendor = (code: string, row: Vendor) => masterDataRequest<Vendor>(`/api/vendors/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(row) });
export const deleteVendor = (code: string) => masterDataRequest<{ ok: true }>(`/api/vendors/${encodeURIComponent(code)}`, { method: "DELETE" });
export async function upsertVendor(row: Vendor) { return createVendor(row); }
export async function nextVendorCode() { return nextCode(await loadVendors(), "V"); }
export async function searchVendors(query: string) { const q=query.trim().toLowerCase(); const rows=await loadVendors(); return q ? rows.filter(v => [v.code,v.name,v.ceo,v.phone,v.mobile,v.email,v.contactPerson].some(x => x?.toLowerCase().includes(q))) : rows; }
