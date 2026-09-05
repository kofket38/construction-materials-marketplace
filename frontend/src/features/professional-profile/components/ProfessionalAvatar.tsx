import { useState } from "react";

interface ProfessionalAvatarProps {
  initialsClassName?: string;
  name: string;
  src?: string | null;
}

/** Avatar image with graceful fallback to initials when absent or broken. */
export function ProfessionalAvatar({
  initialsClassName = "text-lg",
  name,
  src,
}: ProfessionalAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!src || imageFailed) {
    return (
      <span
        className={`flex size-full items-center justify-center rounded-full bg-brand font-bold text-on-brand ${initialsClassName}`}
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    <img
      alt=""
      className="size-full object-cover"
      onError={() => setImageFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
