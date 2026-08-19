export interface SellerProfileEntity {
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
}

export interface UpsertSellerProfileInput {
  shopName: string;
  phone: string;
  address: string;
  paymentAccountName?: string | null;
  telebirrNumber?: string | null;
  cbeBirrNumber?: string | null;
  cbeBankAccountNumber?: string | null;
  awashBankAccountNumber?: string | null;
  dashenBankAccountNumber?: string | null;
  eBirrNumber?: string | null;
}

export interface PatchSellerProfileInput {
  shopName?: string;
  phone?: string;
  address?: string;
  paymentAccountName?: string | null;
  telebirrNumber?: string | null;
  cbeBirrNumber?: string | null;
  cbeBankAccountNumber?: string | null;
  awashBankAccountNumber?: string | null;
  dashenBankAccountNumber?: string | null;
  eBirrNumber?: string | null;
}

export interface SellerProfileRepository {
  findByUserId(userId: string): Promise<SellerProfileEntity | null>;
  upsert(
    userId: string,
    input: UpsertSellerProfileInput,
  ): Promise<SellerProfileEntity>;
  patch(
    userId: string,
    input: PatchSellerProfileInput,
  ): Promise<SellerProfileEntity | null>;
}
