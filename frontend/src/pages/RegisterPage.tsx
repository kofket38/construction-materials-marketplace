import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, HardHat, LoaderCircle, ShoppingCart, UserPlus } from "lucide-react";
import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { register as registerAccount } from "@/features/auth/api/auth.api";
import type { RegistrationRole } from "@/features/auth/model/auth.types";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { defaultFormOptions } from "@/shared/forms/form-config";

// ── Role picker configuration ─────────────────────────────────────────────────

const ROLE_OPTIONS: ReadonlyArray<{
  role: RegistrationRole;
  icon: typeof ShoppingCart;
  title: string;
  description: string;
}> = [
  {
    role: "CUSTOMER",
    icon: ShoppingCart,
    title: "Customer / Buyer",
    description: "Browse and purchase construction materials",
  },
  {
    role: "SELLER",
    icon: HardHat,
    title: "Seller / Supplier",
    description: "List products and sell construction materials",
  },
  {
    role: "PROFESSIONAL",
    icon: Briefcase,
    title: "Professional",
    description: "Showcase your expertise, services, and projects",
  },
];

// ── RHF schema — role is managed via local state, not RHF ────────────────────

const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(160, "Name must contain at most 160 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(72, "Password must contain at most 72 characters.")
    .regex(/[a-z]/, "Password must contain a lowercase letter.")
    .regex(/[A-Z]/, "Password must contain an uppercase letter.")
    .regex(/[0-9]/, "Password must contain a number."),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number must contain at most 30 characters."),
  company: z
    .string()
    .trim()
    .max(150, "Company name must contain at most 150 characters."),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export function RegisterPage() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);

  // Registration role selection. Since M1, PROFESSIONAL is a real backend
  // role and is sent as chosen — see auth.api.ts. ADMIN is intentionally
  // absent from ROLE_OPTIONS.
  const [selectedRole, setSelectedRole] = useState<RegistrationRole>("CUSTOMER");

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<RegistrationFormValues>({
    ...defaultFormOptions,
    defaultValues: {
      company: "",
      email: "",
      name: "",
      password: "",
      phone: "",
    },
    resolver: zodResolver(registrationSchema),
  });

  if (status === "authenticated" && user) {
    return (
      <Navigate
        replace
        to={
          user.role === "SELLER"
            ? "/seller/inventory"
            : user.role === "PROFESSIONAL"
              ? "/professional/dashboard"
              : "/products"
        }
      />
    );
  }

  const submitRegistration = handleSubmit(async (values) => {
    const company = values.company.trim();
    const phone = values.phone.trim();

    try {
      const session = await registerAccount({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: selectedRole,
        ...(company ? { company } : {}),
        ...(phone ? { phone } : {}),
      });
      setSession(session);
      // Post-registration onboarding redirect by the chosen role.
      navigate(
        selectedRole === "SELLER"
          ? "/seller/inventory"
          : selectedRole === "PROFESSIONAL"
            ? "/profile/professional"
            : "/products",
        { replace: true },
      );
    } catch (error) {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Account creation failed. Please try again.",
        ),
      });
    }
  });

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section
        aria-labelledby="registration-heading"
        className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <span className="flex size-10 items-center justify-center rounded-md bg-brand text-on-brand">
          <UserPlus aria-hidden="true" className="size-5" />
        </span>
        <h1
          className="mt-5 text-2xl font-semibold text-zinc-950"
          id="registration-heading"
        >
          Create your account
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Choose how you'll use CMM.
        </p>

        {/* ── Role picker ──────────────────────────────────────────────────── */}
        <div
          aria-label="Account type"
          className="mt-6 grid gap-3 sm:grid-cols-3"
          role="group"
        >
          {ROLE_OPTIONS.map(({ role, icon: Icon, title, description }) => {
            const isSelected = selectedRole === role;
            return (
              <button
                aria-pressed={isSelected}
                className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring ${
                  isSelected
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
                key={role}
                onClick={() => setSelectedRole(role)}
                type="button"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                    isSelected
                      ? "bg-brand text-on-brand"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="text-sm font-semibold leading-tight">
                  {title}
                </span>
                <span className="text-xs leading-snug text-zinc-500">
                  {description}
                </span>
              </button>
            );
          })}
        </div>

        {errors.root?.message ? (
          <div
            className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errors.root.message}
          </div>
        ) : null}

        {/* ── Registration form ─────────────────────────────────────────────── */}
        <form
          className="mt-6 grid gap-5 sm:grid-cols-2"
          noValidate
          onSubmit={submitRegistration}
        >
          <div className="sm:col-span-2">
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="name"
            >
              Full name
            </label>
            <input
              aria-describedby={errors.name ? "name-error" : undefined}
              aria-invalid={Boolean(errors.name)}
              autoComplete="name"
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="name"
              {...register("name")}
            />
            {errors.name?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="name-error">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="email"
              type="email"
              {...register("email")}
            />
            {errors.email?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="email-error">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="phone"
            >
              Phone{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              aria-describedby={errors.phone ? "phone-error" : undefined}
              aria-invalid={Boolean(errors.phone)}
              autoComplete="tel"
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="phone"
              type="tel"
              {...register("phone")}
            />
            {errors.phone?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="phone-error">
                {errors.phone.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="company"
            >
              Company{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              aria-describedby={errors.company ? "company-error" : undefined}
              aria-invalid={Boolean(errors.company)}
              autoComplete="organization"
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="company"
              {...register("company")}
            />
            {errors.company?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="company-error">
                {errors.company.message}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="password"
            >
              Password
            </label>
            <input
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={Boolean(errors.password)}
              autoComplete="new-password"
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="password"
              type="password"
              {...register("password")}
            />
            {errors.password?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="password-error">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <UserPlus aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            className="font-semibold text-brand-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
