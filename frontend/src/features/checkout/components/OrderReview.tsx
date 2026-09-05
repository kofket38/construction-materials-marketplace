import { PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";

import {
  calculateItemSubtotal,
  formatCartAmount,
} from "@/features/cart/lib/cart-pricing";
import type { CartItem } from "@/features/cart/model/cart";
import { ProductImage } from "@/features/products/components/ProductImage";
import { formatProductPrice } from "@/features/products/lib/product-display";

interface OrderReviewProps {
  items: CartItem[];
}

export function OrderReview({ items }: OrderReviewProps) {
  return (
    <section
      aria-labelledby="order-review-heading"
      className="border-b border-zinc-200 py-8"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
          <PackageCheck aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            className="text-lg font-semibold text-zinc-950"
            id="order-review-heading"
          >
            Order review
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Confirm the materials and quantities in your cart.
          </p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
        {items.map((item) => (
          <OrderReviewItem item={item} key={item.productId} />
        ))}
      </div>
    </section>
  );
}

function OrderReviewItem({ item }: { item: CartItem }) {
  return (
    <article className="grid gap-4 py-5 sm:grid-cols-[5rem_minmax(0,1fr)] lg:grid-cols-[5rem_minmax(0,1fr)_9rem_9rem_10rem] lg:items-center">
      <Link
        aria-label={`View ${item.name}`}
        className="flex aspect-square w-20 items-center justify-center overflow-hidden rounded-md bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
        to={`/products/${item.productId}`}
      >
        <ProductImage
          categoryName={item.categoryName}
          imageUrl={item.imageUrl}
          name={item.name}
          size="sm"
        />
      </Link>

      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-6 text-zinc-950">
          <Link
            className="hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to={`/products/${item.productId}`}
          >
            {item.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Sold by {item.sellerName}
        </p>
      </div>

      <ReviewValue label="Quantity" value={item.quantity.toLocaleString()} />
      <ReviewValue
        label="Unit price"
        value={formatProductPrice(item.price)}
      />
      <ReviewValue
        emphasized
        label="Subtotal"
        value={formatCartAmount(calculateItemSubtotal(item))}
      />
    </article>
  );
}

function ReviewValue({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 sm:col-start-2 lg:block lg:text-right">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`text-sm text-zinc-950 ${
          emphasized ? "font-semibold" : "font-medium"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
