import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ToastContainer from "@/components/ui/ToastContainer";
import ThemeInit from "@/components/ui/ThemeInit";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LaunchPadAI — From Idea to Production with AI Agents",
  description:
    "Your AI co-founder. Multi-agent pipelines guide you from idea validation through PRD, architecture, and go-to-market — all through conversation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeInit />
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
