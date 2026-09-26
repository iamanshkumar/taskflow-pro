import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { HomePage } from "./components/HomePage.tsx";

const isAppRoute =
  window.location.pathname === "/app" ||
  window.location.pathname.startsWith("/app/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isAppRoute ? <App /> : <HomePage />}</StrictMode>,
);
