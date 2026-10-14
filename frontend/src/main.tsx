import React from "react";
import ReactDOM from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import { ToastProvider } from "./ui/ToastProvider";
import { App } from "./App";
import { AuthGate } from "./auth/AuthGate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <ToastProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </ToastProvider>
    </HeroUIProvider>
  </React.StrictMode>
);
