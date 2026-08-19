import type { AuthenticatedUser } from "../types/auth.js";
import type {
  SellerProfileEntity,
  SellerProfileRepository,
} from "../repositories/seller-profile.repository.js";
import { ForbiddenError, NotFoundError } from "../utils/api-error.js";
import type {
  PatchSellerProfileBody,
  UpsertSellerProfileBody,
} from "../validators/seller-profile.validators.js";

export class SellerProfileService {
  constructor(private readonly profiles: SellerProfileRepository) {}

  async get(actor: AuthenticatedUser): Promise<SellerProfileEntity | null> {
    this.requireSeller(actor);
    return this.profiles.findByUserId(actor.userId);
  }

  async upsert(
    actor: AuthenticatedUser,
    input: UpsertSellerProfileBody,
  ): Promise<SellerProfileEntity> {
    this.requireSeller(actor);

    return this.profiles.upsert(actor.userId, {
      shopName: input.shopName,
      phone: input.phone,
      address: input.address,
      paymentAccountName: input.paymentAccountName ?? null,
      telebirrNumber: input.telebirrNumber ?? null,
      cbeBirrNumber: input.cbeBirrNumber ?? null,
      cbeBankAccountNumber: input.cbeBankAccountNumber ?? null,
      awashBankAccountNumber: input.awashBankAccountNumber ?? null,
      dashenBankAccountNumber: input.dashenBankAccountNumber ?? null,
      eBirrNumber: input.eBirrNumber ?? null,
    });
  }

  async patch(
    actor: AuthenticatedUser,
    input: PatchSellerProfileBody,
  ): Promise<SellerProfileEntity> {
    this.requireSeller(actor);

    const updated = await this.profiles.patch(actor.userId, {
      ...(input.shopName !== undefined ? { shopName: input.shopName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.paymentAccountName !== undefined
        ? { paymentAccountName: input.paymentAccountName ?? null }
        : {}),
      ...(input.telebirrNumber !== undefined
        ? { telebirrNumber: input.telebirrNumber ?? null }
        : {}),
      ...(input.cbeBirrNumber !== undefined
        ? { cbeBirrNumber: input.cbeBirrNumber ?? null }
        : {}),
      ...(input.cbeBankAccountNumber !== undefined
        ? { cbeBankAccountNumber: input.cbeBankAccountNumber ?? null }
        : {}),
      ...(input.awashBankAccountNumber !== undefined
        ? { awashBankAccountNumber: input.awashBankAccountNumber ?? null }
        : {}),
      ...(input.dashenBankAccountNumber !== undefined
        ? { dashenBankAccountNumber: input.dashenBankAccountNumber ?? null }
        : {}),
      ...(input.eBirrNumber !== undefined
        ? { eBirrNumber: input.eBirrNumber ?? null }
        : {}),
    });

    if (!updated) {
      throw new NotFoundError(
        "Store profile not found. Use PUT /api/seller/profile to create it first.",
      );
    }

    return updated;
  }

  private requireSeller(actor: AuthenticatedUser): void {
    if (actor.role !== "SELLER") {
      throw new ForbiddenError("Seller access is required.");
    }
  }
}
