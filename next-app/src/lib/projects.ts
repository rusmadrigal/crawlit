import type { Project } from "@/types/project";

export const PROJECTS_STORAGE_KEY = "crawit-projects";

export function getProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

/** Normalize domain for display and slug: strip protocol, lowercase, trim. */
export function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim() || input.trim();
}

/** Generate a URL-safe id from domain (e.g. example.com -> example-com). */
export function slugFromDomain(domain: string): string {
  const normalized = normalizeDomain(domain);
  return normalized.replace(/\./g, "-").replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "project";
}

export function createProjectId(domain: string, existingIds: string[]): string {
  const id = slugFromDomain(domain);
  const set = new Set(existingIds);
  if (!set.has(id)) return id;
  let n = 2;
  while (set.has(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

export function addProject(
  domain: string,
  name?: string,
  locationCode?: number,
  locationName?: string
): Project {
  const normalized = normalizeDomain(domain);
  const projects = getProjects();
  const id = createProjectId(normalized, projects.map((p) => p.id));
  const project: Project = {
    id,
    domain: normalized,
    name: name?.trim() || normalized,
    ...(locationCode != null && { locationCode }),
    ...(locationName != null && locationName.trim() && { locationName: locationName.trim() }),
    createdAt: new Date().toISOString(),
  };
  saveProjects([...projects, project]);
  return project;
}

export function getProjectById(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function deleteProject(id: string): void {
  saveProjects(getProjects().filter((p) => p.id !== id));
}

export function updateProject(id: string, patch: Partial<Project>): Project | null {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const next: Project = { ...projects[idx], ...patch };
  const updated = [...projects];
  updated[idx] = next;
  saveProjects(updated);
  return next;
}
