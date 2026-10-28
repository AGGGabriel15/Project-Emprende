"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form-controls";

type Result = { ok: true; data?: unknown } | { ok: false; error: string };
type ButtonProps = React.ComponentProps<typeof Button>;

/** Ejecuta una Server Action (ya enlazada con .bind) con confirmación opcional. */
export function ActionButton({
  action,
  confirm: confirmText,
  success,
  children,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<Result>;
  confirm?: string;
  success: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      {...props}
      loading={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (!result.ok) return void toast.error(result.error);
          toast.success(success);
          router.refresh();
        });
      }}
    >
      {children}
    </Button>
  );
}

/** Abre un diálogo que pide un texto (motivo, referencia) antes de ejecutar. */
export function PromptActionButton({
  action,
  title,
  description,
  label,
  placeholder,
  minLength = 5,
  multiline = true,
  confirmLabel,
  success,
  children,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: (text: string) => Promise<Result>;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  minLength?: number;
  multiline?: boolean;
  confirmLabel: string;
  success: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      {open && (
        <DialogContent side="sheet" title={title} description={description}>
          <Field label={label} htmlFor="prompt-text">
            {multiline ? (
              <Textarea id="prompt-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
            ) : (
              <Input id="prompt-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
            )}
          </Field>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button
              variant={props.variant === "danger" ? "danger" : "primary"}
              className="flex-1"
              disabled={text.trim().length < minLength}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await action(text.trim());
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(success);
                  setOpen(false);
                  setText("");
                  router.refresh();
                })
              }
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
