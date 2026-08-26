import {
  AlertTriangle,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Globe,
  Link2,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  getProfessionalProfileById,
} from "@/features/professional-profile/api/professional-profile.api";
import { ProfessionalAvatar } from "@/features/professional-profile/components/ProfessionalAvatar";
import type {
  CredentialType,
  ProfessionalCredential,
  ProfessionalSpecialty,
} from "@/features/professional-profile/api/professional-profile.api";
import { getApiErrorMessage, getHttpStatus } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

// ── Credential type labels ────────────────────────────────────────────────────

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  EDUCATION: "Education",
  CERTIFICATION: "Certification",
  TRAINING: "Training",
  AWARD: "Award",
  OTHER: "Other",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProfessionalProfilePage() {
  const { profileId } = useParams<{ profileId: string }>();
  const user = useAuthStore((state) => state.user);

  const profileQuery = useQuery({
    queryKey: ["professional-profile", "public", profileId],
    enabled: Boolean(profileId),
    queryFn: ({ signal }) => {
      if (!profileId) throw new Error("A profile ID is required.");
      return getProfessionalProfileById(profileId, signal);
    },
    retry: false,
  });

  if (!profileId) {
    return (
      <FullPageStatus
        description="No profile ID was provided."
        icon={AlertTriangle}
        title="Profile not found"
      />
    );
  }

  if (profileQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading professional profile."
        icon={LoaderCircle}
        title="Loading profile"
      />
    );
  }

  if (profileQuery.isError) {
    const status = getHttpStatus(profileQuery.error);

    if (status === 404) {
      return (
        <FullPageStatus
          description="This professional profile does not exist or has been removed."
          icon={User}
          title="Profile not found"
        />
      );
    }

    if (status === 403) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-12">
          <section className="w-full max-w-md text-center" aria-live="polite">
            <span className="mx-auto flex size-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm">
              <Lock aria-hidden="true" className="size-6" strokeWidth={1.8} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold text-zinc-950">
              Private profile
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              This professional profile is private and can only be viewed by its
              owner.
            </p>
            <Link
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              to="/professionals"
            >
              Back to all professionals
            </Link>
          </section>
        </main>
      );
    }

    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void profileQuery.refetch(),
        }}
        description={getApiErrorMessage(
          profileQuery.error,
          "This professional profile could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Profile unavailable"
      />
    );
  }

  const profile = profileQuery.data;
  const isOwner = Boolean(user && user.id === profile.userId);

  return (
    <main>
      {/* Header */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {/* Back link */}
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            to="/professionals"
          >
            ← All Professionals
          </Link>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Avatar + identity */}
            <div className="flex items-start gap-5">
              <span className="block size-16 shrink-0 overflow-hidden rounded-full">
                <ProfessionalAvatar
                  initialsClassName="text-xl"
                  name={profile.displayName}
                  src={profile.avatarUrl}
                />
              </span>
              <div className="min-w-0">
                {profile.visibility === "PRIVATE" && isOwner ? (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    <Lock aria-hidden="true" className="size-3" />
                    Private — only visible to you
                  </span>
                ) : null}
                <h1 className="text-3xl font-semibold text-zinc-950">
                  {profile.displayName}
                </h1>
                {profile.headline ? (
                  <p className="mt-1 text-base text-zinc-600">
                    {profile.headline}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
                  {profile.profession ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase aria-hidden="true" className="size-4" />
                      {profile.profession}
                      {profile.yearsExperience
                        ? ` · ${profile.yearsExperience} yrs`
                        : ""}
                    </span>
                  ) : null}
                  {profile.company ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 aria-hidden="true" className="size-4" />
                      {profile.company}
                    </span>
                  ) : null}
                  {profile.city || profile.country ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="size-4" />
                      {[profile.city, profile.region, profile.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden="true" className="size-4" />
                    Member since{" "}
                    {new Date(profile.createdAt).getFullYear()}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact links + edit */}
            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              {profile.email ? (
                <a
                  className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-950"
                  href={`mailto:${profile.email}`}
                >
                  <Mail aria-hidden="true" className="size-4" />
                  {profile.email}
                </a>
              ) : null}
              {profile.phone ? (
                <a
                  className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-950"
                  href={`tel:${profile.phone}`}
                >
                  <Phone aria-hidden="true" className="size-4" />
                  {profile.phone}
                </a>
              ) : null}
              {profile.website ? (
                <a
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  href={profile.website}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Globe aria-hidden="true" className="size-4" />
                  Website
                </a>
              ) : null}
              {profile.linkedinUrl ? (
                <a
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  href={profile.linkedinUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Link2 aria-hidden="true" className="size-4" />
                  LinkedIn
                </a>
              ) : null}
              {isOwner ? (
                <Link
                  className="mt-2 inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  to="/profile/professional"
                >
                  Edit profile
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main column */}
          <div className="space-y-8">
            {/* Bio */}
            {profile.bio ? (
              <section aria-labelledby="bio-heading">
                <h2
                  className="flex items-center gap-2 text-lg font-semibold text-zinc-950"
                  id="bio-heading"
                >
                  <User aria-hidden="true" className="size-5 text-emerald-700" />
                  About
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                  {profile.bio}
                </p>
              </section>
            ) : null}

            {/* Credentials */}
            {profile.credentials.length > 0 ? (
              <section aria-labelledby="credentials-heading">
                <h2
                  className="flex items-center gap-2 text-lg font-semibold text-zinc-950"
                  id="credentials-heading"
                >
                  <BookOpen
                    aria-hidden="true"
                    className="size-5 text-emerald-700"
                  />
                  Education &amp; credentials
                </h2>
                <div className="mt-4 space-y-4">
                  {profile.credentials.map((cred) => (
                    <CredentialItem key={cred.id} credential={cred} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Specialties */}
            {profile.specialties.length > 0 ? (
              <section aria-labelledby="specialties-heading">
                <h2
                  className="flex items-center gap-2 text-base font-semibold text-zinc-950"
                  id="specialties-heading"
                >
                  <Sparkles
                    aria-hidden="true"
                    className="size-4 text-emerald-700"
                  />
                  Specialties
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.specialties.map((s) => (
                    <SpecialtyBadge key={s.id} specialty={s} />
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CredentialItem({ credential }: { credential: ProfessionalCredential }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
        <Award aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {CREDENTIAL_TYPE_LABELS[credential.type]}
          </span>
          {credential.yearObtained ? (
            <span className="text-xs text-zinc-500">
              {credential.yearObtained}
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-semibold text-zinc-950">{credential.title}</p>
        {credential.institution ? (
          <p className="text-sm text-zinc-600">{credential.institution}</p>
        ) : null}
        {credential.description ? (
          <p className="mt-1 text-sm text-zinc-500">{credential.description}</p>
        ) : null}
        {credential.credentialUrl ? (
          <a
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            href={credential.credentialUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Link2 aria-hidden="true" className="size-3" />
            View credential
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SpecialtyBadge({ specialty }: { specialty: ProfessionalSpecialty }) {
  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
      {specialty.name}
    </span>
  );
}
