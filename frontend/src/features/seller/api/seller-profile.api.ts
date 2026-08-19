import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

export interface SellerProfile {
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
  createdAt: string;
  updatedAt: string;
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

interface ProfileData {
  profile: SellerProfile | null;
}

export async function getSellerProfile(
  signal?: AbortSignal,
): Promise<SellerProfile | null> {
  const response = await apiClient.get<ApiSuccessResponse<ProfileData>>(
    "/seller/profile",
    { signal },
  );
  return response.data.data.profile;
}

export async function upsertSellerProfile(
  input: UpsertSellerProfileInput,
): Promise<SellerProfile> {
  const response = await apiClient.put<
    ApiSuccessResponse<{ profile: SellerProfile }>
  >("/seller/profile", input);
  return response.data.data.profile;
}
