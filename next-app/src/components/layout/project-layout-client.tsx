"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { BannerApiKey } from "@/components/layout/banner-api-key";

const STORAGE_KEY = "crawit-sidebar-collapsed";

export function ProjectLayoutClient({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    setCollapsed(raw === "1");
  }, [mounted]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <Sidebar
        projectId={projectId}
        collapsed={mounted ? collapsed : false}
        onToggleCollapsed={toggleCollapsed}
      />
      <div
        className="flex flex-1 flex-col transition-[padding] duration-200 ease-out"
        style={{ paddingLeft: mounted && collapsed ? "3rem" : "16rem" }}
      >
        <TopBar projectId={projectId} />
        <BannerApiKey showWarning={false} showError={false} />
        <main className="flex-1 px-8 py-6 md:pl-10" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
