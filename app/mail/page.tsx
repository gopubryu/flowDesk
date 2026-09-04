"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  ArrowLeft,
  Inbox,
  Mail,
  MailOpen,
  Pencil,
  Search,
  Send,
  Star,
  Trash2,
  FileText,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { MailMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MailView = "inbox" | "starred" | "drafts" | "sent" | "trash";

const FOLDERS: {
  id: MailView;
  label: string;
  icon: typeof Inbox;
}[] = [
  { id: "inbox", label: "받은편지함", icon: Inbox },
  { id: "starred", label: "중요", icon: Star },
  { id: "drafts", label: "임시보관", icon: FileText },
  { id: "sent", label: "보낸편지함", icon: Send },
  { id: "trash", label: "휴지통", icon: Trash2 },
];

function displayName(raw: string) {
  const m = raw.match(/^(.+?)\s*<[^>]+>$/);
  return (m ? m[1] : raw).trim();
}

function formatMailTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function matchesView(mail: MailMessage, view: MailView) {
  if (view === "starred") return mail.starred && mail.folder !== "trash";
  return mail.folder === view;
}

function emptyCopy(view: MailView) {
  switch (view) {
    case "inbox":
      return { title: "받은편지함이 비어 있습니다", desc: "새 메일이 도착하면 여기에 표시됩니다." };
    case "starred":
      return { title: "중요 메일이 없습니다", desc: "별표를 누르면 중요 메일로 모을 수 있습니다." };
    case "drafts":
      return { title: "임시보관함이 비어 있습니다", desc: "작성 중인 메일을 임시저장해 두세요." };
    case "sent":
      return { title: "보낸 메일이 없습니다", desc: "메일을 보내면 여기에 기록됩니다." };
    case "trash":
      return { title: "휴지통이 비어 있습니다", desc: "삭제한 메일이 여기에 모입니다." };
  }
}

type ComposeState = {
  open: boolean;
  mode: "compose" | "reply";
  draftId?: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
};

const emptyCompose = (): ComposeState => ({
  open: false,
  mode: "compose",
  to: "",
  cc: "",
  subject: "",
  body: "",
});

export default function MailPage() {
  const {
    mails,
    sendMail,
    saveDraft,
    updateMail,
    deleteMail,
    moveToTrash,
    restoreFromTrash,
    toggleStar,
    toggleRead,
  } = useStore();

  const [view, setView] = useState<MailView>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [query, setQuery] = useState("");
  const [compose, setCompose] = useState<ComposeState>(emptyCompose());

  const counts = useMemo(() => {
    const unreadInbox = mails.filter((m) => m.folder === "inbox" && !m.read).length;
    const starred = mails.filter((m) => m.starred && m.folder !== "trash").length;
    const drafts = mails.filter((m) => m.folder === "drafts").length;
    const sent = mails.filter((m) => m.folder === "sent").length;
    const trash = mails.filter((m) => m.folder === "trash").length;
    return {
      inbox: unreadInbox,
      starred,
      drafts,
      sent,
      trash,
    };
  }, [mails]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mails
      .filter((m) => matchesView(m, view))
      .filter((m) => {
        if (!q) return true;
        const hay = [m.subject, m.from, m.to, m.cc ?? "", m.snippet ?? "", m.body]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [mails, view, query]);

  const selected = useMemo(
    () => (selectedId ? mails.find((m) => m.id === selectedId) ?? null : null),
    [mails, selectedId]
  );

  useEffect(() => {
    if (selectedId && !mails.some((m) => m.id === selectedId)) {
      setSelectedId(null);
      setMobileShowDetail(false);
    }
  }, [mails, selectedId]);

  useEffect(() => {
    setSelectedId(null);
    setMobileShowDetail(false);
  }, [view]);

  const openMail = (mail: MailMessage) => {
    setSelectedId(mail.id);
    if (mail.folder === "drafts") {
      setMobileShowDetail(false);
      setCompose({
        open: true,
        mode: "compose",
        draftId: mail.id,
        to: mail.to,
        cc: mail.cc ?? "",
        subject: mail.subject,
        body: mail.body,
      });
      return;
    }
    setMobileShowDetail(true);
    if (!mail.read) {
      updateMail(mail.id, { read: true });
    }
  };

  const openCompose = () => setCompose({ ...emptyCompose(), open: true, mode: "compose" });

  const openReply = (mail: MailMessage) => {
    const replyTo = mail.folder === "sent" ? mail.to : mail.from;
    setCompose({
      open: true,
      mode: "reply",
      to: replyTo,
      cc: "",
      subject: mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`,
      body: `\n\n----- 원본 메일 -----\n보낸사람: ${mail.from}\n받는사람: ${mail.to}\n제목: ${mail.subject}\n\n${mail.body}`,
    });
  };

  const handleSend = () => {
    if (!compose.to.trim()) {
      alert("받는 사람을 입력해 주세요.");
      return;
    }
    sendMail({
      to: compose.to.trim(),
      cc: compose.cc.trim() || undefined,
      subject: compose.subject.trim(),
      body: compose.body,
      draftId: compose.draftId,
    });
    setCompose(emptyCompose());
    setView("sent");
  };

  const handleSaveDraft = () => {
    saveDraft({
      to: compose.to.trim(),
      cc: compose.cc.trim() || undefined,
      subject: compose.subject.trim(),
      body: compose.body,
      draftId: compose.draftId,
    });
    setCompose(emptyCompose());
    setView("drafts");
  };

  const empty = emptyCopy(view);

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:h-[calc(100vh-6.5rem)]">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/80 px-3 py-2.5">
        <Button type="button" size="sm" onClick={openCompose} className="shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          메일 쓰기
        </Button>
        <div className="relative min-w-[160px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="현재 폴더에서 검색…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
          {filtered.length}통
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Folder rail */}
        <aside className="hidden w-[180px] shrink-0 flex-col border-r bg-slate-50/50 sm:flex">
          <nav className="space-y-0.5 p-2">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = view === f.id;
              const count = counts[f.id];
              const showCount =
                f.id === "inbox"
                  ? count > 0
                  : f.id === "drafts" || f.id === "trash"
                    ? count > 0
                    : false;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setView(f.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      f.id === "starred" && active && "fill-primary"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  {showCount && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                        active ? "bg-primary/15 text-primary" : "bg-slate-200/80 text-slate-600"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile folder chips */}
        <div className="flex w-full flex-col sm:hidden">
          {!mobileShowDetail && (
            <>
              <div className="flex gap-1 overflow-x-auto border-b px-2 py-2">
                {FOLDERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setView(f.id)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                      view === f.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {f.label}
                    {f.id === "inbox" && counts.inbox > 0 ? ` (${counts.inbox})` : ""}
                  </button>
                ))}
              </div>
              <MailList
                mails={filtered}
                selectedId={selectedId}
                view={view}
                empty={empty}
                onSelect={openMail}
                onToggleStar={toggleStar}
              />
            </>
          )}
          {mobileShowDetail && selected && (
            <MailReader
              mail={selected}
              onBack={() => setMobileShowDetail(false)}
              onReply={() => openReply(selected)}
              onToggleRead={() => toggleRead(selected.id)}
              onToggleStar={() => toggleStar(selected.id)}
              onTrash={() => {
                moveToTrash(selected.id);
                setMobileShowDetail(false);
                setSelectedId(null);
              }}
              onRestore={() => {
                restoreFromTrash(selected.id);
                setMobileShowDetail(false);
                setSelectedId(null);
              }}
              onDeleteForever={() => {
                if (confirm("이 메일을 영구 삭제할까요?")) {
                  deleteMail(selected.id);
                  setMobileShowDetail(false);
                  setSelectedId(null);
                }
              }}
            />
          )}
        </div>

        {/* Desktop: list + reader */}
        <div className="hidden min-w-0 flex-1 sm:flex">
          <div className="flex w-[min(100%,340px)] shrink-0 flex-col border-r lg:w-[380px]">
            <MailList
              mails={filtered}
              selectedId={selectedId}
              view={view}
              empty={empty}
              onSelect={openMail}
              onToggleStar={toggleStar}
            />
          </div>
          <div className="min-w-0 flex-1 bg-white">
            {selected && selected.folder !== "drafts" ? (
              <MailReader
                mail={selected}
                onReply={() => openReply(selected)}
                onToggleRead={() => toggleRead(selected.id)}
                onToggleStar={() => toggleStar(selected.id)}
                onTrash={() => {
                  moveToTrash(selected.id);
                  setSelectedId(null);
                }}
                onRestore={() => {
                  restoreFromTrash(selected.id);
                  setSelectedId(null);
                }}
                onDeleteForever={() => {
                  if (confirm("이 메일을 영구 삭제할까요?")) {
                    deleteMail(selected.id);
                    setSelectedId(null);
                  }
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <Mail className="h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">메일을 선택하세요</p>
                <p className="text-xs">왼쪽 목록에서 메일을 클릭하면 여기에 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={compose.open}
        onOpenChange={(open) => {
          if (!open) setCompose(emptyCompose());
        }}
      >
        <DialogContent
          className="max-w-xl"
          onClose={() => setCompose(emptyCompose())}
        >
          <DialogHeader>
            <DialogTitle>
              {compose.mode === "reply" ? "답장" : compose.draftId ? "임시보관 편집" : "새 메일"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mail-to">받는 사람</Label>
              <Input
                id="mail-to"
                value={compose.to}
                onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                placeholder="이름 <email@example.com>"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-cc">
                참조 <span className="text-muted-foreground font-normal">(선택)</span>
              </Label>
              <Input
                id="mail-cc"
                value={compose.cc}
                onChange={(e) => setCompose((c) => ({ ...c, cc: e.target.value }))}
                placeholder="선택 사항"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-subject">제목</Label>
              <Input
                id="mail-subject"
                value={compose.subject}
                onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                placeholder="제목"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-body">본문</Label>
              <Textarea
                id="mail-body"
                value={compose.body}
                onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                placeholder="내용을 입력하세요…"
                className="min-h-[200px] resize-y"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleSaveDraft}>
              임시저장
            </Button>
            <Button type="button" onClick={handleSend}>
              <Send className="h-3.5 w-3.5" />
              보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MailList({
  mails,
  selectedId,
  view,
  empty,
  onSelect,
  onToggleStar,
}: {
  mails: MailMessage[];
  selectedId: string | null;
  view: MailView;
  empty: { title: string; desc: string };
  onSelect: (m: MailMessage) => void;
  onToggleStar: (id: string) => void;
}) {
  if (mails.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
        <Inbox className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">{empty.title}</p>
        <p className="text-xs text-muted-foreground">{empty.desc}</p>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {mails.map((mail) => {
        const active = mail.id === selectedId;
        const peer = view === "sent" || view === "drafts" ? mail.to : mail.from;
        return (
          <li key={mail.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(mail)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(mail);
                }
              }}
              className={cn(
                "group flex w-full cursor-pointer gap-2 border-b px-3 py-2.5 text-left transition-colors",
                active ? "bg-primary/5" : "hover:bg-slate-50",
                !mail.read && "bg-indigo-50/40"
              )}
            >
              <button
                type="button"
                className="mt-0.5 shrink-0 text-slate-300 hover:text-amber-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(mail.id);
                }}
                aria-label={mail.starred ? "별표 해제" : "별표"}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    mail.starred && "fill-amber-400 text-amber-400"
                  )}
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!mail.read && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <span
                    className={cn(
                      "truncate text-sm",
                      !mail.read ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                    )}
                  >
                    {displayName(peer)}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatMailTime(mail.createdAt)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-0.5 truncate text-sm",
                    !mail.read ? "font-semibold text-slate-800" : "text-slate-600"
                  )}
                >
                  {mail.subject || "(제목 없음)"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {mail.snippet || mail.body.replace(/\s+/g, " ").slice(0, 80)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MailReader({
  mail,
  onBack,
  onReply,
  onToggleRead,
  onToggleStar,
  onTrash,
  onRestore,
  onDeleteForever,
}: {
  mail: MailMessage;
  onBack?: () => void;
  onReply: () => void;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const inTrash = mail.folder === "trash";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        {onBack && (
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            목록
          </Button>
        )}
        {!inTrash && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onReply}>
              <Send className="h-3.5 w-3.5" />
              답장
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onToggleRead}>
              {mail.read ? (
                <>
                  <Mail className="h-3.5 w-3.5" />
                  안 읽음
                </>
              ) : (
                <>
                  <MailOpen className="h-3.5 w-3.5" />
                  읽음
                </>
              )}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onToggleStar}>
              <Star className={cn("h-3.5 w-3.5", mail.starred && "fill-amber-400 text-amber-400")} />
              {mail.starred ? "별표 해제" : "별표"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onTrash}>
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </Button>
          </>
        )}
        {inTrash && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onRestore}>
              <ArchiveRestore className="h-3.5 w-3.5" />
              복원
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDeleteForever}>
              <Trash2 className="h-3.5 w-3.5" />
              영구 삭제
            </Button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {mail.subject || "(제목 없음)"}
        </h2>
        <div className="mt-3 space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">보낸사람</span>{" "}
            <span className="font-medium">{mail.from}</span>
          </p>
          <p>
            <span className="text-muted-foreground">받는사람</span>{" "}
            <span>{mail.to}</span>
          </p>
          {mail.cc && (
            <p>
              <span className="text-muted-foreground">참조</span> <span>{mail.cc}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(mail.createdAt).toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="mt-6 border-t pt-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {mail.body}
          </pre>
        </div>
      </div>
    </div>
  );
}
