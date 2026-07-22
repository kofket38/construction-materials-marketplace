import { createBrowserRouter } from "react-router-dom";
import { FoundationPage } from "@/pages/system/FoundationPage";
import { NotFoundPage } from "@/pages/system/NotFoundPage";
import { RouteErrorPage } from "@/pages/system/RouteErrorPage";
import { PublicLayout } from "@/shared/layouts/PublicLayout";
import { RootLayout } from "@/shared/layouts/RootLayout";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            index: true,
            element: <FoundationPage />,
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
