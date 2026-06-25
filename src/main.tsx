import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { UserProvider } from "./UserContext";
import { NotifyProvider } from "./NotifyContext";

// Turnstile global callbacks
(window as any).registerTokenCallback = (token: string) => {
  (window as any).registerToken = token;
};
(window as any).loginTokenCallback = (token: string) => {
  (window as any).loginToken = token;
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
