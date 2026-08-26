import {
  AlertTriangle,
  CalendarDays,
  Images,
  ImageOff,
  Link2,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";

import {
  addProfessionalPortfolioItem,
  deleteProfessionalPortfolioItem,
  listProfessionalPortfolio,
  updateProfessionalPortfolioItem,
  type CreatePortfolioItemInput,
  type PortfolioItem,
  type ProfessionalProfile,
} from "@/features/professional-profile/api/professional-profile.api";
import { getApiErrorMessage } from "@/shared/api/http-error";
import {
  defaultFormOptions,
  zodResolver,
} from "@/shared/forms/form-config";

// ── Validation ────────────────────────────────────────────────────────────────

const portfolioItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  projectType: z.string().trim().max(150).optional(),
  location: z.string().trim().max(200).optional(),
  // Date inputs supply YYYY-MM-DD strings; sent to the API as-is.
  completionDate: z
    .string()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Must be a valid date.",
    )
    .optional(),
  // Stored as a string in the input; converted to a number in the submit handler.
  displayOrder: z
    .string()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) <= 1_000_000),
      "Must be a whole number of 0 or more.",
    )
    .optional(),
});

type PortfolioItemFormValues = z.infer<typeof portfolioItemSchema>;

const imageUrlSchema = z
  .string()
  .trim()
  .url("Each image must be a valid URL.")
  .max(500, "Each image URL must be 500 characters or fewer.");

// ── Query keys ────────────────────────────────────────────────────────────────

const OWN_PORTFOLIO_KEY = [
  "professional-profile",
  "me",
  "portfolio",
] as const;

function publicPortfolioKey(profileId: string) {
  return ["professional-profile", "public", profileId, "portfolio"] as const;
}

// ── Section ───────────────────────────────────────────────────────────────────

export function PortfolioManagerSection({
  profile,
}: {
  profile: ProfessionalProfile;
}) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const portfolioQuery = useQuery({
    queryKey: OWN_PORTFOLIO_KEY,
    queryFn: ({ signal }) => listProfessionalPortfolio(profile.id, signal),
    staleTime: 30_000,
    retry: false,
  });

  function invalidatePortfolio() {
    void queryClient.invalidateQueries({ queryKey: OWN_PORTFOLIO_KEY });
    void queryClient.invalidateQueries({
      queryKey: publicPortfolioKey(profile.id),
    });
  }

  const items = portfolioQuery.data ?? [];

  return (
    <section
      aria-labelledby="portfolio-heading"
      className="border-t border-zinc-200 pt-6"
    >
      <div className="flex items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-2">
          <Images aria-hidden="true" className="size-4 text-emerald-700" />
          <h2
            className="text-base font-semibold text-zinc-950"
            id="portfolio-heading"
          >
            Portfolio
          </h2>
        </div>
        {!isAdding && editingId === null ? (
          <button
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            onClick={() => setIsAdding(true)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add project
          </button>
        ) : null}
      </div>

      {portfolioQuery.isPending ? (
        <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading portfolio.
        </p>
      ) : null}

      {portfolioQuery.isError ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {getApiErrorMessage(
              portfolioQuery.error,
              "Could not load your portfolio.",
            )}
          </span>
          <button
            className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            onClick={() => void portfolioQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {isAdding ? (
        <div className="mt-2">
          <PortfolioItemForm
            onCancel={() => setIsAdding(false)}
            onSaved={() => {
              setIsAdding(false);
              invalidatePortfolio();
            }}
            profileId={profile.id}
          />
        </div>
      ) : null}

      {!isAdding && items.length === 0 && !portfolioQuery.isPending ? (
        <p className="text-sm text-zinc-500">
          No portfolio projects yet. Add completed work to showcase on your
          public profile.
        </p>
      ) : null}

      <div className="mt-2 space-y-4">
        {items.map((item) =>
          editingId === item.id ? (
            <PortfolioItemForm
              key={item.id}
              item={item}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                invalidatePortfolio();
              }}
              profileId={profile.id}
            />
          ) : (
            <PortfolioItemCard
              item={item}
              onDelete={() => invalidatePortfolio()}
              onEdit={() => setEditingId(item.id)}
              profileId={profile.id}
            />
          ),
        )}
      </div>
    </section>
  );
}

