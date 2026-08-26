import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Globe,
  Link2,
  LoaderCircle,
  Mail,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  useForm,
  type SubmitHandler,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import {
  addProfessionalCredential,
  createProfessionalProfile,
  deleteProfessionalCredential,
  deleteProfessionalProfile,
  getOwnProfessionalProfile,
  replaceProfessionalProfileSpecialties,
  updateProfessionalCredential,
  updateProfessionalProfile,
} from "@/features/professional-profile/api/professional-profile.api";
import type {
  CredentialType,
  ProfessionalCredential,
  ProfessionalProfile,
} from "@/features/professional-profile/api/professional-profile.api";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";
import { defaultFormOptions, zodResolver } from "@/shared/forms/form-config";

// ── Validation schemas ────────────────────────────────────────────────────────

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(200),
  headline: z.string().trim().max(300).optional(),
  bio: z.string().trim().max(2000).optional(),
  profession: z.string().trim().max(200).optional(),
  // Stored as a string in the input; converted to number in the submit handler
  yearsExperience: z.string().optional(),
  company: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(254).optional().refine(
    (v) => !v || z.string().email().safeParse(v).success,
    "Must be a valid email.",
  ),
  website: z.string().trim().max(500).optional().refine(
    (v) => !v || z.string().url().safeParse(v).success,
    "Must be a valid URL.",
  ),
  linkedinUrl: z.string().trim().max(500).optional().refine(
    (v) => !v || z.string().url().safeParse(v).success,
    "Must be a valid URL.",
  ),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const credentialSchema = z.object({
  type: z.enum(["EDUCATION", "CERTIFICATION", "TRAINING", "AWARD", "OTHER"]),
  title: z.string().trim().min(1, "Title is required.").max(300),
  institution: z.string().trim().max(300).optional(),
  // Stored as string; converted to number in submit handler
  yearObtained: z.string().optional(),
  description: z.string().trim().max(1000).optional(),
  credentialUrl: z.string().trim().max(500).optional().refine(
    (v) => !v || z.string().url().safeParse(v).success,
    "Must be a valid URL.",
  ),
});

type CredentialFormValues = z.infer<typeof credentialSchema>;

// ── Query key ─────────────────────────────────────────────────────────────────

const OWN_PROFILE_KEY = ["professional-profile", "me"] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export function MyProfessionalProfilePage() {
  // Route protection (authentication) is handled by RequireAuth in the router.
  return <ProfileContent isAuthenticated />;
}

function ProfileContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: OWN_PROFILE_KEY,
    queryFn: ({ signal }) => getOwnProfessionalProfile(signal),
    staleTime: 30_000,
    // Only fire when authentication is confirmed — prevents a premature 401
    // if this component is ever rendered while auth bootstrap is still in progress.
    enabled: isAuthenticated,
  });

  if (profileQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading your professional profile."
        icon={LoaderCircle}
        title="Loading profile"
      />
    );
  }
  if (profileQuery.isError) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void profileQuery.refetch(),
        }}
        description={getApiErrorMessage(
          profileQuery.error,
          "Could not load your professional profile.",
        )}
        icon={AlertTriangle}
        title="Profile unavailable"
      />
    );
  }

  const profile = profileQuery.data;
  const isNewProfile = profile === null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: OWN_PROFILE_KEY });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">Your account</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold text-zinc-950">
            Professional profile
          </h1>
          {profile ? (
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              to={`/professionals/${profile.id}`}
            >
              <Globe aria-hidden="true" className="size-4" />
              View public page
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {isNewProfile
            ? "Create a professional profile to showcase your expertise."
            : "Update your professional information and credentials."}
        </p>
      </div>

      {isNewProfile ? (
        <CreateProfileSection onCreated={invalidate} />
      ) : (
        <EditProfileSection profile={profile} onUpdated={invalidate} />
      )}
    </main>
  );
}

// ── Create profile ────────────────────────────────────────────────────────────

