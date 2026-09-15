"use client";

import { FormEvent, useEffect, useState } from "react";
import { masterDataRequest } from "@/lib/master-data-client";

type Membership = { workspace: { id: string; name?: string }; role: "ADMIN" | "OPERATOR" | "VIEWER" };
type Invitation = { id: string; email: string; role: string; expiresAt: string; createdAt: string };

export default function WorkspaceMembersPage() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OPERATOR" | "VIEWER">("OPERATOR");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(true);

  async function load() {
    setPending(true);
    setError("");
    try {
      const data = await masterDataRequest<{ memberships: Membership[] }>("/api/auth/workspaces");
      const current = data.memberships[0] ?? null;
      setMembership(current);
      if (current?.role === "ADMIN") {
        const result = await masterDataRequest<{ invitations: Invitation[] }>(`/api/auth/invitations?workspaceId=${encodeURIComponent(current.workspace.id)}`);
        setInvitations(result.invitations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership) return;
    setPending(true); setError(""); setNotice("");
    try {
      const result = await masterDataRequest<{ invitation: Invitation; delivery: string; deliveryMessage?: string }>("/api/auth/invitations", {
        method: "POST",
        body: JSON.stringify({ workspaceId: membership.workspace.id, email, role }),
      });
      setInvitations((current) => [result.invitation, ...current]);
      setEmail("");
      setNotice(result.deliveryMessage ?? "초대가 생성되었습니다. 초대 링크는 이메일 provider 설정 후 발송됩니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "초대를 생성하지 못했습니다.");
    } finally { setPending(false); }
  }

  if (pending && !membership) return <main className="p-6 text-sm text-muted-foreground">사용자 권한을 확인하는 중…</main>;
  if (membership?.role !== "ADMIN") return <main className="p-6"><h1 className="text-xl font-semibold">사용자·권한 관리</h1><p className="mt-3 text-sm text-destructive">관리자만 접근할 수 있습니다.</p></main>;

  return <main className="mx-auto w-full max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">사용자·권한 관리</h1><p className="mt-1 text-sm text-muted-foreground">{membership.workspace.name ?? "현재 업무 공간"}의 사용자를 초대하고 권한을 관리합니다.</p></div>
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">사용자 초대</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_auto]" onSubmit={submit}>
        <input className="rounded-lg border bg-background px-3 py-2 text-sm" type="email" required placeholder="초대할 이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as "OPERATOR" | "VIEWER")}><option value="OPERATOR">OPERATOR</option><option value="VIEWER">VIEWER</option></select>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">초대 생성</button>
      </form>
      {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
    <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">대기 중인 초대</h2>{invitations.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">대기 중인 초대가 없습니다.</p> : <ul className="mt-4 divide-y">{invitations.map((invite) => <li className="flex items-center justify-between gap-3 py-3 text-sm" key={invite.id}><span>{invite.email}</span><span className="text-muted-foreground">{invite.role} · {new Date(invite.expiresAt).toLocaleDateString("ko-KR")}까지</span></li>)}</ul>}</section>
  </main>;
}
