import { FileImage, LoaderCircle } from "lucide-react";
import { useProofObjectUrl } from "@/features/payments/hooks/use-proof-object-url";

interface AuthenticatedProofImageProps {
  /** The opaque filename stored in proofImageUrl (e.g. "<orderId>-<uuid>.jpg") */
  filename: string;
  alt: string;
  className?: string;
}

/**
 * Fetches a payment proof image through the authenticated API and renders it.
 * Never exposes a public URL — uses a blob object URL derived from an
 * authenticated fetch via the existing `apiClient`.
 */
export function AuthenticatedProofImage({
  filename,
  alt,
  className,
}: AuthenticatedProofImageProps) {
  const { objectUrl, isLoading, isError } = useProofObjectUrl(filename);

  if (isLoading) {
    return (
      <div
        aria-label="Loading payment proof"
        className={`flex items-center justify-center bg-zinc-100 ${className ?? ""}`}
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin text-zinc-400"
        />
      </div>
    );
  }

  if (isError || !objectUrl) {
    return (
      <div
        aria-label="Payment proof unavailable"
        className={`flex items-center justify-center bg-zinc-100 ${className ?? ""}`}
      >
        <FileImage aria-hidden="true" className="size-5 text-zinc-400" />
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      src={objectUrl}
    />
  );
}