// ── Item card ────────────────────────────────────────────────────────────────

function PortfolioItemCard({
  item,
  onDelete,
  onEdit,
  profileId,
}: {
  item: PortfolioItem;
  onDelete: () => void;
  onEdit: () => void;
  profileId: string;
}) {
  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteProfessionalPortfolioItem(profileId, item.id),
    onSuccess: onDelete,
  });

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Position {item.displayOrder}
            </span>
            {item.projectType ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {item.projectType}
              </span>
            ) : null}
            {item.completionDate ? (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Completed {formatCompletionDate(item.completionDate)}
              </span>
            ) : null}
            {item.images.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Images aria-hidden="true" className="size-3.5" />
                {item.images.length}{" "}
                {item.images.length === 1 ? "photo" : "photos"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-semibold text-zinc-950">{item.title}</p>
          {item.location ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-zinc-500">
              <MapPin aria-hidden="true" className="size-3.5" />
              {item.location}
            </p>
          ) : null}
          {item.description ? (
            <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
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
            aria-label={`Delete ${item.title}`}
            className="text-zinc-500 hover:text-red-700 disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${item.title}"?`)) {
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
            "Could not delete portfolio project.",
          )}
        </p>
      ) : null}
    </div>
  );
}

// ── Item form ────────────────────────────────────────────────────────────────

function PortfolioItemForm({
  item,
  onCancel,
  onSaved,
  profileId,
}: {
  item?: PortfolioItem;
  onCancel: () => void;
  onSaved: () => void;
  profileId: string;
}) {
  const isEditing = Boolean(item);

  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [imageInput, setImageInput] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<PortfolioItemFormValues>({
    ...defaultFormOptions,
    resolver: zodResolver(portfolioItemSchema),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      projectType: item?.projectType ?? "",
      location: item?.location ?? "",
      completionDate: item?.completionDate
        ? item.completionDate.slice(0, 10)
        : "",
      displayOrder: item ? String(item.displayOrder) : "",
    },
  });

  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = form;

  function addImage() {
    const candidate = imageInput.trim();
    if (!candidate) {
      return;
    }

    const parsed = imageUrlSchema.safeParse(candidate);
    if (!parsed.success) {
      setImageError(parsed.error.issues[0]?.message ?? "Invalid image URL.");
      return;
    }
    if (images.includes(candidate)) {
      setImageError("That image URL is already in the list.");
      return;
    }
    if (images.length >= 8) {
      setImageError("A portfolio project may have at most 8 images.");
      return;
    }

    setImages((prev) => [...prev, candidate]);
    setImageInput("");
    setImageError(null);
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((existing) => existing !== url));
    setImageError(null);
  }

  const addMutation = useMutation({
    mutationFn: (input: CreatePortfolioItemInput) =>
      addProfessionalPortfolioItem(profileId, input),
    onSuccess: onSaved,
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Could not add the portfolio project.",
        ),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreatePortfolioItemInput) =>
      updateProfessionalPortfolioItem(profileId, item!.id, input),
    onSuccess: onSaved,
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Could not save the portfolio project.",
        ),
      });
    },
  });

  const onSubmit: SubmitHandler<PortfolioItemFormValues> = (values) => {
    if (images.length === 0 && imageInput.trim() !== "") {
      setImageError("Click “Add image” to include the URL you typed.");
      return;
    }

    const payload: CreatePortfolioItemInput = {
      title: values.title,
      description: values.description || null,
      projectType: values.projectType || null,
      location: values.location || null,
      completionDate: values.completionDate || null,
      images,
      displayOrder: values.displayOrder ? Number(values.displayOrder) : 0,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      addMutation.mutate(payload);
    }
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="mb-4 text-sm font-semibold text-zinc-950">
        {isEditing ? "Edit portfolio project" : "Add portfolio project"}
      </h3>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={errors.title?.message}
            id="pf-title"
            label="Project title"
            required
          >
            <input
              className={inputClass(Boolean(errors.title))}
              disabled={isSaving}
              id="pf-title"
              maxLength={200}
              placeholder="e.g. G+2 Residential Villa"
              {...register("title")}
            />
          </Field>

          <Field
            error={errors.projectType?.message}
            id="pf-type"
            label="Project type"
          >
            <input
              className={inputClass(Boolean(errors.projectType))}
              disabled={isSaving}
              id="pf-type"
              maxLength={150}
              placeholder="e.g. Residential"
              {...register("projectType")}
            />
          </Field>

          <Field
            error={errors.location?.message}
            id="pf-location"
            label="Location"
          >
            <input
              className={inputClass(Boolean(errors.location))}
              disabled={isSaving}
              id="pf-location"
              maxLength={200}
              placeholder="e.g. Addis Ababa"
              {...register("location")}
            />
          </Field>

          <Field
            error={errors.completionDate?.message}
            id="pf-date"
            label="Completion date"
          >
            <input
              className={inputClass(Boolean(errors.completionDate))}
              disabled={isSaving}
              id="pf-date"
              type="date"
              {...register("completionDate")}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              error={errors.description?.message}
              id="pf-description"
              label="Description"
            >
              <textarea
                className={inputClass(Boolean(errors.description)) + " resize-none"}
                disabled={isSaving}
                id="pf-description"
                maxLength={2000}
                placeholder="What was built, your role, materials, outcome…"
                rows={3}
                {...register("description")}
              />
            </Field>
          </div>

          <Field
            error={errors.displayOrder?.message}
            hint="Lower numbers are shown first on your public profile."
            id="pf-order"
            label="Display order"
          >
            <input
              className={inputClass(Boolean(errors.displayOrder))}
              disabled={isSaving}
              id="pf-order"
              min={0}
              placeholder="e.g. 0"
              type="number"
              {...register("displayOrder")}
            />
          </Field>
        </div>

        {/* Image URLs */}
        <div>
          <label
            className="block text-sm font-medium text-zinc-800"
            htmlFor="pf-image-input"
          >
            Photos{" "}
            <span className="font-normal text-zinc-500">
              (external image URLs, up to 8)
            </span>
          </label>

          {images.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {images.map((url) => (
                <ImageUrlRow
                  key={url}
                  onRemove={() => removeImage(url)}
                  url={url}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">No photos added yet.</p>
          )}

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass(false) + " flex-1"}
              disabled={isSaving}
              id="pf-image-input"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addImage();
                }
              }}
              placeholder="https://example.com/site-photo.jpg"
              type="url"
              value={imageInput}
              onChange={(e) => {
                setImageInput(e.target.value);
                setImageError(null);
              }}
            />
            <button
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 sm:self-auto"
              disabled={isSaving || !imageInput.trim()}
              onClick={addImage}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              Add image
            </button>
          </div>

          {imageError ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {imageError}
            </p>
          ) : null}
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
            {isEditing ? "Save changes" : "Add project"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Image URL row ─────────────────────────────────────────────────────────────

function ImageUrlRow({
  onRemove,
  url,
}: {
  onRemove: () => void;
  url: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <li className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-2">
      <span className="block size-10 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
        {failed ? (
          <span className="flex size-full items-center justify-center text-zinc-400">
            <ImageOff aria-hidden="true" className="size-4" />
          </span>
        ) : (
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
            src={url}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-zinc-600">
        <Link2 aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{url}</span>
      </span>
      <button
        aria-label={`Remove image ${url}`}
        className="shrink-0 text-zinc-500 hover:text-red-700"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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

/** Formats an ISO date string in UTC so date-only values never shift days. */
function formatCompletionDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
