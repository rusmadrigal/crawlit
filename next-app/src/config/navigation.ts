import {
  Bot,
  ClipboardCheck,
  Link2,
  Search,
  type LucideIcon,
} from "lucide-react";

export const projectNavItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  matchSegment: string;
}[] = [
  { href: "/p/[projectId]/keywords", label: "GAP Analysis", icon: Search, matchSegment: "keywords" },
  { href: "/p/[projectId]/backlinks", label: "Backlinks", icon: Link2, matchSegment: "backlinks" },
  { href: "/p/[projectId]/audit", label: "Site Audit", icon: ClipboardCheck, matchSegment: "audit" },
  { href: "/p/[projectId]/ai", label: "AI Visibility", icon: Bot, matchSegment: "ai" },
];

export function getProjectNavWithParams(projectId: string) {
  return projectNavItems.map((item) => ({
    ...item,
    href: item.href.replace("[projectId]", projectId),
  }));
}
