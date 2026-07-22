import { AlertTriangle } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

export function RouteErrorPage() {
  const error = useRouteError();
  const description = isRouteErrorResponse(error)
    ? error.statusText || "The requested page could not be loaded."
    : "The application encountered an unexpected error.";

  return (
    <FullPageStatus
      action={{
        label: "Reload",
        onClick: () => window.location.reload(),
      }}
      description={description}
      icon={AlertTriangle}
      title="Unable to load this page"
    />
  );
}
