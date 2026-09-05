import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Link2,
  LoaderCircle,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";

import type {
  CreateProjectInput,
  Project,
} from "@/features/projects/api/projects.api";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { defaultFormOptions, zodResolver } from "@/shared/forms/form-config";

// ── Validation (mirrors backend field limits; dates/order as string inputs) ───

const projectFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  projectType: z.string().trim().max(150).optional(),
  location: z.string().trim().max(200).optional(),
  budget: z
    .string()
    .trim()
    .refine(
      (v) => !v || /^\d{1,12}(\.\d{1,2})?$/.test(v),
      "Budget must be a non-negative amount with at most two decimal places.",
    )
    .optional(),
  startDate: z
    .string()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Must be a valid date.")
    .optional(),
  endDate: z
    .string()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Must be a valid date.")
    .optional(),
  displayOrder: z
    .string()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) <= 1_000_000),
      "Must be a whole number of 0 or more.",
    )
    .optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const imageUrlSchema = z
  .string()
  .trim()
  .url("Each image must be a valid URL.")
  .max(500, "Each image URL must be 500 characters or fewer.");

// ── Form component ────────────────────────────────────────────────────────────

export function ProjectForm({
  onCancel,
  onSaved,
  project,
  submitLabel,
  onSubmitInput,
}: {
  onCancel?: () => void;
  onSaved: (project: Project) => void;
  /** Existing project for edit mode; omit for create mode. */
  project?: Project;
  submitLabel: string;
  /** Turns validated form values into the API call. */
  onSubmitInput: (
    input: CreateProjectInput,
  ) => Promise<Project>;
}) {
  const [images, setImages] = useState<string[]>(project?.images ?? []);
  const [imageInput, setImageInput] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<ProjectFormValues>({
    ...defaultFormOptions,
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      title: project?.title ?? "",
      description: project?.description ?? "",
      projectType: project?.projectType ?? "",
      location: project?.location ?? "",
      budget: project?.budget ?? "",
      startDate: project?.startDate ? project.startDate.slice(0, 10) : "",
      endDate: project?.endDate ? project.endDate.slice(0, 10) : "",
      displayOrder: project ? String(project.displayOrder) : "",
    },
  });

  const {
    formState: { errors, isSubmitSuccessful },
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
      setImageError("A project may have at most 8 images.");
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

  function moveImage(from: number, to: number) {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: onSubmitInput,
    onSuccess: onSaved,
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(error, "Could not save the project."),
      });
    },
  });

  const onSubmit: SubmitHandler<ProjectFormValues> = (values) => {
    if (images.length === 0 && imageInput.trim() !== "") {
      setImageError("Click “Add image” to include the URL you typed.");
      return;
    }

    const payload: CreateProjectInput = {
      title: values.title,
      description: values.description || null,
      projectType: values.projectType || null,
      location: values.location || null,
      budget: values.budget || null,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      images,
      displayOrder: values.displayOrder ? Number(values.displayOrder) : 0,
    };

    mutation.mutate(payload);
  };

  const isSaving = mutation.isPending;

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field error={errors.title?.message} id="project-title" required label="Project title">
            <input
              className={inputClass(Boolean(errors.title))}
              disabled={isSaving}
              id="project-title"
              maxLength={200}
              placeholder="e.g. G+2 Residential Villa"
              {...register("title")}
            />
          </Field>
        </div>

        <Field error={errors.projectType?.message} id="project-type" label="Project type">
          <input
            className={inputClass(Boolean(errors.projectType))}
            disabled={isSaving}
            id="project-type"
            maxLength={150}
            placeholder="e.g. Residential"
            {...register("projectType")}
          />
        </Field>

        <Field error={errors.location?.message} id="project-location" label="Location">
          <input
            className={inputClass(Boolean(errors.location))}
            disabled={isSaving}
            id="project-location"
            maxLength={200}
            placeholder="e.g. Addis Ababa"
            {...register("location")}
          />
        </Field>

        <Field
          error={errors.budget?.message}
          hint="Optional. Amount in ETB."
          id="project-budget"
          label="Budget"
        >
          <input
            className={inputClass(Boolean(errors.budget))}
            disabled={isSaving}
            id="project-budget"
            inputMode="decimal"
            placeholder="e.g. 250000.00"
            {...register("budget")}
          />
        </Field>

        <Field
          error={errors.displayOrder?.message}
          hint="Lower numbers are shown first."
          id="project-order"
          label="Display order"
        >
          <input
            className={inputClass(Boolean(errors.displayOrder))}
            disabled={isSaving}
            id="project-order"
            min={0}
            placeholder="e.g. 0"
            type="number"
            {...register("displayOrder")}
          />
        </Field>

        <Field error={errors.startDate?.message} id="project-start" label="Start date">
          <input
            className={inputClass(Boolean(errors.startDate))}
            disabled={isSaving}
            id="project-start"
            type="date"
            {...register("startDate")}
          />
        </Field>

        <Field error={errors.endDate?.message} id="project-end" label="End date">
          <input
            className={inputClass(Boolean(errors.endDate))}
            disabled={isSaving}
            id="project-end"
            type="date"
            {...register("endDate")}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field error={errors.description?.message} id="project-description" label="Description">
            <textarea
              className={inputClass(Boolean(errors.description)) + " resize-none"}
              disabled={isSaving}
              id="project-description"
              maxLength={2000}
              placeholder="Scope, materials, your role, timeline…"
              rows={3}
              {...register("description")}
            />
          </Field>
        </div>
      </div>

      {/* Image URLs */}
      <div>
        <label className="block text-sm font-medium text-zinc-800" htmlFor="project-image-input">
          Images{" "}
          <span className="font-normal text-zinc-500">
            (external image URLs, up to 8)
          </span>
        </label>

        {images.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {images.map((url, index) => (
              <ImageUrlRow
                key={url}
                index={index}
                isFirst={index === 0}
                isLast={index === images.length - 1}
                onMoveDown={() => moveImage(index, index + 1)}
                onMoveUp={() => moveImage(index, index - 1)}
                onRemove={() => removeImage(url)}
                url={url}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No images added yet.</p>
        )}

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass(false) + " flex-1"}
            disabled={isSaving}
            id="project-image-input"
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
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {errors.root.message}
        </div>
      ) : null}

      {mutation.isSuccess && isSubmitSuccessful ? (
        <p className="flex items-center gap-2 text-sm font-medium text-brand-ink" role="status">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Changes saved.
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Image URL row ─────────────────────────────────────────────────────────────

function ImageUrlRow({
  index,
  isFirst,
  isLast,
  onMoveDown,
  onMoveUp,
  onRemove,
  url,
}: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  url: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 sm:flex-nowrap sm:gap-3">
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
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {!isFirst ? (
          <button
            aria-label={`Move image ${index + 1} earlier`}
            className="rounded-md px-1.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            onClick={onMoveUp}
            type="button"
          >
            ↑
          </button>
        ) : null}
        {!isLast ? (
          <button
            aria-label={`Move image ${index + 1} later`}
            className="rounded-md px-1.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            onClick={onMoveDown}
            type="button"
          >
            ↓
          </button>
        ) : null}
        <button
          aria-label={`Remove image ${url}`}
          className="shrink-0 p-1 text-zinc-500 hover:text-red-700"
          onClick={onRemove}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </span>
    </li>
  );
}

// ── Shared form helpers (CMM pattern) ─────────────────────────────────────────

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
    "focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60",
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-brand",
  ].join(" ");
}
