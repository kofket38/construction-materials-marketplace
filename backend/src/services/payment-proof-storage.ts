import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StoredPaymentProof {
  path: string;
  url: string;
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
}

const extensionByMimeType: Record<
  SupportedPaymentProofMimeType,
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class LocalPaymentProofStorage implements PaymentProofStorage {
  constructor(
    private readonly uploadDirectory: string,
    private readonly publicPath = "/uploads/payment-proofs",
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
      url: `${this.publicPath}/${fileName}`,
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
}
