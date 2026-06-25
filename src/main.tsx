import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { UserProvider } from "./UserContext";
import { NotifyProvider } from "./NotifyContext";

// Turnstile global callback
(window as any).turnstileCallback = (token: string) => {
  (window as any).turnstileToken = token;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <NotifyProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </NotifyProvider>
    </BrowserRouter>
  </StrictMode>
);
