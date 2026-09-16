import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  FolderKanban,
  Heart,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  UserCircle,
  UserPlus,
  Users,
  Warehouse,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { logout } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { isBuyerRole } from "@/features/auth/model/auth.types";
import {
  emptyCartItems,
  getCartItemCount,
  useCartStore,
} from "@/features/cart/model/cart.store";
import { MarketplaceCityButton } from "@/features/marketplace/components/MarketplaceCityButton";
import { MarketplaceCityDialog } from "@/features/marketplace/components/MarketplaceCityDialog";
import { CmmLogo, CmmLogoLink } from "@/shared/brand/CmmLogo";
import { ThemeToggle } from "@/shared/theme/ThemeToggle";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring ${
    isActive
      ? "border-brand text-zinc-950"
      : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
  }`;

export function PublicLayout() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSellerMenuOpen, setIsSellerMenuOpen] = useState(false);
  const [isPrimaryMenuOpen, setIsPrimaryMenuOpen] = useState(false);
  const closeSellerMenu = useCallback(() => {
    setIsSellerMenuOpen(false);
  }, []);
  const closePrimaryMenu = useCallback(() => {
    setIsPrimaryMenuOpen(false);
  }, []);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setUnauthenticated = useAuthStore(
    (state) => state.setUnauthenticated,
  );
  const cartItems = useCartStore((state) =>
    user && isBuyerRole(user.role)
      ? (state.cartsByUserId[user.id] ?? emptyCartItems)
      : emptyCartItems,
  );
  const cartItemCount = getCartItemCount(cartItems);

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);

    try {
      await logout();
    } catch {
      // Local credentials must still be cleared when the API is unavailable.
    } finally {
      setUnauthenticated();
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-zinc-950">
      {/* Sticky so the cart, city and workspace controls stay one tap away down
          a long catalog. `z-30` sits under the header's own dropdown panels
          (`z-40`) and under the city dialog. */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        {/* Tightened base-scale gaps/padding keep the authenticated customer
            control cluster inside a 390px viewport without horizontal
            overflow; larger breakpoints keep the original spacing. */}
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-3 sm:gap-5 sm:px-6 lg:px-8">
          <CmmLogoLink className="shrink-0" size="sm" variant="full" />

          <nav
            aria-label="Primary navigation"
            className={
              user?.role === "SELLER" || isBuyerRole(user?.role)
                ? "hidden self-stretch xl:flex"
                : "hidden self-stretch sm:flex"
            }
          >
            {user?.role !== "SELLER" ? (
              <>
                <NavLink className={navLinkClassName} to="/products">
                  Catalog
                </NavLink>
                <NavLink className={navLinkClassName} to="/stores">
                  Suppliers
                </NavLink>
              </>
            ) : null}
            <NavLink className={navLinkClassName} to="/professionals">
              Professionals
            </NavLink>
            <NavLink className={navLinkClassName} to="/projects">
              Projects
            </NavLink>
            {status === "authenticated" &&
            isBuyerRole(user?.role) ? (
              <NavLink className={navLinkClassName} to="/orders">
                My Orders
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            isBuyerRole(user?.role) ? (
              <NavLink className={navLinkClassName} to="/rfqs">
                My RFQs
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            isBuyerRole(user?.role) ? (
              <NavLink className={navLinkClassName} to="/wishlist">
                Wishlist
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            user?.role === "PROFESSIONAL" ? (
              <NavLink
                className={navLinkClassName}
                to="/profile/professional"
              >
                My Profile
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            user?.role === "PROFESSIONAL" ? (
              <NavLink
                className={navLinkClassName}
                to="/professional/dashboard"
              >
                Pro Dashboard
              </NavLink>
            ) : null}
            {status === "authenticated" && user?.role === "ADMIN" ? (
              <NavLink className={navLinkClassName} to="/admin/dashboard">
                Admin
              </NavLink>
            ) : null}
            {status === "authenticated" && user?.role === "SELLER" ? (
              <>
                <NavLink
                  className={navLinkClassName}
                  to="/seller/dashboard"
                >
                  Dashboard
                </NavLink>
                <NavLink
                  className={navLinkClassName}
                  to="/seller/inventory"
                >
                  Inventory
                </NavLink>
                <NavLink className={navLinkClassName} to="/seller/orders">
                  Orders
                </NavLink>
                <NavLink className={navLinkClassName} to="/seller/rfqs">
                  RFQs
                </NavLink>
                <NavLink
                  className={navLinkClassName}
                  to="/seller/payments"
                >
                  Payments
                </NavLink>
                <NavLink className={navLinkClassName} to="/seller/sales">
                  Sales
                </NavLink>
                <NavLink
                  className={navLinkClassName}
                  to="/seller/profile"
                >
                  Settings
                </NavLink>
              </>
            ) : null}
          </nav>

          <div className="relative ml-auto flex items-center gap-2">
            {user?.role !== "SELLER" ? <MarketplaceCityButton /> : null}
            {status === "authenticated" &&
            isBuyerRole(user?.role) ? (
              <Link
                aria-label="My Orders"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 sm:hidden"
                title="My Orders"
                to="/orders"
              >
                <ClipboardList aria-hidden="true" className="size-5" />
              </Link>
            ) : null}
            {status === "authenticated" &&
            isBuyerRole(user?.role) ? (
              <Link
                aria-label="My Wishlist"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 sm:hidden"
                title="My Wishlist"
                to="/wishlist"
              >
                <Heart aria-hidden="true" className="size-5" />
              </Link>
            ) : null}
            {status === "authenticated" && user?.role === "SELLER" ? (
              <>
                <HeaderDropdownMenu
                  buttonClassName="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 xl:hidden"
                  isOpen={isSellerMenuOpen}
                  label="Open seller navigation"
                  onClose={closeSellerMenu}
                  onToggle={() => setIsSellerMenuOpen((isOpen) => !isOpen)}
                  panelAriaLabel="Seller navigation"
                  panelClassName="absolute right-0 top-12 z-40 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg xl:hidden"
                  title="Seller navigation"
                >
                    <MobileMenuLink
                      icon={LayoutDashboard}
                      label="Dashboard"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/dashboard"
                    />
                    <MobileMenuLink
                      icon={Warehouse}
                      label="Inventory"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/inventory"
                    />
                    <MobileMenuLink
                      icon={ClipboardList}
                      label="Orders"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/orders"
                    />
                    <MobileMenuLink
                      icon={ClipboardList}
                      label="RFQs"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/rfqs"
                    />
                    <MobileMenuLink
                      icon={CreditCard}
                      label="Payments"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/payments"
                    />
                    <MobileMenuLink
                      icon={BarChart3}
                      label="Sales"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/sales"
                    />
                    <MobileMenuLink
                      icon={Settings}
                      label="Settings"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/seller/profile"
                    />
                    <MobileMenuLink
                      icon={Users}
                      label="Professionals"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/professionals"
                    />
                    <MobileMenuLink
                      icon={FolderKanban}
                      label="Projects"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/projects"
                    />
                    <MobileMenuThemeSection />
                </HeaderDropdownMenu>
              </>
            ) : (
              <>
                <HeaderDropdownMenu
                  buttonClassName={`inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                    isBuyerRole(user?.role) ? "xl:hidden" : "sm:hidden"
                  }`}
                  isOpen={isPrimaryMenuOpen}
                  label="Open navigation"
                  onClose={closePrimaryMenu}
                  onToggle={() => setIsPrimaryMenuOpen((isOpen) => !isOpen)}
                  panelAriaLabel="Site navigation"
                  panelClassName={`absolute right-0 top-12 z-40 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg ${
                    isBuyerRole(user?.role) ? "xl:hidden" : "sm:hidden"
                  }`}
                  title="Navigation"
                >
                    <MobileMenuLink
                      icon={Package}
                      label="Catalog"
                      onClick={() => setIsPrimaryMenuOpen(false)}
                      to="/products"
                    />
                    <MobileMenuLink
                      icon={Warehouse}
                      label="Suppliers"
                      onClick={() => setIsPrimaryMenuOpen(false)}
                      to="/stores"
                    />
                    <MobileMenuLink
                      icon={Users}
                      label="Professionals"
                      onClick={() => setIsPrimaryMenuOpen(false)}
                      to="/professionals"
                    />
                    <MobileMenuLink
                      icon={FolderKanban}
                      label="Projects"
                      onClick={() => setIsPrimaryMenuOpen(false)}
                      to="/projects"
                    />
                    {status === "authenticated" &&
                    isBuyerRole(user?.role) ? (
                      <>
                        <MobileMenuLink
                          icon={ClipboardList}
                          label="My Orders"
                          onClick={() => setIsPrimaryMenuOpen(false)}
                          to="/orders"
                        />
                        <MobileMenuLink
                          icon={FileText}
                          label="My RFQs"
                          onClick={() => setIsPrimaryMenuOpen(false)}
                          to="/rfqs"
                        />
                        <MobileMenuLink
                          icon={Heart}
                          label="Wishlist"
                          onClick={() => setIsPrimaryMenuOpen(false)}
                          to="/wishlist"
                        />
                      </>
                    ) : null}
                    {status === "authenticated" &&
                    user?.role === "PROFESSIONAL" ? (
                      <>
                        <MobileMenuLink
                          icon={UserCircle}
                          label="My Profile"
                          onClick={() => setIsPrimaryMenuOpen(false)}
                          to="/profile/professional"
                        />
                        <MobileMenuLink
                          icon={LayoutDashboard}
                          label="Pro Dashboard"
                          onClick={() => setIsPrimaryMenuOpen(false)}
                          to="/professional/dashboard"
                        />
                      </>
                    ) : null}
                    {status === "authenticated" && user?.role === "ADMIN" ? (
                      <MobileMenuLink
                        icon={Settings}
                        label="Admin"
                        onClick={() => setIsPrimaryMenuOpen(false)}
                        to="/admin/dashboard"
                      />
                    ) : null}
                    <MobileMenuThemeSection />
                </HeaderDropdownMenu>
                <Link
                  aria-label={`Cart with ${cartItemCount.toLocaleString()} ${
                    cartItemCount === 1 ? "item" : "items"
                  }`}
                  className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                  title="Shopping cart"
                  to="/cart"
                >
                  <ShoppingCart aria-hidden="true" className="size-5" />
                  {cartItemCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-on-brand">
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </span>
                  ) : null}
                </Link>
              </>
            )}
            {/* Sits beside the account controls from `md` up. Below that the
                header cluster has no room, so the toggle moves into the
                hamburger panel — the two are mutually exclusive, never both. */}
            <ThemeToggle className="hidden md:inline-flex" />
            {status === "authenticated" && user ? (
              <>
                <span className="hidden max-w-40 truncate text-sm text-zinc-600 lg:inline">
                  {user.name}
                </span>
                <button
                  aria-label="Sign out"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
                  disabled={isSigningOut}
                  onClick={() => void handleSignOut()}
                  title="Sign out"
                  type="button"
                >
                  {isSigningOut ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <LogOut aria-hidden="true" className="size-4" />
                  )}
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                  to="/login"
                >
                  <LogIn aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                  to="/register"
                >
                  <UserPlus aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Register</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {/* Pages own their own `<main>`, so this is a plain growth wrapper that
          pins the footer to the bottom of short pages. */}
      <div className="flex-1">
        <Outlet />
      </div>
      <PublicFooter />
      <MarketplaceCityDialog />
    </div>
  );
}

/**
 * Site footer for every public page.
 *
 * Deliberately limited to destinations that exist and facts the application can
 * stand behind: the four public sections, the account entry points, and what
 * CMM actually is. No counts, no delivery promises, no social accounts — an
 * invented statistic in a footer is still an invented statistic.
 */
function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2 lg:col-span-2">
          <CmmLogo size="sm" variant="full" />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
            CMM connects construction buyers with material suppliers across
            Ethiopian cities. Compare prices and stock, request quotations for
            bulk work, and order for delivery to your site.
          </p>
        </div>
        <FooterColumn title="Marketplace">
          <FooterLink label="Catalog" to="/products" />
          <FooterLink label="Suppliers" to="/stores" />
          <FooterLink label="Professionals" to="/professionals" />
          <FooterLink label="Projects" to="/projects" />
        </FooterColumn>
        <FooterColumn title="Your account">
          <FooterLink label="Sign in" to="/login" />
          <FooterLink label="Create an account" to="/register" />
          <FooterLink label="Cart" to="/cart" />
          <FooterLink label="Wishlist" to="/wishlist" />
        </FooterColumn>
      </div>
      <div className="border-t border-zinc-200">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-xs text-zinc-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} CMM — Construction Materials Marketplace.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">{children}</ul>
    </nav>
  );
}

function FooterLink({ label, to }: { label: string; to: string }) {
  return (
    <li>
      <Link
        className="inline-flex min-h-8 items-center text-sm text-zinc-700 transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
        to={to}
      >
        {label}
      </Link>
    </li>
  );
}

/**
 * Theme control for the hamburger panel. Hidden from `md` up, where the header
 * renders the compact toggle instead, so only one is ever reachable.
 */
function MobileMenuThemeSection() {
  return (
    <div className="mt-2 border-t border-zinc-200 pt-2 md:hidden">
      <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Theme
      </p>
      <ThemeToggle layout="labelled" />
    </div>
  );
}

function MobileMenuLink({
  icon: Icon,
  label,
  onClick,
  to,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  onClick: () => void;
  to: string;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
          isActive
            ? "bg-brand-soft text-brand-ink"
            : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
        }`
      }
      onClick={onClick}
      to={to}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </NavLink>
  );
}

interface HeaderDropdownMenuProps {
  buttonClassName: string;
  children: ReactNode;
  isOpen: boolean;
  label: string;
  onClose: () => void;
  onToggle: () => void;
  panelAriaLabel: string;
  panelClassName: string;
  title: string;
}

/**
 * Header hamburger button with an anchored dropdown panel. Closes on Escape
 * or pointer-down outside the trigger and panel, and returns focus to the
 * trigger when the menu closes.
 */
function HeaderDropdownMenu({
  buttonClassName,
  children,
  isOpen,
  label,
  onClose,
  onToggle,
  panelAriaLabel,
  panelClassName,
  title,
}: HeaderDropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={label}
        className={buttonClassName}
        onClick={onToggle}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      {isOpen ? (
        <nav
          aria-label={panelAriaLabel}
          className={panelClassName}
          ref={panelRef}
        >
          {children}
        </nav>
      ) : null}
    </>
  );
}
