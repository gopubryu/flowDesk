"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const COLUMNS: { id: TaskStatus; title: string; tint: string }[] = [
  { id: "todo", title: "할 일", tint: "bg-slate-50 border-slate-200" },
  { id: "in_progress", title: "진행 중", tint: "bg-blue-50/60 border-blue-200" },
  { id: "done", title: "완료", tint: "bg-emerald-50/60 border-emerald-200" },
];

const priorityLabel: Record<TaskPriority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function TaskCard({
  task,
  onEdit,
  onDelete,
  dragging,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        (isDragging || dragging) && "opacity-50 ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-snug">{task.title}</p>
          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                task.priority === "high"
                  ? "danger"
                  : task.priority === "medium"
                    ? "warning"
                    : "secondary"
              }
            >
              {priorityLabel[task.priority]}
            </Badge>
            {task.dueDate && (
              <span className="text-[11px] text-muted-foreground">{task.dueDate}</span>
            )}
            {task.assignee && (
              <span className="text-[11px] text-muted-foreground">· {task.assignee}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" type="button" onClick={() => onEdit(task)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            type="button"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Column({
  column,
  tasks,
  onEdit,
  onDelete,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <Card className={cn("flex flex-col border", column.tint, isOver && "ring-2 ring-primary/40")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{column.title}</span>
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent ref={setNodeRef} className="flex-1 space-y-2 min-h-[180px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
      </CardContent>
    </Card>
  );
}

const emptyForm = {
  title: "",
  description: "",
  status: "todo" as TaskStatus,
  priority: "medium" as TaskPriority,
  dueDate: "",
  assignee: "",
};

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, moveTask } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let nextStatus: TaskStatus | null = null;
    if (COLUMNS.some((c) => c.id === overId)) {
      nextStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) nextStatus = overTask.status;
    }

    if (nextStatus) {
      const current = tasks.find((t) => t.id === taskId);
      if (current && current.status !== nextStatus) moveTask(taskId, nextStatus);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      assignee: task.assignee ?? "",
    });
    setOpen(true);
  }

  function save() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      assignee: form.assignee.trim() || undefined,
    };
    if (editing) updateTask(editing.id, payload);
    else addTask(payload);
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          카드를 드래그해 컬럼 간 이동 · 클릭으로 수정할 수 있습니다.
        </p>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" /> 할 일 추가
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={byStatus[col.id]}
              onEdit={openEdit}
              onDelete={deleteTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rounded-lg border bg-card p-3 shadow-lg opacity-95">
              <p className="font-medium text-sm">{activeTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} className="relative">
          <DialogHeader>
            <DialogTitle>{editing ? "할 일 수정" : "새 할 일"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="예: 견적서 작성"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">설명</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="상세 내용"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="status">상태</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))
                  }
                >
                  <option value="todo">할 일</option>
                  <option value="in_progress">진행 중</option>
                  <option value="done">완료</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">우선순위</Label>
                <select
                  id="priority"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
                  }
                >
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="due">마감일</Label>
                <Input
                  id="due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assignee">담당자</Label>
                <Input
                  id="assignee"
                  value={form.assignee}
                  onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                  placeholder="이름"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={save}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
