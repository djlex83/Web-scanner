import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { themaAnwenden, themaBeobachten } from "./lib/thema";
import "./stil.css";

themaAnwenden();
themaBeobachten();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