function CreateProfileSection({ onCreated }: { onCreated: () => void }) {
  const form = useForm<ProfileFormValues>({
    ...defaultFormOptions,
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      headline: "",
      bio: "",
      profession: "",
      company: "",
      city: "",
      region: "",
      country: "",
      phone: "",
      email: "",
      website: "",
      linkedinUrl: "",
      visibility: "PUBLIC",
    },
  });

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = form;

  const createMutation = useMutation({
    mutationFn: createProfessionalProfile,
    onSuccess: onCreated,
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Could not create your profile. Please try again.",
        ),
      });
    },
  });

  const onSubmit: SubmitHandler<ProfileFormValues> = (values) => {
    createMutation.mutate({
      displayName: values.displayName,
      headline: values.headline || null,
      bio: values.bio || null,
      profession: values.profession || null,
      yearsExperience: values.yearsExperience
        ? Number(values.yearsExperience)
        : null,
      company: values.company || null,
      city: values.city || null,
      region: values.region || null,
      country: values.country || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      linkedinUrl: values.linkedinUrl || null,
      visibility: values.visibility,
    });
  };

  return (
    <>
      <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          You don't have a professional profile yet. Fill in the form below to
          create one.
        </p>
      </div>
      <ProfileForm
        errors={errors}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit(onSubmit)}
        register={register}
        rootError={errors.root?.message}
        submitLabel="Create profile"
      />
    </>
  );
}

// ── Edit profile ──────────────────────────────────────────────────────────────

function EditProfileSection({
  onUpdated,
  profile,
}: {
  onUpdated: () => void;
  profile: ProfessionalProfile;
}) {
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<ProfileFormValues>({
    ...defaultFormOptions,
    resolver: zodResolver(profileSchema),
    defaultValues: profileToFormValues(profile),
  });

  const {
    formState: { errors, isSubmitting, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
  } = form;

  useEffect(() => {
    reset(profileToFormValues(profile));
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateProfessionalProfile(profile.id, {
        displayName: values.displayName,
        headline: values.headline || null,
        bio: values.bio || null,
        profession: values.profession || null,
        yearsExperience: values.yearsExperience
          ? Number(values.yearsExperience)
          : null,
        company: values.company || null,
        city: values.city || null,
        region: values.region || null,
        country: values.country || null,
        phone: values.phone || null,
        email: values.email || null,
        website: values.website || null,
        linkedinUrl: values.linkedinUrl || null,
        visibility: values.visibility,
      }),
    onSuccess: (updated) => {
      reset(profileToFormValues(updated));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      onUpdated();
    },
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Could not save your profile. Please try again.",
        ),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProfessionalProfile(profile.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OWN_PROFILE_KEY });
    },
  });

  const onSubmit: SubmitHandler<ProfileFormValues> = (values) => {
    setSaveSuccess(false);
    updateMutation.mutate(values);
  };

  return (
    <div className="space-y-10">
      {saveSuccess ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
          Professional profile saved successfully.
        </div>
      ) : null}

      <ProfileForm
        errors={errors}
        isDirty={isDirty}
        isSubmitting={isSubmitting || deleteMutation.isPending}
        onSubmit={handleSubmit(onSubmit)}
        register={register}
        rootError={errors.root?.message}
        submitLabel="Save changes"
      />

      <SpecialtiesSection
        key={profile.specialties.map((s) => s.name).join("\u0000")}
        onUpdated={onUpdated}
        profile={profile}
      />

      <CredentialsSection profile={profile} onUpdated={onUpdated} />

      {/* Danger zone */}
      <section
        aria-labelledby="danger-zone-heading"
        className="border-t border-zinc-200 pt-6"
      >
        <h2
          className="text-base font-semibold text-red-700"
          id="danger-zone-heading"
        >
          Delete profile
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Permanently delete your professional profile and all associated data.
          This cannot be undone.
        </p>
        {deleteMutation.isError ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {getApiErrorMessage(
              deleteMutation.error,
              "Could not delete your profile.",
            )}
          </div>
        ) : null}
        <button
          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Delete your professional profile? This cannot be undone.",
              )
            ) {
              deleteMutation.mutate();
            }
          }}
          type="button"
        >
          {deleteMutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-4" />
          )}
          Delete profile
        </button>
      </section>
    </div>
  );
}

