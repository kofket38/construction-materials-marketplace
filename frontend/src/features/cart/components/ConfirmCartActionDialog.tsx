import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ConfirmCartActionDialogProps {
  actionLabel: string;
  description: string;
  isOpen: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}

export function ConfirmCartActionDialog({
  actionLabel,
  description,
  isOpen,
  isPending,
  onCancel,
  onConfirm,
  title,
}: ConfirmCartActionDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4 py-8"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isPending) {
          onCancel();
        }
      }}
    >
      <section
        aria-describedby="cart-confirm-description"
        aria-labelledby="cart-confirm-title"
        aria-modal="true"
        className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl"
        role="alertdialog"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <button
            aria-label="Close confirmation"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <h2
          className="mt-5 text-xl font-semibold text-zinc-950"
          id="cart-confirm-title"
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm leading-6 text-zinc-600"
          id="cart-confirm-description"
        >
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {isPending ? "Updating..." : actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
