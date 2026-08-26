import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
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
import {
  emptyCartItems,
  getCartItemCount,
  useCartStore,
} from "@/features/cart/model/cart.store";
import { MarketplaceCityButton } from "@/features/marketplace/components/MarketplaceCityButton";
import { MarketplaceCityDialog } from "@/features/marketplace/components/MarketplaceCityDialog";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
    isActive
      ? "border-emerald-700 text-zinc-950"
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
    user?.role === "CUSTOMER"
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
    <div className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link
            aria-label="Construction Materials Marketplace home"
            className="inline-flex shrink-0 items-center gap-3 font-semibold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            to="/"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <span className="hidden md:inline">
              Construction Materials Marketplace
            </span>
            <span className="md:hidden">CMM</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className={
              user?.role === "SELLER" || user?.role === "CUSTOMER"
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
            {status === "authenticated" &&
            user?.role === "CUSTOMER" ? (
              <NavLink className={navLinkClassName} to="/orders">
                My Orders
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            user?.role === "CUSTOMER" ? (
              <NavLink className={navLinkClassName} to="/rfqs">
                My RFQs
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            user?.role === "CUSTOMER" ? (
              <NavLink className={navLinkClassName} to="/wishlist">
                Wishlist
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            user?.role === "CUSTOMER" ? (
              <NavLink
                className={navLinkClassName}
                to="/profile/professional"
              >
                My Profile
              </NavLink>
            ) : null}
            {status === "authenticated" &&
            user?.role === "CUSTOMER" ? (
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
                <NavLink
                  className={navLinkClassName}
                  to="/profile/professional"
                >
                  My Profile
                </NavLink>
                <NavLink
                  className={navLinkClassName}
                  to="/professional/dashboard"
                >
                  Pro Dashboard
                </NavLink>
              </>
            ) : null}
          </nav>

          <div className="relative ml-auto flex items-center gap-2">
            {user?.role !== "SELLER" ? <MarketplaceCityButton /> : null}
            {status === "authenticated" &&
            user?.role === "CUSTOMER" ? (
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
            user?.role === "CUSTOMER" ? (
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
                      icon={UserCircle}
                      label="My Profile"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/profile/professional"
                    />
                    <MobileMenuLink
                      icon={Users}
                      label="Professionals"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/professionals"
                    />
                    <MobileMenuLink
                      icon={LayoutDashboard}
                      label="Pro Dashboard"
                      onClick={() => setIsSellerMenuOpen(false)}
                      to="/professional/dashboard"
                    />
                </HeaderDropdownMenu>
              </>
            ) : (
              <>
                <HeaderDropdownMenu
                  buttonClassName={`inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                    user?.role === "CUSTOMER" ? "xl:hidden" : "sm:hidden"
                  }`}
                  isOpen={isPrimaryMenuOpen}
                  label="Open navigation"
                  onClose={closePrimaryMenu}
                  onToggle={() => setIsPrimaryMenuOpen((isOpen) => !isOpen)}
                  panelAriaLabel="Site navigation"
                  panelClassName={`absolute right-0 top-12 z-40 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg ${
                    user?.role === "CUSTOMER" ? "xl:hidden" : "sm:hidden"
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
                    {status === "authenticated" &&
                    user?.role === "CUSTOMER" ? (
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
                    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-bold leading-none text-white">
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </span>
                  ) : null}
                </Link>
              </>
            )}
            {status === "authenticated" && user ? (
              <>
                <span className="hidden max-w-40 truncate text-sm text-zinc-600 lg:inline">
                  {user.name}
                </span>
                <button
                  aria-label="Sign out"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
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
      <Outlet />
      <MarketplaceCityDialog />
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
            ? "bg-emerald-50 text-emerald-800"
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
