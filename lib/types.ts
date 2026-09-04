export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | "meeting"
  | "lecture"
  | "trip"
  | "leave"
  | "deadline"
  | "other";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  type: EventType;
  company?: string;
  location?: string;
  project?: string;
  attendees?: string[];
}

export type PaymentStatus = "paid" | "pending" | "overdue";

export interface FinanceRecord {
  id: string;
  client: string;
  description: string;
  amount: number;
  status: PaymentStatus;
  date: string;
  dueDate?: string;
  category: "sales" | "expense" | "subscription";
}

export type MailFolder = "inbox" | "drafts" | "sent" | "trash";

export interface MailMessage {
  id: string;
  folder: MailFolder;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  snippet?: string;
  starred: boolean;
  read: boolean;
  createdAt: string;
  /** Set when moved to trash so restore can return to the prior folder */
  previousFolder?: Exclude<MailFolder, "trash">;
}

export interface AppState {
  tasks: Task[];
  events: CalendarEvent[];
  finances: FinanceRecord[];
  mails: MailMessage[];
}
