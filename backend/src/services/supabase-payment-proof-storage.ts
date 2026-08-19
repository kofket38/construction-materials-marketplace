import { randomUUID } from "node:crypto";
import { StorageClient } from "@supabase/storage-js";
import type {
  PaymentProofStorage,
  ProofFileBuffer,
  SavePaymentProofInput,
  StoredPaymentProof,
} from "./payment-proof-storage.js";
import { extensionByMimeType } from "./payment-proof-storage.js";

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Stores payment-proof images in a PRIVATE Supabase Storage bucket.
 *
 * The service-role key is required — it must NEVER be exposed to the frontend
 * or included in any Vite/browser environment variable.
 *
 * Files are always fetched via the authenticated backend; the bucket never
 * grants public access.
 */
export class SupabasePaymentProofStorage implements PaymentProofStorage {
  private readonly storage: StorageClient;

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    private readonly bucketName: string,
  ) {
    this.storage = new StorageClient(`${supabaseUrl}/storage/v1`, {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    });
  }

  async save(input: SavePaymentProofInput): Promise<StoredPaymentProof> {
    const ext = extensionByMimeType[input.mimeType];
    const filename = `${input.orderId}-${randomUUID()}.${ext}`;

    const { error } = await this.storage
      .from(this.bucketName)
      .upload(filename, input.buffer, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return {
      // path is the Supabase object key — stored internally, never sent to clients
      path: filename,
      filename,
    };
  }

  async remove(storedProof: StoredPaymentProof): Promise<void> {
    const { error } = await this.storage
      .from(this.bucketName)
      .remove([storedProof.path]);

    if (error) {
      // Log but do not throw — a missing file on remove is not fatal
      console.error(
        `Supabase Storage remove warning: ${error.message} (path=${storedProof.path})`,
      );
    }
  }

  async fetch(filename: string): Promise<ProofFileBuffer | null> {
    const { data, error } = await this.storage
      .from(this.bucketName)
      .download(filename);

    if (error) {
      // Object not found → return null (caller converts to 404)
      if (
        error.message.includes("Not Found") ||
        error.message.includes("404") ||
        error.message.includes("does not exist")
      ) {
        return null;
      }
      throw new Error(`Supabase Storage fetch failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const contentType = mimeByExtension[ext] ?? "application/octet-stream";
    const buffer = Buffer.from(await data.arrayBuffer());

    return { buffer, contentType };
  }
}
