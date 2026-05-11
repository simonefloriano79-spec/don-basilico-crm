"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#2e2820",
            color: "#f0e6d3",
            border: "1px solid #3d3428",
            fontFamily: "var(--font-dm-sans)",
          },
          success: { iconTheme: { primary: "#4a9e6b", secondary: "#2e2820" } },
          error: { iconTheme: { primary: "#c84040", secondary: "#2e2820" } },
        }}
      />
    </SessionProvider>
  );
}