// ── Specialties ───────────────────────────────────────────────────────────────

function SpecialtiesSection({
  onUpdated,
  profile,
}: {
  onUpdated: () => void;
  profile: ProfessionalProfile;
}) {
  const [names, setNames] = useState<string[]>(
    profile.specialties.map((s) => s.name),
  );
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      replaceProfessionalProfileSpecialties(profile.id, names),
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onUpdated();
    },
  });

  function addSpecialty() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.length > 150) {
      setInputError("Specialty name must be 150 characters or fewer.");
      return;
    }
    if (names.includes(trimmed)) {
      setInputError("That specialty is already in the list.");
      return;
    }
    if (names.length >= 50) {
      setInputError("You can have at most 50 specialties.");
      return;
    }
    setNames((prev) => [...prev, trimmed]);
    setInput("");
    setInputError(null);
  }

  return (
    <section
      aria-labelledby="specialties-heading"
      className="border-t border-zinc-200 pt-6"
    >
      <div className="flex items-center gap-2 pb-4">
        <Sparkles aria-hidden="true" className="size-4 text-emerald-700" />
        <h2
          className="text-base font-semibold text-zinc-950"
          id="specialties-heading"
        >
          Specialties
        </h2>
      </div>

      {names.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {names.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800"
            >
              {name}
              <button
                aria-label={`Remove ${name}`}
                className="text-zinc-500 hover:text-zinc-950"
                onClick={() =>
                  setNames((prev) => prev.filter((n) => n !== name))
                }
                type="button"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">No specialties added yet.</p>
      )}

      <div className="flex gap-2">
        <input
          className="min-h-10 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
          maxLength={150}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSpecialty();
            }
          }}
          placeholder="e.g. Foundation Design"
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInputError(null);
          }}
        />
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          disabled={!input.trim()}
          onClick={addSpecialty}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add
        </button>
      </div>

      {inputError ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {inputError}
        </p>
      ) : null}

      {saveSuccess ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
          Specialties saved.
        </div>
      ) : null}

      {saveMutation.isError ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {getApiErrorMessage(saveMutation.error, "Could not save specialties.")}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          type="button"
        >
          {saveMutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          Save specialties
        </button>
      </div>
    </section>
  );
}

// ── Credentials ───────────────────────────────────────────────────────────────

function CredentialsSection({
  onUpdated,
  profile,
}: {
  onUpdated: () => void;
  profile: ProfessionalProfile;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  return (
    <section
      aria-labelledby="credentials-heading"
      className="border-t border-zinc-200 pt-6"
    >
      <div className="flex items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-2">
          <BookOpen aria-hidden="true" className="size-4 text-emerald-700" />
          <h2
            className="text-base font-semibold text-zinc-950"
            id="credentials-heading"
          >
            Education &amp; credentials
          </h2>
        </div>
        {!isAdding ? (
          <button
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            onClick={() => setIsAdding(true)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <CredentialForm
          profileId={profile.id}
          onCancel={() => setIsAdding(false)}
          onSaved={() => {
            setIsAdding(false);
            onUpdated();
          }}
        />
      ) : null}

      {profile.credentials.length === 0 && !isAdding ? (
        <p className="text-sm text-zinc-500">No credentials added yet.</p>
      ) : null}

      <div className="mt-2 space-y-4">
        {profile.credentials.map((cred) =>
          editingId === cred.id ? (
            <CredentialForm
              key={cred.id}
              credential={cred}
              profileId={profile.id}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                onUpdated();
              }}
            />
          ) : (
            <CredentialCard
              key={cred.id}
              credential={cred}
              profileId={profile.id}
              onDelete={onUpdated}
              onEdit={() => setEditingId(cred.id)}
            />
          ),
        )}
      </div>
    </section>
  );
}

// ── Credential card ───────────────────────────────────────────────────────────

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  EDUCATION: "Education",
  CERTIFICATION: "Certification",
  TRAINING: "Training",
  AWARD: "Award",
  OTHER: "Other",
};

