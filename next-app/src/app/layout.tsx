import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ProjectsProvider } from "@/components/providers/projects-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Craw iT",
    template: "%s | Craw iT",
  },
  description:
    "Keyword research, domain overview, backlinks and site audits. Track multiple projects by domain with Craw iT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("seo-dashboard-theme");document.documentElement.classList.add(t==="dark"?"dark":"light");})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <ThemeProvider>
          <ProjectsProvider>{children}</ProjectsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
