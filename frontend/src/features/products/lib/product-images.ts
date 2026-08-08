import dangoteCementImage from "../../../../images/products/dangote cement.jpg.png";
import derbaCementImage from "../../../../images/products/derba cement.jpg.png";
import habeshaCementImage from "../../../../images/products/habesha cement.jpg.png";
import mugherCementImage from "../../../../images/products/mugher cement.jpg.png";
import nationalCementImage from "../../../../images/products/nationalcement.jpg.png";

import type { Product } from "@/features/products/model/product";

export type LocalCementBrand =
  | "dangote"
  | "derba"
  | "habesha"
  | "mugher"
  | "national";

export interface LocalProductImage {
  brand: LocalCementBrand | null;
  brandLabel: string | null;
  isDefault: boolean;
  src: string | null;
}

interface LocalBrandImageDefinition {
  aliases: string[];
  brand: LocalCementBrand;
  brandLabel: string;
  images: string[];
}

const localBrandImages: LocalBrandImageDefinition[] = [
  {
    aliases: ["dangote"],
    brand: "dangote",
    brandLabel: "Dangote Cement",
    images: [dangoteCementImage],
  },
  {
    aliases: ["national cement", "nationalcement"],
    brand: "national",
    brandLabel: "National Cement",
    images: [nationalCementImage],
  },
  {
    aliases: ["derba"],
    brand: "derba",
    brandLabel: "Derba Cement",
    images: [derbaCementImage],
  },
  {
    aliases: ["mugher"],
    brand: "mugher",
    brandLabel: "Mugher Cement",
    images: [mugherCementImage],
  },
  {
    aliases: ["habesha"],
    brand: "habesha",
    brandLabel: "Habesha Cement",
    images: [habeshaCementImage],
  },
];

export function resolveLocalProductImage(product: Product): LocalProductImage {
  if (product.imageUrl) {
    return {
      brand: null,
      brandLabel: null,
      isDefault: false,
      src: product.imageUrl,
    };
  }

  const productBrand = findMatchingBrand(product);
  const matchedBrand = productBrand;

  return {
    brand: matchedBrand?.brand ?? null,
    brandLabel: matchedBrand?.brandLabel ?? null,
    isDefault: false,
    src: matchedBrand?.images[0] ?? null,
  };
}

export function resolveLocalProductImages(product: Product): string[] {
  if (product.imageUrl) {
    return [product.imageUrl];
  }

  return findMatchingBrand(product)?.images ?? [];
}

function findMatchingBrand(
  product: Product,
): LocalBrandImageDefinition | undefined {
  if (!normalizeBrandText(product.category.name).includes("cement")) {
    return undefined;
  }

  const searchableProductText = normalizeBrandText(
    [
      product.brand?.name,
      product.name,
      product.description,
      product.seller.shopName,
      product.seller.name,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return localBrandImages.find((definition) =>
    definition.aliases.some((alias) =>
      searchableProductText.includes(normalizeBrandText(alias)),
    ),
  );
}

function normalizeBrandText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
