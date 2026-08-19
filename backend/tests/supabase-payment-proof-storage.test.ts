/**
 * Unit tests for SupabasePaymentProofStorage.
 *
 * The Supabase StorageClient is mocked — no live Supabase project required.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabasePaymentProofStorage } from "../src/services/supabase-payment-proof-storage.js";

// vi.hoisted ensures these mocks are defined before vi.mock() factories run
const { mockUpload, mockRemove, mockDownload, mockFrom } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  const mockRemove = vi.fn();
  const mockDownload = vi.fn();
  const mockFrom = vi.fn(() => ({
    upload: mockUpload,
    remove: mockRemove,
    download: mockDownload,
  }));
  return { mockUpload, mockRemove, mockDownload, mockFrom };
});

vi.mock("@supabase/storage-js", () => ({
  StorageClient: class {
    from = mockFrom;
  },
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_ROLE_KEY = "service-role-key-for-testing-only";
const BUCKET = "payment-proofs";

const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("SupabasePaymentProofStorage", () => {
  let storage: SupabasePaymentProofStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new SupabasePaymentProofStorage(SUPABASE_URL, SERVICE_ROLE_KEY, BUCKET);
  });

  // ── 1. save() — success ──────────────────────────────────────────────────

  it("uploads to the bucket and returns an opaque filename", async () => {
    mockUpload.mockResolvedValue({ data: { path: "test.png" }, error: null });

    const orderId = randomUUID();
    const result = await storage.save({
      buffer: validPng,
      mimeType: "image/png",
      orderId,
    });

    expect(mockFrom).toHaveBeenCalledWith(BUCKET);
    expect(mockUpload).toHaveBeenCalledOnce();

    const [uploadedPath, uploadedBuffer, uploadOptions] =
      mockUpload.mock.calls[0] as [string, Buffer, Record<string, unknown>];

    expect(uploadedPath).toContain(orderId);
    expect(uploadedPath).toMatch(/\.png$/);
    expect(uploadedBuffer).toBe(validPng);
    expect(uploadOptions.contentType).toBe("image/png");
    expect(uploadOptions.upsert).toBe(false);

    // Filename is the object key — never a public URL
    expect(result.filename).toBe(uploadedPath);
    expect(result.filename).not.toMatch(/^https?:\/\//);
    expect(result.path).not.toMatch(/^https?:\/\//);
  });

  it("generates different filenames for different orders", async () => {
    mockUpload.mockResolvedValue({ data: { path: "test.png" }, error: null });
    const r1 = await storage.save({ buffer: validPng, mimeType: "image/png", orderId: randomUUID() });
    const r2 = await storage.save({ buffer: validPng, mimeType: "image/png", orderId: randomUUID() });
    expect(r1.filename).not.toBe(r2.filename);
  });

  // ── 2. save() — storage error ────────────────────────────────────────────

  it("propagates a storage upload error", async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: "Bucket not found" } });

    await expect(
      storage.save({ buffer: validPng, mimeType: "image/jpeg", orderId: randomUUID() }),
    ).rejects.toThrow("Supabase Storage upload failed");
  });

  // ── 3. remove() ──────────────────────────────────────────────────────────

  it("calls remove with the correct object path", async () => {
    mockRemove.mockResolvedValue({ data: [], error: null });
    const proof = { path: "some-orderId-uuid.jpg", filename: "some-orderId-uuid.jpg" };
    await storage.remove(proof);
    expect(mockFrom).toHaveBeenCalledWith(BUCKET);
    expect(mockRemove).toHaveBeenCalledWith(["some-orderId-uuid.jpg"]);
  });

  it("does not throw when remove reports an error (non-fatal)", async () => {
    mockRemove.mockResolvedValue({ data: null, error: { message: "Not Found" } });
    await expect(
      storage.remove({ path: "missing.png", filename: "missing.png" }),
    ).resolves.toBeUndefined();
  });

  // ── 4. fetch() — existing object ─────────────────────────────────────────

  it("returns buffer and content type for an existing proof", async () => {
    const blob = new Blob([validPng], { type: "image/png" });
    mockDownload.mockResolvedValue({ data: blob, error: null });

    const result = await storage.fetch("orderId-uuid.png");

    expect(mockFrom).toHaveBeenCalledWith(BUCKET);
    expect(mockDownload).toHaveBeenCalledWith("orderId-uuid.png");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/png");
    expect(Buffer.isBuffer(result!.buffer)).toBe(true);
    expect(result!.buffer.slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("maps .jpg extension to image/jpeg content type", async () => {
    const blob = new Blob([Buffer.from([0xff, 0xd8, 0xff])]);
    mockDownload.mockResolvedValue({ data: blob, error: null });
    const result = await storage.fetch("proof.jpg");
    expect(result!.contentType).toBe("image/jpeg");
  });

  // ── 5. fetch() — not found ───────────────────────────────────────────────

  it("returns null when the object is not found", async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: "Object Not Found" } });
    const result = await storage.fetch("nonexistent.png");
    expect(result).toBeNull();
  });

  it("returns null when download data is null with no error", async () => {
    mockDownload.mockResolvedValue({ data: null, error: null });
    const result = await storage.fetch("empty.png");
    expect(result).toBeNull();
  });

  // ── 6. fetch() — unexpected error ────────────────────────────────────────

  it("propagates unexpected fetch errors", async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: "Internal Server Error" } });
    await expect(storage.fetch("proof.png")).rejects.toThrow("Supabase Storage fetch failed");
  });
});
