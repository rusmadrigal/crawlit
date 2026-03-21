"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/types/project";
import { getProjects, addProject as addProjectStorage, getProjectById, deleteProject as deleteProjectStorage, updateProject as updateProjectStorage, PROJECTS_STORAGE_KEY } from "@/lib/projects";

type ProjectsContextValue = {
  projects: Project[];
  /** False until we have read from localStorage (avoids showing "Create project" before load). */
  projectsLoaded: boolean;
  currentProjectId: string | null;
  currentProject: Project | null;
  addProject: (domain: string, name?: string, locationCode?: number, locationName?: string) => Project;
  deleteProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => Project | null;
  refreshProjects: () => void;
};

const ProjectsContext = React.createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = React.useState(false);

  const refreshProjects = React.useCallback(() => {
    setProjects(getProjects());
  }, []);

  React.useEffect(() => {
    setProjects(getProjects());
    setProjectsLoaded(true);
  }, [pathname]);

  // Sync projects when another tab changes localStorage
  React.useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === PROJECTS_STORAGE_KEY && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue) as unknown;
          setProjects(Array.isArray(parsed) ? parsed : getProjects());
        } catch {
          setProjects(getProjects());
        }
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const currentProjectId = React.useMemo(() => {
    const match = pathname?.match(/^\/p\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const currentProject = currentProjectId ? getProjectById(currentProjectId) ?? null : null;

  const addProject = React.useCallback(
    (domain: string, name?: string, locationCode?: number, locationName?: string) => {
      const project = addProjectStorage(domain, name, locationCode, locationName);
      setProjects(getProjects());
      return project;
    },
    []
  );

  const deleteProject = React.useCallback(
    (id: string) => {
      deleteProjectStorage(id);
      setProjects(getProjects());
      if (currentProjectId === id) {
        router.push("/");
      }
    },
    [currentProjectId, router]
  );

  const updateProject = React.useCallback((id: string, patch: Partial<Project>) => {
    const updated = updateProjectStorage(id, patch);
    setProjects(getProjects());
    return updated;
  }, []);

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
