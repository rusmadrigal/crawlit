"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export function TopBar({ projectId: _projectId }: { projectId: string }) {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-end gap-4 border-b px-6 backdrop-blur"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "var(--header-border)",
      }}
      role="banner"
    >
      <ThemeToggle />
    </header>
  );
}
