"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CalendarEvent,
  FinanceRecord,
  MailFolder,
  MailMessage,
  Task,
  TaskStatus,
} from "./types";
import { ME_FROM } from "./mock-data";

interface StoreContextValue {
  tasks: Task[];
  events: CalendarEvent[];
  finances: FinanceRecord[];
  mails: MailMessage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (id: string, status: TaskStatus) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, "id">) => Promise<void>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addFinance: (record: Omit<FinanceRecord, "id">) => Promise<void>;
  updateFinance: (id: string, patch: Partial<FinanceRecord>) => Promise<void>;
  deleteFinance: (id: string) => Promise<void>;
  addMail: (
    mail: Omit<MailMessage, "id" | "createdAt" | "snippet"> & { snippet?: string }
  ) => Promise<void>;
  updateMail: (id: string, patch: Partial<MailMessage>) => Promise<void>;
  deleteMail: (id: string) => Promise<void>;
  sendMail: (input: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    draftId?: string;
  }) => Promise<void>;
  saveDraft: (input: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    draftId?: string;
  }) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restoreFromTrash: (id: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  toggleRead: (id: string) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function makeSnippet(body: string) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [mails, setMails] = useState<MailMessage[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, e, f, m] = await Promise.all([
        apiJson<Task[]>("/api/tasks"),
        apiJson<CalendarEvent[]>("/api/events"),
        apiJson<FinanceRecord[]>("/api/finances"),
        apiJson<MailMessage[]>("/api/mails"),
      ]);
      setTasks(t);
      setEvents(e);
      setFinances(f);
      setMails(m);
      // Drop legacy localStorage demo state
      try {
        localStorage.removeItem("flowdesk-state-v3");
        localStorage.removeItem("flowdesk-state-v4");
      } catch {
        /* ignore */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      console.error("Store refresh failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTask = useCallback(
    async (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
      const created = await apiJson<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(task),
      });
      setTasks((prev) => [created, ...prev]);
    },
    []
  );

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    const updated = await apiJson<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await apiJson(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveTask = useCallback(
    async (id: string, status: TaskStatus) => {
      await updateTask(id, { status });
    },
    [updateTask]
  );

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "id">) => {
    const created = await apiJson<CalendarEvent>("/api/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
    setEvents((prev) => [created, ...prev]);
  }, []);

  const updateEvent = useCallback(async (id: string, patch: Partial<CalendarEvent>) => {
    const updated = await apiJson<CalendarEvent>(`/api/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    await apiJson(`/api/events/${id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addFinance = useCallback(async (record: Omit<FinanceRecord, "id">) => {
    const created = await apiJson<FinanceRecord>("/api/finances", {
      method: "POST",
      body: JSON.stringify(record),
    });
    setFinances((prev) => [created, ...prev]);
  }, []);

  const updateFinance = useCallback(async (id: string, patch: Partial<FinanceRecord>) => {
    const updated = await apiJson<FinanceRecord>(`/api/finances/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setFinances((prev) => prev.map((f) => (f.id === id ? updated : f)));
  }, []);

  const deleteFinance = useCallback(async (id: string) => {
    await apiJson(`/api/finances/${id}`, { method: "DELETE" });
    setFinances((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const addMail = useCallback(
    async (
      mail: Omit<MailMessage, "id" | "createdAt" | "snippet"> & { snippet?: string }
    ) => {
      const created = await apiJson<MailMessage>("/api/mails", {
        method: "POST",
        body: JSON.stringify({
          ...mail,
          snippet: mail.snippet ?? makeSnippet(mail.body),
        }),
      });
      setMails((prev) => [created, ...prev]);
    },
    []
  );

  const updateMail = useCallback(async (id: string, patch: Partial<MailMessage>) => {
    const updated = await apiJson<MailMessage>(`/api/mails/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setMails((prev) => prev.map((m) => (m.id === id ? updated : m)));
  }, []);

  const deleteMail = useCallback(async (id: string) => {
    await apiJson(`/api/mails/${id}`, { method: "DELETE" });
    setMails((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const sendMail = useCallback(
    async (input: {
      to: string;
      cc?: string;
      subject: string;
      body: string;
      draftId?: string;
    }) => {
      const payload = {
        folder: "sent" as MailFolder,
        from: ME_FROM,
        to: input.to,
        cc: input.cc || undefined,
        subject: input.subject || "(제목 없음)",
        body: input.body,
        snippet: makeSnippet(input.body),
        starred: false,
        read: true,
        previousFolder: null,
      };
      if (input.draftId) {
        const updated = await apiJson<MailMessage>(`/api/mails/${input.draftId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMails((prev) => [updated, ...prev.filter((m) => m.id !== input.draftId)]);
      } else {
        const created = await apiJson<MailMessage>("/api/mails", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMails((prev) => [created, ...prev]);
      }
    },
    []
  );

  const saveDraft = useCallback(
    async (input: {
      to: string;
      cc?: string;
      subject: string;
      body: string;
      draftId?: string;
    }) => {
      const payload = {
        folder: "drafts" as MailFolder,
        from: ME_FROM,
        to: input.to,
        cc: input.cc || undefined,
        subject: input.subject || "(제목 없음)",
        body: input.body,
        snippet: makeSnippet(input.body),
        starred: false,
        read: true,
      };
      if (input.draftId) {
        const updated = await apiJson<MailMessage>(`/api/mails/${input.draftId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMails((prev) => prev.map((m) => (m.id === input.draftId ? updated : m)));
      } else {
        const created = await apiJson<MailMessage>("/api/mails", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMails((prev) => [created, ...prev]);
      }
    },
    []
  );

  const moveToTrash = useCallback(
    async (id: string) => {
      const current = mails.find((m) => m.id === id);
      if (!current || current.folder === "trash") return;
      await updateMail(id, {
        previousFolder: current.folder,
        folder: "trash",
        starred: false,
      });
    },
    [mails, updateMail]
  );

  const restoreFromTrash = useCallback(
    async (id: string) => {
      const current = mails.find((m) => m.id === id);
      if (!current || current.folder !== "trash") return;
      await apiJson<MailMessage>(`/api/mails/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          folder: current.previousFolder ?? "inbox",
          previousFolder: null,
        }),
      }).then((updated) => {
        setMails((prev) => prev.map((m) => (m.id === id ? updated : m)));
      });
    },
    [mails, updateMail]
  );

  const toggleStar = useCallback(
    async (id: string) => {
      const current = mails.find((m) => m.id === id);
      if (!current) return;
      await updateMail(id, { starred: !current.starred });
    },
    [mails, updateMail]
  );

  const toggleRead = useCallback(
    async (id: string) => {
      const current = mails.find((m) => m.id === id);
      if (!current) return;
      await updateMail(id, { read: !current.read });
    },
    [mails, updateMail]
  );

  const resetDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{
        tasks: Task[];
        events: CalendarEvent[];
        finances: FinanceRecord[];
        mails: MailMessage[];
      }>("/api/demo/reset", { method: "POST" });
      setTasks(data.tasks);
      setEvents(data.events);
      setFinances(data.finances);
      setMails(data.mails);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset demo";
      setError(message);
      console.error("resetDemo failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      events,
      finances,
      mails,
      loading,
      error,
      refresh,
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      addEvent,
      updateEvent,
      deleteEvent,
      addFinance,
      updateFinance,
      deleteFinance,
      addMail,
      updateMail,
      deleteMail,
      sendMail,
      saveDraft,
      moveToTrash,
      restoreFromTrash,
      toggleStar,
      toggleRead,
      resetDemo,
    }),
    [
      tasks,
      events,
      finances,
      mails,
      loading,
      error,
      refresh,
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      addEvent,
      updateEvent,
      deleteEvent,
      addFinance,
      updateFinance,
      deleteFinance,
      addMail,
      updateMail,
      deleteMail,
      sendMail,
      saveDraft,
      moveToTrash,
      restoreFromTrash,
      toggleStar,
      toggleRead,
      resetDemo,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
