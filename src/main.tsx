import React from "react";
import ReactDOM from "react-dom/client";
import "overlayscrollbars/overlayscrollbars.css";
import App from "./App";
import { ThemeProvider } from "@/theme/ThemeContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
