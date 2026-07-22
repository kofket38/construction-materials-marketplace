import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { configureApiAuthentication } from "@/app/api/configure-api-authentication";
import { AppProviders } from "@/app/providers/AppProviders";
import "@/styles/index.css";

configureApiAuthentication();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
