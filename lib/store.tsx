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
  AppState,
  CalendarEvent,
  FinanceRecord,
  MailFolder,
  MailMessage,
  Task,
  TaskStatus,
} from "./types";
import {
  initialEvents,
  initialFinances,
  initialMails,
  initialTasks,
  ME_FROM,
} from "./mock-data";

const STORAGE_KEY = "flowdesk-state-v3";

interface StoreContextValue {
  tasks: Task[];
  events: CalendarEvent[];
  finances: FinanceRecord[];
  mails: MailMessage[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  addFinance: (record: Omit<FinanceRecord, "id">) => void;
  updateFinance: (id: string, patch: Partial<FinanceRecord>) => void;
  deleteFinance: (id: string) => void;
  addMail: (
    mail: Omit<MailMessage, "id" | "createdAt" | "snippet"> & { snippet?: string }
  ) => void;
  updateMail: (id: string, patch: Partial<MailMessage>) => void;
  deleteMail: (id: string) => void;
  sendMail: (input: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    draftId?: string;
  }) => void;
  saveDraft: (input: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    draftId?: string;
  }) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  toggleStar: (id: string) => void;
  toggleRead: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSnippet(body: string) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

function emptyState(): AppState {
  return {
    tasks: initialTasks,
    events: initialEvents,
    finances: initialFinances,
    mails: initialMails,
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") {
    return emptyState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed.tasks && parsed.events && parsed.finances && parsed.mails) {
        return parsed as AppState;
      }
    }
  } catch {
    /* ignore */
  }
  return emptyState();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [finances, setFinances] = useState<FinanceRecord[]>(initialFinances);
  const [mails, setMails] = useState<MailMessage[]>(initialMails);

  useEffect(() => {
    const state = loadState();
    setTasks(state.tasks);
    setEvents(state.events);
    setFinances(state.finances);
    setMails(state.mails);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks, events, finances, mails } satisfies AppState)
    );
  }, [tasks, events, finances, mails, hydrated]);

  const addTask = useCallback(
    (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      setTasks((prev) => [
        { ...task, id: uid("task"), createdAt: now, updatedAt: now },
        ...prev,
      ]);
    },
    []
  );

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
      )
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
      )
    );
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, "id">) => {
    setEvents((prev) => [{ ...event, id: uid("evt") }, ...prev]);
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addFinance = useCallback((record: Omit<FinanceRecord, "id">) => {
    setFinances((prev) => [{ ...record, id: uid("fin") }, ...prev]);
  }, []);

  const updateFinance = useCallback((id: string, patch: Partial<FinanceRecord>) => {
    setFinances((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const deleteFinance = useCallback((id: string) => {
    setFinances((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const addMail = useCallback(
    (
      mail: Omit<MailMessage, "id" | "createdAt" | "snippet"> & { snippet?: string }
    ) => {
      const now = new Date().toISOString();
      setMails((prev) => [
        {
          ...mail,
          id: uid("mail"),
          createdAt: now,
          snippet: mail.snippet ?? makeSnippet(mail.body),
        },
        ...prev,
      ]);
    },
    []
  );

  const updateMail = useCallback((id: string, patch: Partial<MailMessage>) => {
    setMails((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        if (patch.body !== undefined && patch.snippet === undefined) {
          next.snippet = makeSnippet(patch.body);
        }
        return next;
      })
    );
  }, []);

  const deleteMail = useCallback((id: string) => {
    setMails((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const sendMail = useCallback(
    (input: {
      to: string;
      cc?: string;
      subject: string;
      body: string;
      draftId?: string;
    }) => {
      const now = new Date().toISOString();
      const payload: MailMessage = {
        id: input.draftId ?? uid("mail"),
        folder: "sent",
        from: ME_FROM,
        to: input.to,
        cc: input.cc || undefined,
        subject: input.subject || "(제목 없음)",
        body: input.body,
        snippet: makeSnippet(input.body),
        starred: false,
        read: true,
        createdAt: now,
      };
      setMails((prev) => {
        if (input.draftId) {
          return [payload, ...prev.filter((m) => m.id !== input.draftId)];
        }
        return [payload, ...prev];
      });
    },
    []
  );

  const saveDraft = useCallback(
    (input: {
      to: string;
      cc?: string;
      subject: string;
      body: string;
      draftId?: string;
    }) => {
      const now = new Date().toISOString();
      setMails((prev) => {
        if (input.draftId) {
          return prev.map((m) =>
            m.id === input.draftId
              ? {
                  ...m,
                  folder: "drafts" as MailFolder,
                  to: input.to,
                  cc: input.cc || undefined,
                  subject: input.subject || "(제목 없음)",
                  body: input.body,
                  snippet: makeSnippet(input.body),
                  from: ME_FROM,
                  read: true,
                }
              : m
          );
        }
        return [
          {
            id: uid("mail"),
            folder: "drafts" as MailFolder,
            from: ME_FROM,
            to: input.to,
            cc: input.cc || undefined,
            subject: input.subject || "(제목 없음)",
            body: input.body,
            snippet: makeSnippet(input.body),
            starred: false,
            read: true,
            createdAt: now,
          },
          ...prev,
        ];
      });
    },
    []
  );

  const moveToTrash = useCallback((id: string) => {
    setMails((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.folder === "trash") return m;
        return {
          ...m,
          previousFolder: m.folder,
          folder: "trash" as MailFolder,
          starred: false,
        };
      })
    );
  }, []);

  const restoreFromTrash = useCallback((id: string) => {
    setMails((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.folder !== "trash") return m;
        return {
          ...m,
          folder: m.previousFolder ?? "inbox",
          previousFolder: undefined,
        };
      })
    );
  }, []);

  const toggleStar = useCallback((id: string) => {
    setMails((prev) =>
      prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m))
    );
  }, []);

  const toggleRead = useCallback((id: string) => {
    setMails((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: !m.read } : m))
    );
  }, []);

  const resetDemo = useCallback(() => {
    setTasks(initialTasks);
    setEvents(initialEvents);
    setFinances(initialFinances);
    setMails(initialMails);
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      events,
      finances,
      mails,
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
