import { ImageUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface PaymentProofUploadProps {
  disabled?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}

export function PaymentProofUpload({
  disabled = false,
  file,
  onChange,
}: PaymentProofUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function selectFile(selectedFile: File | undefined): void {
    if (!selectedFile) {
      return;
    }
    if (!acceptedImageTypes.has(selectedFile.type)) {
      setError("Select a JPEG, PNG, or WebP image.");
      onChange(null);
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The payment screenshot must not exceed 5 MB.");
      onChange(null);
      return;
    }

    setError(null);
    onChange(selectedFile);
  }

  return (
    <section aria-labelledby="payment-proof-heading">
      <div className="flex items-center justify-between gap-4">
        <h2
          className="text-base font-semibold text-zinc-950"
          id="payment-proof-heading"
        >
          Payment screenshot
        </h2>
        {file ? (
          <button
            aria-label="Remove payment screenshot"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={() => {
              setError(null);
              onChange(null);
            }}
            title="Remove payment screenshot"
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {previewUrl ? (
        <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
          <img
            alt="Selected payment screenshot"
            className="max-h-80 w-full object-contain"
            src={previewUrl}
          />
          <p className="truncate border-t border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600">
            {file?.name}
          </p>
        </div>
      ) : (
        <label
          className={`mt-4 flex min-h-40 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center transition-colors ${
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-brand hover:bg-brand-soft-hover"
          }`}
          htmlFor="payment-proof"
        >
          <span>
            <ImageUp
              aria-hidden="true"
              className="mx-auto size-7 text-zinc-500"
            />
            <span className="mt-3 block text-sm font-semibold text-zinc-800">
              Upload payment screenshot
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              JPEG, PNG, or WebP up to 5 MB
            </span>
          </span>
        </label>
      )}

      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        id="payment-proof"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        type="file"
      />

      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
