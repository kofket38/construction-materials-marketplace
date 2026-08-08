import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
}

export function StarRating({ rating, size = "sm" }: StarRatingProps) {
  const normalizedRating = Math.max(0, Math.min(5, rating));
  const filledStars = Math.round(normalizedRating);
  const iconClassName = size === "md" ? "size-5" : "size-4";

  return (
    <span
      aria-label={`${normalizedRating.toFixed(1)} out of 5 stars`}
      className="inline-flex items-center gap-0.5"
      role="img"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          aria-hidden="true"
          className={`${iconClassName} ${
            index < filledStars
              ? "fill-amber-400 text-amber-500"
              : "fill-zinc-100 text-zinc-300"
          }`}
          key={index}
        />
      ))}
    </span>
  );
}
