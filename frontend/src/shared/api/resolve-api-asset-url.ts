import { env } from "@/shared/config/env";

export function resolveApiAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return new URL(path, new URL(env.VITE_API_BASE_URL).origin).toString();
}
