"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export type AppAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  /** default = indigo primary; danger = rose delete style */
  confirmVariant?: "default" | "danger";
  /** alert = single confirm button; confirm = cancel + confirm */
  mode?: "alert" | "confirm";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  confirmDisabled?: boolean;
};

export function AppAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  cancelLabel = "취소",
  confirmLabel = "확인",
  confirmVariant = "default",
  mode = "confirm",
  onConfirm,
  onCancel,
  confirmDisabled = false,
}: AppAlertDialogProps) {
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  function requestClose() {
    if (busy) return;
    onCancel?.();
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (busy || confirmDisabled) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
        else onOpenChange(true);
      }}
      className="z-[60]"
    >
      <DialogContent
        className="max-w-sm rounded-2xl border-slate-200 bg-white p-5 shadow-xl"
        onClose={requestClose}
      >
        <DialogHeader className="mb-2 pr-8">
          <DialogTitle className="text-base font-semibold tracking-tight text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        {description ? (
          <p className="mb-3 text-xs text-muted-foreground">{description}</p>
        ) : null}
        {children}
        <DialogFooter className="mt-4 gap-2">
          {mode === "confirm" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={requestClose}
              disabled={busy}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className={cn(
              confirmVariant === "danger"
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
            onClick={() => void handleConfirm()}
            disabled={busy || confirmDisabled}
          >
            {busy ? "처리 중…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type AppAlertOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
};

export type AppConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "danger";
};

type PendingDialog = {
  mode: "alert" | "confirm";
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant: "default" | "danger";
};

/**
 * Imperative helper for replacing window.alert / window.confirm.
 * Render `dialog` once in the component tree.
 */
export function useAppDialog() {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PendingDialog | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const finish = React.useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    setPending(null);
    resolve?.(value);
  }, []);

  const alert = React.useCallback((opts: AppAlertOptions | string) => {
    const description = typeof opts === "string" ? opts : opts.description;
    const title = typeof opts === "string" ? "알림" : opts.title ?? "알림";
    const confirmLabel =
      typeof opts === "string" ? "확인" : opts.confirmLabel ?? "확인";
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setPending({
        mode: "alert",
        title,
        description,
        confirmLabel,
        cancelLabel: "취소",
        confirmVariant: "default",
      });
      setOpen(true);
    });
  }, []);

  const confirm = React.useCallback((opts: AppConfirmOptions | string) => {
    const description = typeof opts === "string" ? opts : opts.description;
    const title = typeof opts === "string" ? "확인" : opts.title ?? "확인";
    const confirmLabel =
      typeof opts === "string" ? "확인" : opts.confirmLabel ?? "확인";
    const cancelLabel =
      typeof opts === "string" ? "취소" : opts.cancelLabel ?? "취소";
    const confirmVariant =
      typeof opts === "string" ? "default" : opts.confirmVariant ?? "default";
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({
        mode: "confirm",
        title,
        description,
        confirmLabel,
        cancelLabel,
        confirmVariant,
      });
      setOpen(true);
    });
  }, []);

  const dialog = (
    <AppAlertDialog
      open={open && !!pending}
      onOpenChange={(next) => {
        if (!next) finish(false);
      }}
      title={pending?.title ?? "알림"}
      description={pending?.description}
      mode={pending?.mode ?? "alert"}
      confirmLabel={pending?.confirmLabel ?? "확인"}
      cancelLabel={pending?.cancelLabel ?? "취소"}
      confirmVariant={pending?.confirmVariant ?? "default"}
      onConfirm={() => {
        finish(true);
      }}
      onCancel={() => finish(false)}
    />
  );

  return { alert, confirm, dialog };
}
