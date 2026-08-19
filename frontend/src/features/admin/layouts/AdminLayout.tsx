import {
  BarChart3,
  Building2,
  Boxes,
  LogOut,
  Package,
  ShoppingBag,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { logout } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/sellers", label: "Sellers", icon: Store },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-emerald-50 text-emerald-800"
      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
  }`;

export function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);
    try {
      await logout();
    } catch {
      // clear local session even if API fails
    } finally {
      setUnauthenticated();
      navigate("/login");
    }
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-zinc-200 px-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-emerald-700 text-white">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">
              CMM Admin
            </p>
            <p className="flex items-center gap-1 text-xs text-emerald-700">
              <ShieldCheck aria-hidden="true" className="size-3" />
              Administrator
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink className={navLinkClass} to={to}>
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-zinc-200 pt-4">
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              to="/products"
            >
              <Package aria-hidden="true" className="size-4 shrink-0" />
              View marketplace
            </Link>
          </div>
        </nav>

        {/* User info */}
        <div className="border-t border-zinc-200 p-3">
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
              {user?.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-950">
                {user?.name}
              </p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
            </div>
          </div>
          <button
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-60"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-md bg-emerald-700 text-white">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <span className="font-semibold text-zinc-950">CMM Admin</span>
          <nav aria-label="Mobile admin nav" className="ml-4 flex gap-1 overflow-x-auto">
            {navItems.map(({ to, label }) => (
              <NavLink
                className={({ isActive }) =>
                  `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`
                }
                key={to}
                to={to}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            className="ml-auto shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-950 disabled:opacity-60"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            Sign out
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
