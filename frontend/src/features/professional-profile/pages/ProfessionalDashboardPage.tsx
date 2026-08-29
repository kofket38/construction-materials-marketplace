import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  FilePlus2,
  FolderKanban,
  Globe,
  Images,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  getOwnProfessionalProfile,
  listProfessionalPortfolio,
} from "@/features/professional-profile/api/professional-profile.api";
import type { ProfessionalProfile } from "@/features/professional-profile/api/professional-profile.api";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

// ── Query key (shared with MyProfessionalProfilePage) ─────────────────────────
const OWN_PROFILE_KEY = ["professional-profile", "me"] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProfessionalDashboardPage() {
  const user = useAuthStore((state) => state.user);

  // Route protection (authentication) is handled by RequireAuth in the router.
  return <DashboardContent userName={user?.name ?? ""} />;
}

function DashboardContent({ userName }: { userName: string }) {
  const profileQuery = useQuery({
    queryKey: OWN_PROFILE_KEY,
    queryFn: ({ signal }) => getOwnProfessionalProfile(signal),
    staleTime: 30_000,
  });

  if (profileQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading your professional dashboard."
        icon={LoaderCircle}
        title="Loading dashboard"
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
          "The professional dashboard could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Dashboard unavailable"
      />
    );
  }

  const profile = profileQuery.data;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Page header */}
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">
          Professional workspace
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
          Professional Dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Welcome back, {userName.split(" ")[0]}. Here's your professional
          overview.
        </p>
      </div>

      {profile === null ? (
        <EmptyProfileState />
      ) : (
        <PopulatedDashboard profile={profile} />
      )}
    </main>
  );
}

// ── Empty state — no profile yet ──────────────────────────────────────────────

function EmptyProfileState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <User aria-hidden="true" className="size-7" strokeWidth={1.6} />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-zinc-950">
        You don't have a professional profile yet
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
        Create your professional profile to showcase your expertise, credentials,
        and specialties to the CMM community.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        to="/profile/professional"
      >
        <Plus aria-hidden="true" className="size-4" />
        Create professional profile
      </Link>
    </div>
  );
}

// ── Populated dashboard ───────────────────────────────────────────────────────

function PopulatedDashboard({ profile }: { profile: ProfessionalProfile }) {
  const completion = computeCompletion(profile);

  // Portfolio count — uses the same cache key as PortfolioManagerSection so
  // the result is shared when both components are mounted (no duplicate fetch).
  const portfolioQuery = useQuery({
    queryKey: ["professional-profile", "me", "portfolio"] as const,
    queryFn: ({ signal }) => listProfessionalPortfolio(profile.id, signal),
    staleTime: 30_000,
  });
  const portfolioCount = portfolioQuery.data?.length;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)_18rem]">
      {/* ── LEFT: Profile summary card ──────────────────────────────────── */}
      <aside className="space-y-5">
        <ProfileSummaryCard profile={profile} completion={completion} />
      </aside>

      {/* ── CENTRE: Overview + activity ─────────────────────────────────── */}
      <div className="space-y-6">
        <ProfessionalOverviewSection profile={profile} />
        <QuickActionsSection profile={profile} />
      </div>

      {/* ── RIGHT: Stats + links ────────────────────────────────────────── */}
      <aside className="space-y-5">
        <StatsCard profile={profile} portfolioCount={portfolioCount} />
        <ProfileCompletionCard completion={completion} />
      </aside>
    </div>
  );
}

// ── Profile summary card (left column) ───────────────────────────────────────

function ProfileSummaryCard({
  completion,
  profile,
}: {
  completion: CompletionResult;
  profile: ProfessionalProfile;
}) {
  const initials = getInitials(profile.displayName);
  const location = [profile.city, profile.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-md border border-zinc-200 bg-white shadow-sm">
      {/* Avatar + name */}
      <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-700 text-xl font-bold text-white shadow-sm">
          {initials}
        </span>
        <h2 className="mt-3 text-lg font-semibold text-zinc-950">
          {profile.displayName}
        </h2>
        {profile.headline ? (
          <p className="mt-1 text-sm text-zinc-600">{profile.headline}</p>
        ) : null}
        {profile.profession ? (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-zinc-500">
            <Briefcase aria-hidden="true" className="size-3.5" />
            {profile.profession}
          </p>
        ) : null}
        {location ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
            <MapPin aria-hidden="true" className="size-3.5" />
            {location}
          </p>
        ) : null}

        {/* Visibility badge */}
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            profile.visibility === "PUBLIC"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {profile.visibility === "PUBLIC" ? (
            <Eye aria-hidden="true" className="size-3" />
          ) : (
            <EyeOff aria-hidden="true" className="size-3" />
          )}
          {profile.visibility === "PUBLIC" ? "Public profile" : "Private profile"}
        </span>

        {/* Mini completion bar */}
        <div className="mt-4 w-full">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Profile complete</span>
            <span className="font-semibold text-zinc-950">
              {completion.percent}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              aria-label={`${completion.percent}% complete`}
              className="h-full rounded-full bg-emerald-600 transition-all"
              role="progressbar"
              aria-valuenow={completion.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 p-3">
        <Link
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          to={`/professionals/${profile.id}`}
        >
          <Eye aria-hidden="true" className="size-3.5" />
          View profile
        </Link>
        <Link
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          to="/profile/professional"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edit profile
        </Link>
      </div>
    </div>
  );
}

