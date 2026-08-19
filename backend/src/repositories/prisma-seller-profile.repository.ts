import type { PrismaClient } from "../prisma/generated/client.js";
import type {
  PatchSellerProfileInput,
  SellerProfileEntity,
  SellerProfileRepository,
  UpsertSellerProfileInput,
} from "./seller-profile.repository.js";

function mapProfile(row: {
  id: string;
  userId: string;
  shopName: string;
  phone: string;
  address: string;
  paymentAccountName: string | null;
  telebirrNumber: string | null;
  cbeBirrNumber: string | null;
  cbeBankAccountNumber: string | null;
  awashBankAccountNumber: string | null;
  dashenBankAccountNumber: string | null;
  eBirrNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SellerProfileEntity {
  return {
    id: row.id,
    userId: row.userId,
    shopName: row.shopName,
    phone: row.phone,
    address: row.address,
    paymentAccountName: row.paymentAccountName,
    telebirrNumber: row.telebirrNumber,
    cbeBirrNumber: row.cbeBirrNumber,
    cbeBankAccountNumber: row.cbeBankAccountNumber,
    awashBankAccountNumber: row.awashBankAccountNumber,
    dashenBankAccountNumber: row.dashenBankAccountNumber,
    eBirrNumber: row.eBirrNumber,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const profileSelect = {
  id: true,
  userId: true,
  shopName: true,
  phone: true,
  address: true,
  paymentAccountName: true,
  telebirrNumber: true,
  cbeBirrNumber: true,
  cbeBankAccountNumber: true,
  awashBankAccountNumber: true,
  dashenBankAccountNumber: true,
  eBirrNumber: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaSellerProfileRepository
  implements SellerProfileRepository
{
  constructor(private readonly client: PrismaClient) {}

  async findByUserId(userId: string): Promise<SellerProfileEntity | null> {
    const row = await this.client.sellerProfile.findUnique({
      where: { userId },
      select: profileSelect,
    });

    return row ? mapProfile(row) : null;
  }

  async upsert(
    userId: string,
    input: UpsertSellerProfileInput,
  ): Promise<SellerProfileEntity> {
    const data = {
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
    };

    const row = await this.client.sellerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: profileSelect,
    });

    return mapProfile(row);
  }

  async patch(
    userId: string,
    input: PatchSellerProfileInput,
  ): Promise<SellerProfileEntity | null> {
    const existing = await this.client.sellerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const row = await this.client.sellerProfile.update({
      where: { userId },
      data: {
        ...(input.shopName !== undefined
          ? { shopName: input.shopName.trim() }
          : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone.trim() }
          : {}),
        ...(input.address !== undefined
          ? { address: input.address.trim() }
          : {}),
        ...(input.paymentAccountName !== undefined
          ? { paymentAccountName: trimOrNull(input.paymentAccountName) }
          : {}),
        ...(input.telebirrNumber !== undefined
          ? { telebirrNumber: trimOrNull(input.telebirrNumber) }
          : {}),
        ...(input.cbeBirrNumber !== undefined
          ? { cbeBirrNumber: trimOrNull(input.cbeBirrNumber) }
          : {}),
        ...(input.cbeBankAccountNumber !== undefined
          ? {
              cbeBankAccountNumber: trimOrNull(input.cbeBankAccountNumber),
            }
          : {}),
        ...(input.awashBankAccountNumber !== undefined
          ? {
              awashBankAccountNumber: trimOrNull(
                input.awashBankAccountNumber,
              ),
            }
          : {}),
        ...(input.dashenBankAccountNumber !== undefined
          ? {
              dashenBankAccountNumber: trimOrNull(
                input.dashenBankAccountNumber,
              ),
            }
          : {}),
        ...(input.eBirrNumber !== undefined
          ? { eBirrNumber: trimOrNull(input.eBirrNumber) }
          : {}),
      },
      select: profileSelect,
    });

    return mapProfile(row);
  }
}

function trimOrNull(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
