import { ImageOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { QuantityControl } from "@/features/cart/components/QuantityControl";
import {
  calculateItemSubtotal,
  formatCartAmount,
} from "@/features/cart/lib/cart-pricing";
import type { CartItem } from "@/features/cart/model/cart";
import { formatProductPrice } from "@/features/products/lib/product-display";

interface CartItemRowProps {
  item: CartItem;
  onRemove: (item: CartItem) => void;
  onUpdateQuantity: (item: CartItem, quantity: number) => void;
  quantityDisabled: boolean;
  removeDisabled: boolean;
}

export function CartItemRow({
  item,
  onRemove,
  onUpdateQuantity,
  quantityDisabled,
  removeDisabled,
}: CartItemRowProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:p-5">
      <Link
        aria-label={`View ${item.name}`}
        className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:aspect-square sm:w-28"
        to={`/products/${item.productId}`}
      >
        {item.imageUrl && !imageFailed ? (
          <img
            alt={item.name}
            className="h-full w-full object-contain p-2"
            onError={() => setImageFailed(true)}
            src={item.imageUrl}
          />
        ) : (
          <ImageOff
            aria-hidden="true"
            className="size-8 text-zinc-400"
            strokeWidth={1.5}
          />
        )}
      </Link>

      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-emerald-700">
          {item.categoryName}
        </p>
        <h2 className="mt-1 text-base font-semibold leading-6 text-zinc-950">
          <Link
            className="hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            to={`/products/${item.productId}`}
          >
            {item.name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {item.brandName ?? item.sellerName}
        </p>
        <p className="mt-3 text-sm font-semibold text-zinc-950">
          {formatProductPrice(item.price)} each
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QuantityControl
            disabled={quantityDisabled}
            label={`Quantity for ${item.name}`}
            max={item.availableQuantity}
            onChange={(quantity) => onUpdateQuantity(item, quantity)}
            value={item.quantity}
          />
          <p className="text-xs text-zinc-500">
            {item.availableQuantity.toLocaleString()} available
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-zinc-200 pt-4 sm:min-w-32 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <button
          aria-label={`Remove ${item.name} from cart`}
          className="inline-flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={removeDisabled}
          onClick={() => onRemove(item)}
          title="Remove from cart"
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Subtotal</p>
          <p className="mt-1 text-base font-semibold text-zinc-950">
            {formatCartAmount(calculateItemSubtotal(item))}
          </p>
        </div>
      </div>
    </article>
  );
}
