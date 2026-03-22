import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugFromDomain, normalizeDomain } from "@/lib/projects";
import { z } from "zod";

const createSchema = z.object({
  domain: z.string().min(1),
  name: z.string().optional(),
  locationCode: z.number().optional(),
  locationName: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === "admin") {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      projects.map((p) => ({
        id: p.id,
        domain: p.domain,
        name: p.name,
        locationCode: p.locationCode,
        locationName: p.locationName,
        ga4PropertyId: p.ga4PropertyId,
        ga4PropertyName: p.ga4PropertyName,
        gscSiteUrl: p.gscSiteUrl,
        gscSiteLabel: p.gscSiteLabel,
        performanceNotes: p.performanceNotes ? JSON.parse(p.performanceNotes) : undefined,
        createdAt: p.createdAt,
      }))
    );
  }

  const userProjects = await prisma.userProject.findMany({
    where: { userId: session.userId },
    include: { project: true },
  });
  const projects = userProjects.map((up) => {
    const p = up.project;
    return {
      ...p,
      performanceNotes: p.performanceNotes ? JSON.parse(p.performanceNotes) : undefined,
    };
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { domain, name, locationCode, locationName } = parsed.data;
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const existingIds = (await prisma.project.findMany({ select: { id: true } })).map((p) => p.id);
  const baseId = slugFromDomain(normalized);
  let id = baseId;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${baseId}-${n}`;
    n++;
  }

  const project = await prisma.project.create({
    data: {
      id,
      domain: normalized,
      name: name?.trim() || normalized,
      locationCode: locationCode ?? null,
      locationName: locationName?.trim() || null,
    },
  });

  await prisma.userProject.create({
    data: { userId: session.userId, projectId: project.id },
  });

  return NextResponse.json({
    ...project,
    performanceNotes: project.performanceNotes ? JSON.parse(project.performanceNotes) : undefined,
  });
}
