import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#14b8a6",
          colorDanger: "#ef4444",
          colorSuccess: "#22c55e",
          colorWarning: "#f59e0b",
          colorBackground: "#111318",
          colorInputBackground: "#1a1d24",
          colorInputText: "#f0f0f3",
          colorText: "#e4e4e8",
          colorTextOnPrimaryBackground: "#ffffff",
          colorTextSecondary: "#9ca3af",
          colorNeutral: "#e4e4e8",
          borderRadius: "0.75rem",
          fontSize: "0.9375rem",
          spacingUnit: "1rem",
          fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        },
        elements: {
          // Root card
          rootBox: "w-full",
          card: "bg-[#111318] border border-white/[0.08] shadow-2xl shadow-black/40 rounded-2xl backdrop-blur-sm",

          // Header
          headerTitle: "text-white font-semibold text-xl",
          headerSubtitle: "text-zinc-400 text-sm",

          // Social / OAuth buttons
          socialButtonsBlockButton:
            "bg-[#1a1d24] border border-white/[0.08] text-zinc-200 hover:bg-white/[0.06] hover:border-white/[0.14] transition-all duration-200 rounded-xl font-medium",
          socialButtonsBlockButtonText: "text-zinc-200 font-medium",
          socialButtonsProviderIcon: "brightness-0 invert opacity-90",

          // Divider
          dividerLine: "bg-white/[0.08]",
          dividerText: "text-zinc-500 text-xs uppercase tracking-wider",

          // Form fields
          formFieldLabel: "text-zinc-300 font-medium text-sm",
          formFieldInput:
            "bg-[#1a1d24] border border-white/[0.08] text-white rounded-xl placeholder:text-zinc-500 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all duration-200",
          formFieldHintText: "text-zinc-500",
          formFieldErrorText: "text-red-400",
          formFieldSuccessText: "text-emerald-400",

          // Primary button
          formButtonPrimary:
            "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/20 transition-all duration-200 border-0",
          formButtonReset:
            "text-teal-400 hover:text-teal-300 transition-colors",

          // Footer
          footerAction: "text-zinc-400",
          footerActionLink: "text-teal-400 hover:text-teal-300 font-medium transition-colors",
          footerPagesLink: "text-zinc-500 hover:text-zinc-300",

          // User button (avatar dropdown)
          userButtonBox: "hover:opacity-80 transition-opacity",
          userButtonTrigger: "rounded-full ring-2 ring-white/[0.08] hover:ring-teal-500/40 transition-all duration-200",
          userButtonPopoverCard:
            "bg-[#111318] border border-white/[0.08] shadow-2xl shadow-black/60 rounded-2xl backdrop-blur-sm",
          userButtonPopoverActions: "border-t border-white/[0.06]",
          userButtonPopoverActionButton:
            "text-zinc-300 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all duration-150",
          userButtonPopoverActionButtonText: "text-zinc-300 font-medium",
          userButtonPopoverActionButtonIcon: "text-zinc-400",
          userButtonPopoverFooter: "border-t border-white/[0.06] hidden",

          // User preview (name/email in dropdown)
          userPreview: "gap-3",
          userPreviewMainIdentifier: "text-white font-semibold",
          userPreviewSecondaryIdentifier: "text-zinc-400 text-sm",
          userPreviewAvatarBox: "ring-2 ring-white/[0.08] rounded-full",

          // User profile modal
          profileSectionTitle: "text-white font-semibold border-b border-white/[0.06] pb-3",
          profileSectionContent: "text-zinc-300",
          profileSectionPrimaryButton: "text-teal-400 hover:text-teal-300",

          // Internal / badge / tags
          badge: "bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium",

          // Alerts
          alertText: "text-zinc-300",

          // Modal overlay
          modalBackdrop: "bg-black/60 backdrop-blur-sm",
          modalContent: "bg-[#111318] border border-white/[0.08] shadow-2xl rounded-2xl",

          // Identity preview in various contexts
          identityPreview: "bg-[#1a1d24] border border-white/[0.08] rounded-xl",
          identityPreviewText: "text-zinc-200",
          identityPreviewEditButton: "text-teal-400 hover:text-teal-300",

          // Other action buttons
          otherMethodsBlockButton:
            "bg-[#1a1d24] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.14] rounded-xl transition-all duration-200",

          // Navbar in profile/org views
          navbar: "bg-[#111318] border-r border-white/[0.06]",
          navbarButton: "text-zinc-300 hover:bg-white/[0.05] hover:text-white rounded-xl",
          navbarButtonIcon: "text-zinc-400",

          // Page / scrollbox
          pageScrollBox: "bg-[#111318]",
          page: "bg-[#111318] text-zinc-200",
        },
      }}
    >
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body className="min-h-screen font-sans antialiased">
          <ThemeInit />
          {children}
          <ToastContainer />
        </body>
      </html>
    </ClerkProvider>
  );
}
