import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

// ── Entity types ──────────────────────────────────────────────────────────────

export type ProfileVisibility = "PUBLIC" | "PRIVATE";

export type CredentialType =
  | "EDUCATION"
  | "CERTIFICATION"
  | "TRAINING"
  | "AWARD"
  | "OTHER";

export interface ProfessionalSpecialty {
  id: string;
  profileId: string;
  name: string;
  createdAt: string;
}

export interface ProfessionalCredential {
  id: string;
  profileId: string;
  type: CredentialType;
  title: string;
  institution: string | null;
  yearObtained: number | null;
  description: string | null;
  credentialUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalProfile {
  id: string;
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  profession: string | null;
  yearsExperience: number | null;
  company: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedinUrl: string | null;
  visibility: ProfileVisibility;
  specialties: ProfessionalSpecialty[];
  credentials: ProfessionalCredential[];
  createdAt: string;
  updatedAt: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateProfileInput {
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  profession?: string | null;
  yearsExperience?: number | null;
  company?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  visibility?: ProfileVisibility;
}

export type UpdateProfileInput = Partial<CreateProfileInput>;

export interface CreateCredentialInput {
  type?: CredentialType;
  title: string;
  institution?: string | null;
  yearObtained?: number | null;
  description?: string | null;
  credentialUrl?: string | null;
}

export type UpdateCredentialInput = Partial<CreateCredentialInput>;

// ── API calls ─────────────────────────────────────────────────────────────────

type ProfileData = { profile: ProfessionalProfile | null };
type ProfileResult = { profile: ProfessionalProfile };

export async function getOwnProfessionalProfile(
  signal?: AbortSignal,
): Promise<ProfessionalProfile | null> {
  const res = await apiClient.get<ApiSuccessResponse<ProfileData>>(
    "/professional-profiles/me",
    { signal },
  );
  return res.data.data.profile;
}

export async function getProfessionalProfileById(
  profileId: string,
  signal?: AbortSignal,
): Promise<ProfessionalProfile> {
  const res = await apiClient.get<ApiSuccessResponse<ProfileResult>>(
    `/professional-profiles/${encodeURIComponent(profileId)}`,
    { signal },
  );
  return res.data.data.profile;
}

export async function createProfessionalProfile(
  input: CreateProfileInput,
): Promise<ProfessionalProfile> {
  const res = await apiClient.post<ApiSuccessResponse<ProfileResult>>(
    "/professional-profiles",
    input,
  );
  return res.data.data.profile;
}

export async function updateProfessionalProfile(
  profileId: string,
  input: UpdateProfileInput,
): Promise<ProfessionalProfile> {
  const res = await apiClient.patch<ApiSuccessResponse<ProfileResult>>(
    `/professional-profiles/${encodeURIComponent(profileId)}`,
    input,
  );
  return res.data.data.profile;
}

export async function deleteProfessionalProfile(
  profileId: string,
): Promise<void> {
  await apiClient.delete(
    `/professional-profiles/${encodeURIComponent(profileId)}`,
  );
}

export async function replaceProfessionalProfileSpecialties(
  profileId: string,
  names: string[],
): Promise<ProfessionalProfile> {
  const res = await apiClient.put<ApiSuccessResponse<ProfileResult>>(
    `/professional-profiles/${encodeURIComponent(profileId)}/specialties`,
    { names },
  );
  return res.data.data.profile;
}

export async function addProfessionalCredential(
  profileId: string,
  input: CreateCredentialInput,
): Promise<ProfessionalProfile> {
  const res = await apiClient.post<ApiSuccessResponse<ProfileResult>>(
    `/professional-profiles/${encodeURIComponent(profileId)}/credentials`,
    input,
  );
  return res.data.data.profile;
}

export async function updateProfessionalCredential(
  profileId: string,
  credentialId: string,
  input: UpdateCredentialInput,
): Promise<ProfessionalCredential> {
  const res = await apiClient.patch<
    ApiSuccessResponse<{ credential: ProfessionalCredential }>
  >(
    `/professional-profiles/${encodeURIComponent(profileId)}/credentials/${encodeURIComponent(credentialId)}`,
    input,
  );
  return res.data.data.credential;
}

export async function deleteProfessionalCredential(
  profileId: string,
  credentialId: string,
): Promise<void> {
  await apiClient.delete(
    `/professional-profiles/${encodeURIComponent(profileId)}/credentials/${encodeURIComponent(credentialId)}`,
  );
}
