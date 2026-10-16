import "./globals.css";
import React from "react";

export const metadata = {
  title: "Proctored Assessment Platform",
  description: "Real-time candidate monitoring and WebRTC screen sharing environment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">{children}</body>
    </html>
  );
}