function CredentialCard({
  credential,
  onDelete,
  onEdit,
  profileId,
}: {
  credential: ProfessionalCredential;
  onDelete: () => void;
  onEdit: () => void;
  profileId: string;
}) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteProfessionalCredential(profileId, credential.id),
    onSuccess: onDelete,
  });

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
            onClick={onEdit}
            type="button"
          >
            Edit
          </button>
          <button
            aria-label={`Delete ${credential.title}`}
            className="text-zinc-500 hover:text-red-700 disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${credential.title}"?`)) {
                deleteMutation.mutate();
              }
            }}
            type="button"
          >
            {deleteMutation.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>
      {deleteMutation.isError ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {getApiErrorMessage(
            deleteMutation.error,
            "Could not delete credential.",
          )}
        </p>
      ) : null}
    </div>
  );
}

// ── Credential form ───────────────────────────────────────────────────────────

function CredentialForm({
  credential,
  onCancel,
  onSaved,
  profileId,
}: {
  credential?: ProfessionalCredential;
  onCancel: () => void;
  onSaved: () => void;
  profileId: string;
}) {
  const isEditing = Boolean(credential);

  const form = useForm<CredentialFormValues>({
    ...defaultFormOptions,
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      type: credential?.type ?? "EDUCATION",
      title: credential?.title ?? "",
      institution: credential?.institution ?? "",
      yearObtained: credential?.yearObtained != null ? String(credential.yearObtained) : "",
      description: credential?.description ?? "",
      credentialUrl: credential?.credentialUrl ?? "",
    },
  });

  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = form;

  // Separate mutations for add vs update so return types align
  const addMutation = useMutation({
    mutationFn: (values: CredentialFormValues) =>
      addProfessionalCredential(profileId, {
        type: values.type,
        title: values.title,
        institution: values.institution || null,
        yearObtained: values.yearObtained ? Number(values.yearObtained) : null,
        description: values.description || null,
        credentialUrl: values.credentialUrl || null,
      }),
    onSuccess: onSaved,
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(error, "Could not add credential."),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: CredentialFormValues) =>
      updateProfessionalCredential(profileId, credential!.id, {
        type: values.type,
        title: values.title,
        institution: values.institution || null,
        yearObtained: values.yearObtained ? Number(values.yearObtained) : null,
        description: values.description || null,
        credentialUrl: values.credentialUrl || null,
      }),
    onSuccess: onSaved,
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(error, "Could not update credential."),
      });
    },
  });

  const onSubmit: SubmitHandler<CredentialFormValues> = (values) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      addMutation.mutate(values);
    }
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="mb-4 text-sm font-semibold text-zinc-950">
        {isEditing ? "Edit credential" : "Add credential"}
      </h3>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cred-type" label="Type" required error={errors.type?.message}>
            <select
              className={inputClass(Boolean(errors.type))}
              disabled={isSaving}
              id="cred-type"
              {...register("type")}
            >
              <option value="EDUCATION">Education</option>
              <option value="CERTIFICATION">Certification</option>
              <option value="TRAINING">Training</option>
              <option value="AWARD">Award</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>

          <Field
            id="cred-year"
            label="Year obtained"
            error={errors.yearObtained?.message}
          >
            <input
              className={inputClass(Boolean(errors.yearObtained))}
              disabled={isSaving}
              id="cred-year"
              max={new Date().getFullYear()}
              min={1900}
              placeholder={String(new Date().getFullYear())}
              type="number"
              {...register("yearObtained")}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              id="cred-title"
              label="Title"
              required
              error={errors.title?.message}
            >
              <input
                className={inputClass(Boolean(errors.title))}
                disabled={isSaving}
                id="cred-title"
                maxLength={300}
                placeholder="e.g. BSc Civil Engineering"
                {...register("title")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="cred-institution"
              label="Institution"
              error={errors.institution?.message}
            >
              <input
                className={inputClass(Boolean(errors.institution))}
                disabled={isSaving}
                id="cred-institution"
                maxLength={300}
                placeholder="e.g. Addis Ababa University"
                {...register("institution")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="cred-desc"
              label="Description"
              error={errors.description?.message}
            >
              <textarea
                className={inputClass(Boolean(errors.description)) + " resize-none"}
                disabled={isSaving}
                id="cred-desc"
                maxLength={1000}
                rows={2}
                {...register("description")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="cred-url"
              label="Credential URL"
              error={errors.credentialUrl?.message}
            >
              <input
                className={inputClass(Boolean(errors.credentialUrl))}
                disabled={isSaving}
                id="cred-url"
                maxLength={500}
                placeholder="https://..."
                type="url"
                {...register("credentialUrl")}
              />
            </Field>
          </div>
        </div>

        {errors.root?.message ? (
          <div
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {errors.root.message}
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {isEditing ? "Save changes" : "Add credential"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared profile form ───────────────────────────────────────────────────────

function ProfileForm({
  errors,
  isDirty,
  isSubmitting,
  onSubmit,
  register,
  rootError,
  submitLabel,
}: {
  errors: FieldErrors<ProfileFormValues>;
  isDirty?: boolean;
  isSubmitting: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  register: UseFormRegister<ProfileFormValues>;
  rootError?: string;
  submitLabel: string;
}) {
  return (
    <form className="mt-6 space-y-8" noValidate onSubmit={onSubmit}>
      {/* Identity */}
      <section aria-labelledby="identity-heading">
        <div className="flex items-center gap-2 pb-4">
          <User aria-hidden="true" className="size-4 text-emerald-700" />
          <h2
            className="text-base font-semibold text-zinc-950"
            id="identity-heading"
          >
            Identity
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              id="displayName"
              label="Display name"
              required
              error={errors.displayName?.message}
            >
              <input
                className={inputClass(Boolean(errors.displayName))}
                disabled={isSubmitting}
                id="displayName"
                maxLength={200}
                placeholder="Your professional name"
                {...register("displayName")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="headline" label="Headline" error={errors.headline?.message}>
              <input
                className={inputClass(Boolean(errors.headline))}
                disabled={isSubmitting}
                id="headline"
                maxLength={300}
                placeholder="e.g. Senior Structural Engineer"
                {...register("headline")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="bio" label="Bio / about" error={errors.bio?.message}>
              <textarea
                className={inputClass(Boolean(errors.bio)) + " resize-none"}
                disabled={isSubmitting}
                id="bio"
                maxLength={2000}
                placeholder="A short description of your professional background"
                rows={4}
                {...register("bio")}
              />
            </Field>
          </div>

          <Field
            id="visibility"
            label="Profile visibility"
            required
            error={errors.visibility?.message}
          >
            <select
              className={inputClass(Boolean(errors.visibility))}
              disabled={isSubmitting}
              id="visibility"
              {...register("visibility")}
            >
              <option value="PUBLIC">Public — visible to everyone</option>
              <option value="PRIVATE">Private — visible only to you</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Professional info */}
      <section aria-labelledby="professional-info-heading">
        <div className="flex items-center gap-2 border-t border-zinc-200 pb-4 pt-6">
          <Briefcase aria-hidden="true" className="size-4 text-emerald-700" />
          <h2
            className="text-base font-semibold text-zinc-950"
            id="professional-info-heading"
          >
            Professional information
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="profession"
            label="Profession / title"
            error={errors.profession?.message}
          >
            <input
              className={inputClass(Boolean(errors.profession))}
              disabled={isSubmitting}
              id="profession"
              maxLength={200}
              placeholder="e.g. Structural Engineer"
              {...register("profession")}
            />
          </Field>

          <Field
            id="yearsExperience"
            label="Years of experience"
            error={errors.yearsExperience?.message}
          >
            <input
              className={inputClass(Boolean(errors.yearsExperience))}
              disabled={isSubmitting}
              id="yearsExperience"
              min={0}
              max={80}
              placeholder="e.g. 10"
              type="number"
              {...register("yearsExperience")}
            />
          </Field>

          <Field id="company" label="Company / organization" error={errors.company?.message}>
            <input
              className={inputClass(Boolean(errors.company))}
              disabled={isSubmitting}
              id="company"
              maxLength={200}
              placeholder="e.g. Addis Construction PLC"
              {...register("company")}
            />
          </Field>
        </div>
      </section>

      {/* Location */}
      <section aria-labelledby="location-heading">
        <div className="flex items-center gap-2 border-t border-zinc-200 pb-4 pt-6">
          <MapPin aria-hidden="true" className="size-4 text-emerald-700" />
          <h2
            className="text-base font-semibold text-zinc-950"
            id="location-heading"
          >
            Location
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="city" label="City" error={errors.city?.message}>
            <input
              className={inputClass(Boolean(errors.city))}
              disabled={isSubmitting}
              id="city"
              maxLength={100}
              placeholder="e.g. Addis Ababa"
              {...register("city")}
            />
          </Field>
          <Field id="region" label="Region" error={errors.region?.message}>
            <input
              className={inputClass(Boolean(errors.region))}
              disabled={isSubmitting}
              id="region"
              maxLength={100}
              {...register("region")}
            />
          </Field>
          <Field id="country" label="Country" error={errors.country?.message}>
            <input
              className={inputClass(Boolean(errors.country))}
              disabled={isSubmitting}
              id="country"
              maxLength={100}
              placeholder="e.g. Ethiopia"
              {...register("country")}
            />
          </Field>
        </div>
      </section>

      {/* Contact & links */}
      <section aria-labelledby="contact-heading">
        <div className="flex items-center gap-2 border-t border-zinc-200 pb-4 pt-6">
          <Mail aria-hidden="true" className="size-4 text-emerald-700" />
          <h2
            className="text-base font-semibold text-zinc-950"
            id="contact-heading"
          >
            Contact &amp; links
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="email"
            label="Public email"
            error={errors.email?.message}
            hint="Shown on your public profile"
          >
            <input
              className={inputClass(Boolean(errors.email))}
              disabled={isSubmitting}
              id="email"
              maxLength={254}
              placeholder="contact@example.com"
              type="email"
              {...register("email")}
            />
          </Field>

          <Field id="phone" label="Phone" error={errors.phone?.message}>
            <input
              className={inputClass(Boolean(errors.phone))}
              disabled={isSubmitting}
              id="phone"
              maxLength={30}
              placeholder="+251 91 123 4567"
              type="tel"
              {...register("phone")}
            />
          </Field>

          <Field id="website" label="Website" error={errors.website?.message}>
            <input
              className={inputClass(Boolean(errors.website))}
              disabled={isSubmitting}
              id="website"
              maxLength={500}
              placeholder="https://yourwebsite.com"
              type="url"
              {...register("website")}
            />
          </Field>

          <Field id="linkedinUrl" label="LinkedIn" error={errors.linkedinUrl?.message}>
            <input
              className={inputClass(Boolean(errors.linkedinUrl))}
              disabled={isSubmitting}
              id="linkedinUrl"
              maxLength={500}
              placeholder="https://linkedin.com/in/yourname"
              type="url"
              {...register("linkedinUrl")}
            />
          </Field>
        </div>
      </section>

      {rootError ? (
        <div
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {rootError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6">
        {isDirty && !isSubmitting ? (
          <p className="text-sm text-zinc-500">You have unsaved changes.</p>
        ) : null}
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function profileToFormValues(p: ProfessionalProfile): ProfileFormValues {
  return {
    displayName: p.displayName,
    headline: p.headline ?? "",
    bio: p.bio ?? "",
    profession: p.profession ?? "",
    yearsExperience: p.yearsExperience != null ? String(p.yearsExperience) : "",
    company: p.company ?? "",
    city: p.city ?? "",
    region: p.region ?? "",
    country: p.country ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    website: p.website ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    visibility: p.visibility,
  };
}

function Field({
  children,
  error,
  hint,
  id,
  label,
  required,
}: {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-800" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        ) : null}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "min-h-11 w-full rounded-md border px-3 py-2 text-sm outline-none",
    "focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60",
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-emerald-700",
  ].join(" ");
}
