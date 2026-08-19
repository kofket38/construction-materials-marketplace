import { randomUUID } from "node:crypto";
import type {
  PatchSellerProfileInput,
  SellerProfileEntity,
  SellerProfileRepository,
  UpsertSellerProfileInput,
} from "../../src/repositories/seller-profile.repository.js";

export class InMemorySellerProfileRepository
  implements SellerProfileRepository
{
  private readonly profiles = new Map<string, SellerProfileEntity>();

  /** Directly seed a profile, bypassing business rules. */
  addProfile(
    userId: string,
    overrides: Partial<Omit<SellerProfileEntity, "id" | "userId">> = {},
  ): SellerProfileEntity {
    const now = new Date();
    const profile: SellerProfileEntity = {
      id: randomUUID(),
      userId,
      shopName: overrides.shopName ?? "Test Shop",
      phone: overrides.phone ?? "+251911000000",
      address: overrides.address ?? "Test Address, Addis Ababa",
      paymentAccountName: overrides.paymentAccountName ?? null,
      telebirrNumber: overrides.telebirrNumber ?? null,
      cbeBirrNumber: overrides.cbeBirrNumber ?? null,
      cbeBankAccountNumber: overrides.cbeBankAccountNumber ?? null,
      awashBankAccountNumber: overrides.awashBankAccountNumber ?? null,
      dashenBankAccountNumber: overrides.dashenBankAccountNumber ?? null,
      eBirrNumber: overrides.eBirrNumber ?? null,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  async findByUserId(userId: string): Promise<SellerProfileEntity | null> {
    return this.profiles.get(userId) ?? null;
  }

  async upsert(
    userId: string,
    input: UpsertSellerProfileInput,
  ): Promise<SellerProfileEntity> {
    const existing = this.profiles.get(userId);
    const now = new Date();
    const profile: SellerProfileEntity = {
      id: existing?.id ?? randomUUID(),
      userId,
      shopName: input.shopName.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      paymentAccountName: trimOrNull(input.paymentAccountName),
      telebirrNumber: trimOrNull(input.telebirrNumber),
      cbeBirrNumber: trimOrNull(input.cbeBirrNumber),
      cbeBankAccountNumber: trimOrNull(input.cbeBankAccountNumber),
      awashBankAccountNumber: trimOrNull(input.awashBankAccountNumber),
      dashenBankAccountNumber: trimOrNull(input.dashenBankAccountNumber),
      eBirrNumber: trimOrNull(input.eBirrNumber),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  async patch(
    userId: string,
    input: PatchSellerProfileInput,
  ): Promise<SellerProfileEntity | null> {
    const existing = this.profiles.get(userId);
    if (!existing) return null;

    if (input.shopName !== undefined) existing.shopName = input.shopName.trim();
    if (input.phone !== undefined) existing.phone = input.phone.trim();
    if (input.address !== undefined) existing.address = input.address.trim();
    if (input.paymentAccountName !== undefined) existing.paymentAccountName = trimOrNull(input.paymentAccountName);
    if (input.telebirrNumber !== undefined) existing.telebirrNumber = trimOrNull(input.telebirrNumber);
    if (input.cbeBirrNumber !== undefined) existing.cbeBirrNumber = trimOrNull(input.cbeBirrNumber);
    if (input.cbeBankAccountNumber !== undefined) existing.cbeBankAccountNumber = trimOrNull(input.cbeBankAccountNumber);
    if (input.awashBankAccountNumber !== undefined) existing.awashBankAccountNumber = trimOrNull(input.awashBankAccountNumber);
    if (input.dashenBankAccountNumber !== undefined) existing.dashenBankAccountNumber = trimOrNull(input.dashenBankAccountNumber);
    if (input.eBirrNumber !== undefined) existing.eBirrNumber = trimOrNull(input.eBirrNumber);
    existing.updatedAt = new Date();

    return existing;
  }
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
