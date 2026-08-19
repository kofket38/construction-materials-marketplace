import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StoredPaymentProof {
  /**
   * Storage-backend reference — for local storage this is the absolute
   * filesystem path; for Supabase Storage this is the object key.
   * Never exposed to clients.
   */
  path: string;
  /** Opaque filename stored in DB and used to build /api/payments/proof/:filename */
  filename: string;
}

export interface ProofFileBuffer {
  buffer: Buffer;
  /** MIME content type, e.g. "image/png" */
  contentType: string;
}

export interface SavePaymentProofInput {
  buffer: Buffer;
  mimeType: SupportedPaymentProofMimeType;
  orderId: string;
}

export type SupportedPaymentProofMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface PaymentProofStorage {
  save(input: SavePaymentProofInput): Promise<StoredPaymentProof>;
  remove(storedProof: StoredPaymentProof): Promise<void>;
  /**
   * Fetch the proof bytes for authenticated serving.
   * Returns null when the object does not exist.
   */
  fetch(filename: string): Promise<ProofFileBuffer | null>;
}

export const extensionByMimeType: Record<
  SupportedPaymentProofMimeType,
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Maps common image extensions back to MIME types for Content-Type header */
const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class LocalPaymentProofStorage implements PaymentProofStorage {
  constructor(
    private readonly uploadDirectory: string,
  ) {}

  async save(input: SavePaymentProofInput): Promise<StoredPaymentProof> {
    await mkdir(this.uploadDirectory, { recursive: true });

    const fileName = `${input.orderId}-${randomUUID()}.${
      extensionByMimeType[input.mimeType]
    }`;
    const filePath = path.join(this.uploadDirectory, fileName);
    await writeFile(filePath, input.buffer, { flag: "wx" });

    return {
      path: filePath,
      filename: fileName,
    };
  }

  async remove(storedProof: StoredPaymentProof): Promise<void> {
    try {
      await unlink(storedProof.path);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  async fetch(filename: string): Promise<ProofFileBuffer | null> {
    const filePath = path.join(this.uploadDirectory, filename);
    try {
      const buffer = await readFile(filePath);
      const ext = path.extname(filename).slice(1).toLowerCase();
      const contentType = mimeByExtension[ext] ?? "application/octet-stream";
      return { buffer, contentType };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }
  }
}
