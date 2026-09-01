import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LogIn } from "lucide-react";
import {
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { login } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { defaultFormOptions } from "@/shared/forms/form-config";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const returnTo = getSafeReturnPath(location.state);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    ...defaultFormOptions,
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
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
              : returnTo
        }
      />
    );
  }

  const submitLogin = handleSubmit(async (values) => {
    try {
      const session = await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      setSession(session);
      navigate(
        session.user.role === "SELLER"
          ? "/seller/inventory"
          : session.user.role === "PROFESSIONAL"
            ? "/professional/dashboard"
            : returnTo,
        { replace: true },
      );
    } catch (error) {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Sign in failed. Check your details and try again.",
        ),
      });
    }
  });

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <span className="flex size-10 items-center justify-center rounded-md bg-emerald-700 text-white">
          <LogIn aria-hidden="true" className="size-5" />
        </span>
        <h1
          className="mt-5 text-2xl font-semibold text-zinc-950"
          id="login-heading"
        >
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Sign in to your marketplace account.
        </p>

        {errors.root?.message ? (
          <div
            className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errors.root.message}
          </div>
        ) : null}

        <form className="mt-6 space-y-5" noValidate onSubmit={submitLogin}>
          <div>
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
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              id="email"
              placeholder="you@example.com"
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
              htmlFor="password"
            >
              Password
            </label>
            <input
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={Boolean(errors.password)}
              autoComplete="current-password"
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
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
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <LogIn aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          New to the marketplace?{" "}
          <Link
            className="font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            to="/register"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}

function getSafeReturnPath(state: unknown): string {
  if (
    typeof state === "object" &&
    state !== null &&
    "returnTo" in state &&
    typeof state.returnTo === "string" &&
    state.returnTo.startsWith("/") &&
    !state.returnTo.startsWith("//")
  ) {
    return state.returnTo;
  }

  return "/products";
}