// ── Professional overview (centre, top) ───────────────────────────────────────

function ProfessionalOverviewSection({
  profile,
}: {
  profile: ProfessionalProfile;
}) {
  return (
    <section aria-labelledby="overview-heading">
      <h2
        className="flex items-center gap-2 text-lg font-semibold text-zinc-950"
        id="overview-heading"
      >
        <LayoutDashboard
          aria-hidden="true"
          className="size-5 text-emerald-700"
        />
        Professional overview
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Company */}
        {profile.company ? (
          <OverviewItem
            icon={Building2}
            label="Company"
            value={profile.company}
          />
        ) : null}

        {/* Years of experience */}
        {profile.yearsExperience != null ? (
          <OverviewItem
            icon={Briefcase}
            label="Experience"
            value={`${profile.yearsExperience} year${profile.yearsExperience !== 1 ? "s" : ""}`}
          />
        ) : null}

        {/* Location */}
        {profile.city || profile.country ? (
          <OverviewItem
            icon={MapPin}
            label="Location"
            value={
              [profile.city, profile.region, profile.country]
                .filter(Boolean)
                .join(", ")
            }
          />
        ) : null}

        {/* Website */}
        {profile.website ? (
          <OverviewItem
            icon={Globe}
            label="Website"
            value={profile.website}
            href={profile.website}
          />
        ) : null}

        {/* LinkedIn */}
        {profile.linkedinUrl ? (
          <OverviewItem
            icon={Link2}
            label="LinkedIn"
            value="LinkedIn profile"
            href={profile.linkedinUrl}
          />
        ) : null}
      </div>

      {/* Bio */}
      {profile.bio ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-zinc-500">About</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{profile.bio}</p>
        </div>
      ) : null}

      {/* Specialties */}
      {profile.specialties.length > 0 ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-zinc-500">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Specialties
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.specialties.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Credentials */}
      {profile.credentials.length > 0 ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-zinc-500">
            <BookOpen aria-hidden="true" className="size-3.5" />
            Credentials
          </p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {profile.credentials.slice(0, 3).map((cred) => (
              <li key={cred.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
                  <Award aria-hidden="true" className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">
                    {cred.title}
                  </p>
                  {cred.institution ? (
                    <p className="text-xs text-zinc-500">{cred.institution}</p>
                  ) : null}
                  {cred.yearObtained ? (
                    <p className="text-xs text-zinc-400">{cred.yearObtained}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {profile.credentials.length > 3 ? (
            <Link
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              to="/profile/professional"
            >
              View all {profile.credentials.length} credentials
              <ChevronRight aria-hidden="true" className="size-3" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ── Quick actions (centre, bottom) ────────────────────────────────────────────

function QuickActionsSection({ profile }: { profile: ProfessionalProfile }) {
  const actions: Array<{
    icon: LucideIcon;
    label: string;
    description: string;
    to: string;
    accent?: boolean;
  }> = [
    {
      icon: FolderKanban,
      label: "My projects",
      description: "Manage your construction projects",
      to: "/professional/projects",
    },
    {
      icon: FilePlus2,
      label: "Create project",
      description: "Add a new project in draft mode",
      to: "/professional/projects/new",
    },
    {
      icon: Eye,
      label: "View my profile",
      description: "See how others see your public profile",
      to: `/professionals/${profile.id}`,
    },
    {
      icon: Pencil,
      label: "Edit profile",
      description: "Update your professional information",
      to: "/profile/professional",
    },
    {
      icon: Images,
      label: "Manage portfolio",
      description: "Add and manage your project showcase",
      to: "/profile/professional#portfolio",
    },
    {
      icon: Sparkles,
      label: "Manage specialties",
      description: `${profile.specialties.length} specialt${profile.specialties.length === 1 ? "y" : "ies"} added`,
      to: "/profile/professional",
    },
    {
      icon: BookOpen,
      label: "Manage credentials",
      description: `${profile.credentials.length} credential${profile.credentials.length === 1 ? "" : "s"} added`,
      to: "/profile/professional",
    },
  ];

  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        className="text-lg font-semibold text-zinc-950"
        id="quick-actions-heading"
      >
        Quick actions
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <QuickActionCard key={action.label} {...action} />
        ))}
      </div>
    </section>
  );
}

function QuickActionCard({
  description,
  icon: Icon,
  label,
  to,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  to: string;
}) {
  return (
    <Link
      className="flex items-center gap-4 rounded-md border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      to={to}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-950">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="ml-auto size-4 shrink-0 text-zinc-400"
      />
    </Link>
  );
}

// ── Stats card (right column) ─────────────────────────────────────────────────

function StatsCard({
  portfolioCount,
  profile,
}: {
  portfolioCount: number | undefined;
  profile: ProfessionalProfile;
}) {
  const stats = [
    {
      label: "Specialties",
      value: profile.specialties.length,
      icon: Sparkles,
    },
    {
      label: "Credentials",
      value: profile.credentials.length,
      icon: Award,
    },
    {
      label: "Portfolio items",
      // Show "—" while the portfolio query is loading so the card stays stable.
      value: portfolioCount !== undefined ? portfolioCount : "—",
      icon: Images,
    },
    {
      label: "Years experience",
      value: profile.yearsExperience ?? "—",
      icon: Briefcase,
    },
  ];

  return (
    <div className="rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase text-zinc-500">
          Professional stats
        </p>
      </div>
      <ul className="divide-y divide-zinc-100 px-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <li key={label} className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-sm text-zinc-600">
              <Icon aria-hidden="true" className="size-4 text-zinc-400" />
              {label}
            </span>
            <span className="text-sm font-semibold text-zinc-950">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-zinc-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase text-zinc-500">
          Future features
        </p>
        <div className="mt-2 space-y-2">
          {["Profile views", "Connections", "Endorsements"].map((label) => (
            <div
              key={label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-zinc-500">{label}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Profile completion card (right column) ────────────────────────────────────

function ProfileCompletionCard({
  completion,
}: {
  completion: CompletionResult;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Profile completion
          </p>
          <span className="text-sm font-semibold text-zinc-950">
            {completion.percent}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${
              completion.percent === 100
                ? "bg-emerald-600"
                : completion.percent >= 60
                  ? "bg-emerald-500"
                  : "bg-amber-500"
            }`}
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${completion.percent}%` }}
          />
        </div>
      </div>

      <ul className="divide-y divide-zinc-100 px-4">
        {completion.items.map(({ label, done }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 py-2.5 text-sm"
          >
            {done ? (
              <CheckCircle2
                aria-hidden="true"
                className="size-4 shrink-0 text-emerald-600"
              />
            ) : (
              <Circle
                aria-hidden="true"
                className="size-4 shrink-0 text-zinc-300"
              />
            )}
            <span className={done ? "text-zinc-500 line-through" : "text-zinc-700"}>
              {label}
            </span>
          </li>
        ))}
      </ul>

      {completion.percent < 100 ? (
        <div className="border-t border-zinc-100 p-3">
          <Link
            className="inline-flex w-full min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            to="/profile/professional"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Complete profile
          </Link>
        </div>
      ) : (
        <div className="border-t border-zinc-100 p-4 text-center">
          <span className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700">
            <BadgeCheck aria-hidden="true" className="size-4" />
            Profile complete!
          </span>
        </div>
      )}
    </div>
  );
}

// ── Overview item helper ──────────────────────────────────────────────────────

function OverviewItem({
  href,
  icon: Icon,
  label,
  value,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const content = (
    <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
          {value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        rel="noopener noreferrer"
        target="_blank"
        className="block hover:opacity-80"
      >
        {content}
      </a>
    );
  }

  return content;
}

// ── Profile completion logic ──────────────────────────────────────────────────

interface CompletionItem {
  label: string;
  done: boolean;
}

interface CompletionResult {
  percent: number;
  items: CompletionItem[];
}

function computeCompletion(profile: ProfessionalProfile): CompletionResult {
  const items: CompletionItem[] = [
    {
      label: "Add display name",
      done: Boolean(profile.displayName?.trim()),
    },
    {
      label: "Add professional headline",
      done: Boolean(profile.headline?.trim()),
    },
    {
      label: "Add bio / about section",
      done: Boolean(profile.bio?.trim()),
    },
    {
      label: "Add profession / title",
      done: Boolean(profile.profession?.trim()),
    },
    {
      label: "Add company or organisation",
      done: Boolean(profile.company?.trim()),
    },
    {
      label: "Add location (city or country)",
      done: Boolean(profile.city?.trim() || profile.country?.trim()),
    },
    {
      label: "Add at least one specialty",
      done: profile.specialties.length > 0,
    },
    {
      label: "Add at least one credential",
      done: profile.credentials.length > 0,
    },
  ];

  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);

  return { percent, items };
}

// ── Initials helper ───────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
