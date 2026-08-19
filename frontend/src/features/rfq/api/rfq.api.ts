import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";
import type {
  CreateQuoteInput,
  CreateRfqInput,
  RequestForQuote,
  RfqListResult,
  SupplierQuote,
  UpdateQuoteInput,
} from "@/features/rfq/model/rfq";

// ── Types returned by accept ──────────────────────────────────────────────────

export interface AcceptQuoteResult {
  rfq: RequestForQuote;
  order: { id: string; status: string; totalAmount: string };
}

// ── Buyer RFQ endpoints ───────────────────────────────────────────────────────

export async function createRfq(
  input: CreateRfqInput,
): Promise<RequestForQuote> {
  const res = await apiClient.post<ApiSuccessResponse<{ rfq: RequestForQuote }>>(
    "/rfqs",
    input,
  );
  return res.data.data.rfq;
}

export async function getMyRfqs(
  params: {
    page?: number;
    limit?: number;
    status?: string;
    categoryId?: string;
  },
  signal?: AbortSignal,
): Promise<RfqListResult> {
  const res = await apiClient.get<ApiSuccessResponse<RfqListResult>>(
    "/rfqs/me",
    { params, signal },
  );
  return res.data.data;
}

export async function getRfq(
  id: string,
  signal?: AbortSignal,
): Promise<RequestForQuote> {
  const res = await apiClient.get<ApiSuccessResponse<{ rfq: RequestForQuote }>>(
    `/rfqs/${encodeURIComponent(id)}`,
    { signal },
  );
  return res.data.data.rfq;
}

export async function updateRfq(
  id: string,
  input: CreateRfqInput,
): Promise<RequestForQuote> {
  const res = await apiClient.put<ApiSuccessResponse<{ rfq: RequestForQuote }>>(
    `/rfqs/${encodeURIComponent(id)}`,
    input,
  );
  return res.data.data.rfq;
}

export async function cancelRfq(id: string): Promise<RequestForQuote> {
  const res = await apiClient.patch<ApiSuccessResponse<{ rfq: RequestForQuote }>>(
    `/rfqs/${encodeURIComponent(id)}/cancel`,
    {},
  );
  return res.data.data.rfq;
}

export async function rejectQuote(id: string): Promise<SupplierQuote> {
  const res = await apiClient.post<ApiSuccessResponse<{ quote: SupplierQuote }>>(
    `/quotes/${encodeURIComponent(id)}/reject`,
    {},
  );
  return res.data.data.quote;
}

export async function acceptQuote(id: string): Promise<AcceptQuoteResult> {
  const res = await apiClient.post<ApiSuccessResponse<AcceptQuoteResult>>(
    `/quotes/${encodeURIComponent(id)}/accept`,
    {},
  );
  return res.data.data;
}

// ── Seller RFQ/quotation endpoints ────────────────────────────────────────────

export async function getSellerRfqs(
  params: {
    page?: number;
    limit?: number;
    status?: string;
    categoryId?: string;
    view?: "available" | "participating";
  },
  signal?: AbortSignal,
): Promise<RfqListResult> {
  const res = await apiClient.get<ApiSuccessResponse<RfqListResult>>(
    "/seller/rfqs",
    { params, signal },
  );
  return res.data.data;
}

export async function createQuote(
  rfqId: string,
  input: CreateQuoteInput,
): Promise<SupplierQuote> {
  const res = await apiClient.post<ApiSuccessResponse<{ quote: SupplierQuote }>>(
    `/rfqs/${encodeURIComponent(rfqId)}/quotes`,
    input,
  );
  return res.data.data.quote;
}

export async function updateQuote(
  quoteId: string,
  input: UpdateQuoteInput,
): Promise<SupplierQuote> {
  const res = await apiClient.put<ApiSuccessResponse<{ quote: SupplierQuote }>>(
    `/quotes/${encodeURIComponent(quoteId)}`,
    input,
  );
  return res.data.data.quote;
}

export async function withdrawQuote(quoteId: string): Promise<SupplierQuote> {
  const res = await apiClient.patch<ApiSuccessResponse<{ quote: SupplierQuote }>>(
    `/quotes/${encodeURIComponent(quoteId)}/withdraw`,
    {},
  );
  return res.data.data.quote;
}
