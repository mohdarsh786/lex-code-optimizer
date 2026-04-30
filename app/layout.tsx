import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lex Code Optimizer",
  description: "A full-stack compiler optimizer workspace with auth, persisted history, and runtime analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-slate-900 dark:text-slate-50">
        {children}
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgba(15, 23, 42, 0.88)",
              color: "#f8fafc",
              fontWeight: "500",
              borderRadius: "18px",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
              backdropFilter: "blur(18px)",
            },
            success: {
              duration: 3000,
            },
            error: {
              duration: 5000,
              style: {
                background: "rgba(127, 29, 29, 0.92)",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
