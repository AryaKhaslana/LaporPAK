import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
      <h1 className="text-3xl font-bold tracking-tight">LaporPAK!</h1>
      <p className="mt-2 text-sm text-slate-400">
        Monorepo Setup Ready (Frontend + Backend API).
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
