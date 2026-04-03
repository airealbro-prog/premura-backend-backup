import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/lib/auth";
import { AuthGuard } from "@/components/auth/AuthGuard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGuard>
        <App />
      </AuthGuard>
    </AuthProvider>
  </StrictMode>
);
