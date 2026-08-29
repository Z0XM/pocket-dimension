import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { defaultTheme, docsBasePath } from "@/lib/runtime-config";
import { resolveAndApplyTheme } from "@/lib/theme";
import "./styles.css";

resolveAndApplyTheme(defaultTheme());

const routerBasename = docsBasePath() || undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
