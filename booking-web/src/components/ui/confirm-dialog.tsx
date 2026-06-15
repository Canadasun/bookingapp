"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When set, renders a text input and passes its value to onConfirm. */
  inputPlaceholder?: string;
  /** Set to "destructive" to style the confirm button in red. */
  variant?: "default" | "destructive";
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  inputPlaceholder,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");

  function handleConfirm() {
    onConfirm(inputPlaceholder ? inputValue : undefined);
    setInputValue("");
  }

  function handleCancel() {
    setInputValue("");
    onCancel();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none"
          aria-describedby="confirm-desc"
        >
          <div className="flex items-start gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === "destructive" ? "bg-red-100" : "bg-amber-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${variant === "destructive" ? "text-red-600" : "text-amber-600"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-base font-bold text-gray-900">{title}</Dialog.Title>
              <Dialog.Description id="confirm-desc" className="mt-1 text-sm text-gray-500 leading-relaxed">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Cancel">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {inputPlaceholder && (
            <div className="mt-4">
              <input
                autoFocus
                type="text"
                placeholder={inputPlaceholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") handleCancel(); }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${
                variant === "destructive"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
