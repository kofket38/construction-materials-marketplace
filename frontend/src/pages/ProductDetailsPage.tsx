import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, PackageX } from "lucide-react";
import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  addProductToWishlist,
  getWishlist,
  removeProductFromWishlist,
  requestProductQuote,
  type ProductQuoteRequestInput,
  type WishlistItem,
} from "@/features/products/api/product-actions.api";
import {
  getProductDetails,
  getProductReviews,
  getProducts,
} from "@/features/products/api/products.api";
import { Breadcrumb } from "@/features/products/components/Breadcrumb";
import {
  ProductDetailsTabs,
  type ProductDetailsTab,
} from "@/features/products/components/ProductDetailsTabs";
import { ProductGallery } from "@/features/products/components/ProductGallery";
import { ProductInfo } from "@/features/products/components/ProductInfo";
import { ProductSpecifications } from "@/features/products/components/ProductSpecifications";
import { RelatedProducts } from "@/features/products/components/RelatedProducts";
import { RequestQuoteDialog } from "@/features/products/components/RequestQuoteDialog";
import { ReviewSummary } from "@/features/products/components/ReviewSummary";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { isBuyerRole } from "@/features/auth/model/auth.types";
import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";
import {
  getApiErrorMessage,
  getHttpStatus,
} from "@/shared/api/http-error";

const RELATED_PRODUCT_LIMIT = 5;

interface WishlistMutationInput {
  remove: boolean;
}

