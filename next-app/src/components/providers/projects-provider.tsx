"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/types/project";

function toProject(p: Record<string, unknown>): Project {
  return {
    id: String(p.id),
    domain: String(p.domain),
    name: String(p.name),
    ...(p.locationCode != null ? { locationCode: Number(p.locationCode) } : {}),
    ...(p.locationName ? { locationName: String(p.locationName) } : {}),
    ...(p.ga4PropertyId ? { ga4PropertyId: String(p.ga4PropertyId) } : {}),
    ...(p.ga4PropertyName ? { ga4PropertyName: String(p.ga4PropertyName) } : {}),
    ...(p.gscSiteUrl ? { gscSiteUrl: String(p.gscSiteUrl) } : {}),
    ...(p.gscSiteLabel ? { gscSiteLabel: String(p.gscSiteLabel) } : {}),
    ...(p.performanceNotes ? { performanceNotes: p.performanceNotes as Project["performanceNotes"] } : {}),
    createdAt: p.createdAt ? new Date(p.createdAt as string).toISOString() : new Date().toISOString(),
  };
}

type ProjectsContextValue = {
  projects: Project[];
  projectsLoaded: boolean;
  currentProjectId: string | null;
  currentProject: Project | null;
  addProject: (domain: string, name?: string, locationCode?: number, locationName?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<Project | null>;
  refreshProjects: () => Promise<void>;
};

const ProjectsContext = React.createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = React.useState(false);

  const refreshProjects = React.useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>[];
        setProjects(data.map(toProject));
      }
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects, pathname]);

  const currentProjectId = React.useMemo(() => {
    const match = pathname?.match(/^\/p\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const currentProject = React.useMemo(
    () => (currentProjectId ? projects.find((p) => p.id === currentProjectId) ?? null : null),
    [currentProjectId, projects]
  );

  const addProject = React.useCallback(
    async (domain: string, name?: string, locationCode?: number, locationName?: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, name, locationCode, locationName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create project");
      }
      const data = (await res.json()) as Record<string, unknown>;
      const project = toProject(data);
      await refreshProjects();
      return project;
    },
    [refreshProjects]
  );

  const deleteProject = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await refreshProjects();
      if (currentProjectId === id) router.push("/");
    },
    [currentProjectId, router, refreshProjects]
  );

  const updateProject = React.useCallback(
    async (id: string, patch: Partial<Project>) => {
      const body: Record<string, unknown> = { ...patch };
      if (patch.performanceNotes) body.performanceNotes = JSON.stringify(patch.performanceNotes);
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const project = toProject(data);
      await refreshProjects();
      return project;
    },
    [refreshProjects]
  );

  const value = React.useMemo<ProjectsContextValue>(
    () => ({
      projects,
      projectsLoaded,
      currentProjectId,
      currentProject,
      addProject,
      deleteProject,
      updateProject,
      refreshProjects,
    }),
    [projects, projectsLoaded, currentProjectId, currentProject, addProject, deleteProject, updateProject, refreshProjects]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = React.useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
