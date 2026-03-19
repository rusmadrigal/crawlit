"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronsUpDown,
  ClipboardCheck,
  LayoutDashboard,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/components/providers/projects-provider";
import { Logo } from "@/components/layout/logo";

const navItems = [
  { segment: "", label: "Overview", icon: LayoutGrid },
  { segment: "keywords", label: "GAP Analysis", icon: Search },
  { segment: "backlinks", label: "Backlinks", icon: Link2 },
  { segment: "audit", label: "Site Audit", icon: ClipboardCheck },
  { segment: "ai", label: "AI Visibility", icon: Bot },
] as const;

export function Sidebar({
  projectId,
  collapsed,
  onToggleCollapsed,
}: {
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { projects, currentProject } = useProjects();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const segment =
    pathname === `/p/${projectId}` || pathname === `/p/${projectId}/`
      ? ""
      : pathname?.startsWith(`/p/${projectId}/`)
        ? pathname.replace(`/p/${projectId}`, "").split("/")[1] || "keywords"
        : "keywords";

  const projectLabel = currentProject ? currentProject.name : `Project: ${projectId}`;
  const projectTitle = currentProject ? currentProject.domain : undefined;

  if (collapsed) {
    return (
      <aside
        className="fixed left-0 top-0 z-40 flex h-screen w-12 flex-col items-center border-r border-slate-800 bg-slate-900 py-4"
        aria-label="Main navigation collapsed"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex size-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="Show sidebar"
          title="Show menu"
        >
          <PanelLeftOpen className="size-5" aria-hidden />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 ease-out"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-3 pr-2">
        <div className="min-w-0 flex-1">
          <Logo />
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="Hide sidebar"
          title="Hide menu"
        >
          <PanelLeftClose className="size-5" aria-hidden />
        </button>
      </div>
      <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ segment, label, icon: Icon }) => {
          const href = segment ? `/p/${projectId}/${segment}` : `/p/${projectId}`;
          const isActive = segment
            ? pathname === href || pathname.startsWith(href + "/")
            : pathname === href || pathname === href + "/";
          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-slate-800 p-3">
        <p className="px-3 text-xs font-medium uppercase tracking-wider text-slate-500">
          Project
        </p>
        <div className="relative" ref={projectDropdownRef}>
          <button
            type="button"
            onClick={() => setProjectDropdownOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/60"
            aria-expanded={projectDropdownOpen}
            aria-haspopup="listbox"
            aria-label="Switch project"
            title={projectTitle}
          >
            <span className="min-w-0 flex-1 truncate">{projectLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-500" aria-hidden />
          </button>
          {projectDropdownOpen && (
            <div
              className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg"
              role="listbox"
            >
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={segment ? `/p/${project.id}/${segment}` : `/p/${project.id}`}
                  onClick={() => setProjectDropdownOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors",
                    project.id === projectId ? "bg-slate-700 font-medium text-white" : "text-slate-300 hover:bg-slate-700/60"
                  )}
                  role="option"
                  aria-selected={project.id === projectId}
                >
                  <span className="block truncate">{project.name}</span>
                  <span className="block truncate text-xs opacity-70 text-slate-400">{project.domain}</span>
                </Link>
              ))}
              <div className="my-1 border-t border-slate-700" />
              <Link
                href="/"
                onClick={() => setProjectDropdownOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700/60"
                role="option"
              >
                <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                All projects
              </Link>
              <Link
                href="/"
                onClick={() => setProjectDropdownOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
                role="option"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                New project
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