export function ProductDetailsPage() {
  const { id: productId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );
  const [activeTab, setActiveTab] =
    useState<ProductDetailsTab>("description");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  // PROFESSIONAL accounts are buyer-capable and share customer actions.
  const isCustomer =
    authStatus === "authenticated" && isBuyerRole(user?.role);
  const wishlistQueryKey = ["wishlist", user?.id ?? "anonymous"] as const;

  const productQuery = useQuery({
    queryKey: ["products", "details", productId],
    enabled: Boolean(productId),
    queryFn: ({ signal }) => {
      if (!productId) {
        throw new Error("A product ID is required.");
      }

      return getProductDetails(productId, signal);
    },
  });
  const product = productQuery.data;

  const reviewsQuery = useQuery({
    queryKey: ["products", "reviews", productId],
    enabled: Boolean(productId && product),
    queryFn: ({ signal }) => {
      if (!productId) {
        throw new Error("A product ID is required.");
      }

      return getProductReviews(productId, signal);
    },
  });

  const relatedProductsQuery = useQuery({
    queryKey: [
      "products",
      "related",
      product?.categoryId,
      productId,
      selectedCity,
    ],
    enabled: Boolean(product?.categoryId && productId),
    queryFn: ({ signal }) => {
      if (!product) {
        throw new Error("Product details are required.");
      }

      return getProducts(
        {
          categoryId: product.categoryId,
          city: selectedCity ?? undefined,
          limit: RELATED_PRODUCT_LIMIT,
          page: 1,
          sortBy: "popularity",
          sortOrder: "desc",
        },
        signal,
      );
    },
  });

  const wishlistQuery = useQuery({
    queryKey: wishlistQueryKey,
    enabled: isCustomer,
    queryFn: ({ signal }) => getWishlist(signal),
  });
  const isWishlisted = Boolean(
    productId &&
      wishlistQuery.data?.some((item) => item.productId === productId),
  );

  const wishlistMutation = useMutation({
    mutationFn: async ({ remove }: WishlistMutationInput) => {
      if (!productId) {
        throw new Error("A product ID is required.");
      }

      if (remove) {
        await removeProductFromWishlist(productId);
        return null;
      }

      return addProductToWishlist(productId);
    },
    onSuccess: (wishlistItem, variables) => {
      queryClient.setQueryData<WishlistItem[]>(
        wishlistQueryKey,
        (current = []) =>
          variables.remove
            ? current.filter((item) => item.productId !== productId)
            : wishlistItem
              ? [
                  ...current.filter(
                    (item) => item.productId !== wishlistItem.productId,
                  ),
                  wishlistItem,
                ]
              : current,
      );
      setActionMessage(
        variables.remove
          ? "Product removed from your wishlist."
          : "Product added to your wishlist.",
      );
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
      setActionMessage(
        getApiErrorMessage(
          error,
          "Your wishlist could not be updated. Please try again.",
        ),
      );
    },
  });

  const quoteMutation = useMutation({
    mutationFn: requestProductQuote,
    onSuccess: () => {
      setIsQuoteDialogOpen(false);
      setActionMessage(
        "Quote request submitted. Eligible suppliers can now respond.",
      );
      void queryClient.invalidateQueries({ queryKey: ["rfqs", "me"] });
    },
  });

  function navigateToLogin(): void {
    navigate("/login", {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    });
  }

  function handleToggleWishlist(): void {
    setActionMessage(null);

    if (authStatus !== "authenticated" || !user) {
      navigateToLogin();
      return;
    }

    if (!isBuyerRole(user.role)) {
      setActionMessage(
        "Wishlist actions are available to customer and professional accounts.",
      );
      return;
    }

    wishlistMutation.mutate({ remove: isWishlisted });
  }

  function handleRequestQuote(): void {
    setActionMessage(null);

    if (authStatus !== "authenticated" || !user) {
      navigateToLogin();
      return;
    }

    if (!isBuyerRole(user.role)) {
      setActionMessage(
        "Quote requests are available to customer and professional accounts.",
      );
      return;
    }

    setIsQuoteDialogOpen(true);
  }

  function showReviews(): void {
    setActiveTab("reviews");
    window.requestAnimationFrame(() => {
      document
        .getElementById("product-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submitQuoteRequest(
    input: ProductQuoteRequestInput,
  ): Promise<void> {
    await quoteMutation.mutateAsync(input);
  }

  if (!productId) {
    return (
      <ProductErrorState
        description="The product address is incomplete."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (productQuery.isPending) {
    return <ProductDetailsSkeleton />;
  }

  if (productQuery.isError) {
    if (getHttpStatus(productQuery.error) === 404) {
      return <ProductNotFoundState />;
    }

    return (
      <ProductErrorState
        description={getApiErrorMessage(
          productQuery.error,
          "The product could not be loaded. Please try again.",
        )}
        onRetry={() => void productQuery.refetch()}
      />
    );
  }

  const loadedProduct = productQuery.data;
  const reviews = reviewsQuery.data?.reviews ?? [];
  const averageRating =
    reviewsQuery.data?.averageRating ?? loadedProduct.averageRating;
  const reviewCount =
    reviewsQuery.data?.reviewCount ?? loadedProduct.reviewCount;
  const relatedProducts =
    relatedProductsQuery.data?.products
      .filter((relatedProduct) => relatedProduct.id !== loadedProduct.id)
      .slice(0, 4) ?? [];

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <Breadcrumb
          categoryId={loadedProduct.categoryId}
          categoryName={loadedProduct.category.name}
          productName={loadedProduct.name}
        />

        <div className="mt-7 grid items-start gap-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:gap-12">
          <ProductGallery
            key={loadedProduct.id}
            product={loadedProduct}
          />
          <ProductInfo
            actionMessage={actionMessage}
            isWishlistPending={
              wishlistMutation.isPending ||
              (isCustomer && wishlistQuery.isPending)
            }
            isWishlisted={isWishlisted}
            key={loadedProduct.id}
            onCartResult={(result) => setActionMessage(result.message)}
            onRequestQuote={handleRequestQuote}
            onShowReviews={showReviews}
            onToggleWishlist={handleToggleWishlist}
            product={loadedProduct}
          />
        </div>

        <ProductDetailsTabs
          activeTab={activeTab}
          description={
            <section aria-labelledby="description-heading">
              <h2
                className="text-xl font-semibold text-zinc-950"
                id="description-heading"
              >
                Product description
              </h2>
              <p className="mt-4 max-w-4xl whitespace-pre-line text-base leading-8 text-zinc-600">
                {loadedProduct.description}
              </p>
            </section>
          }
          onChange={setActiveTab}
          reviews={
            <ReviewSummary
              averageRating={averageRating}
              errorMessage={
                reviewsQuery.isError
                  ? getApiErrorMessage(
                      reviewsQuery.error,
                      "Recent reviews are temporarily unavailable.",
                    )
                  : null
              }
              isLoading={reviewsQuery.isPending}
              onRetry={() => void reviewsQuery.refetch()}
              productId={loadedProduct.id}
              reviewCount={reviewCount}
              reviews={reviews}
            />
          }
          specifications={<ProductSpecifications product={loadedProduct} />}
        />

        <RelatedProducts
          categoryId={loadedProduct.categoryId}
          categoryName={loadedProduct.category.name}
          errorMessage={
            relatedProductsQuery.isError
              ? getApiErrorMessage(
                  relatedProductsQuery.error,
                  "Related products are temporarily unavailable.",
                )
              : null
          }
          isLoading={relatedProductsQuery.isPending}
          onRetry={() => void relatedProductsQuery.refetch()}
          products={relatedProducts}
        />
      </main>

      <RequestQuoteDialog
        isOpen={isQuoteDialogOpen}
        onClose={() => setIsQuoteDialogOpen(false)}
        onSubmit={submitQuoteRequest}
        product={loadedProduct}
      />
    </>
  );
}

function ProductDetailsSkeleton() {
  return (
    <main
      aria-label="Loading product details"
      className="mx-auto w-full max-w-7xl animate-pulse px-4 py-7 sm:px-6 sm:py-9 lg:px-8"
      role="status"
    >
      <span className="sr-only">Loading product details</span>
      <div className="h-4 w-72 max-w-full rounded bg-zinc-200" />
      <div className="mt-7 grid items-start gap-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:gap-12">
        <div>
          <div className="aspect-[4/3] rounded-md bg-zinc-200" />
          <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                className="aspect-square rounded-md bg-zinc-200"
                key={index}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="h-4 w-28 rounded bg-zinc-200" />
          <div className="mt-4 h-10 w-4/5 rounded bg-zinc-200" />
          <div className="mt-4 h-4 w-56 rounded bg-zinc-200" />
          <div className="mt-7 border-y border-zinc-200 py-6">
            <div className="h-9 w-44 rounded bg-zinc-200" />
            <div className="mt-4 h-4 w-36 rounded bg-zinc-200" />
          </div>
          <div className="grid grid-cols-2 gap-5 border-b border-zinc-200 py-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index}>
                <div className="h-3 w-20 rounded bg-zinc-200" />
                <div className="mt-2 h-4 w-28 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="h-12 rounded-md bg-zinc-200" />
            <div className="h-12 rounded-md bg-zinc-200" />
          </div>
        </div>
      </div>
      <div className="mt-12 h-12 border-b border-zinc-200">
        <div className="h-full w-80 max-w-full rounded-t bg-zinc-200" />
      </div>
      <div className="mt-8 h-4 w-full rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-5/6 rounded bg-zinc-200" />
    </main>
  );
}

function ProductNotFoundState() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section>
        <PackageX
          aria-hidden="true"
          className="size-9 text-brand-ink"
          strokeWidth={1.6}
        />
        <p className="mt-5 text-sm font-semibold text-brand-ink">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Product not found
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-zinc-600">
          This product may have been removed or is no longer available.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          to="/products"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Browse products
        </Link>
      </section>
    </main>
  );
}

interface ProductErrorStateProps {
  description: string;
  onRetry: () => void;
}

function ProductErrorState({
  description,
  onRetry,
}: ProductErrorStateProps) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <section className="max-w-md text-center" aria-live="polite">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto size-9 text-red-700"
          strokeWidth={1.6}
        />
        <h1 className="mt-5 text-2xl font-semibold text-zinc-950">
          Unable to load product
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {description}
        </p>
        <button
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
