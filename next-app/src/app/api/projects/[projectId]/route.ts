import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().optional(),
  locationCode: z.number().nullable().optional(),
  locationName: z.string().nullable().optional(),
  ga4PropertyId: z.string().nullable().optional(),
  ga4PropertyName: z.string().nullable().optional(),
  gscSiteUrl: z.string().nullable().optional(),
  gscSiteLabel: z.string().nullable().optional(),
  performanceNotes: z.string().nullable().optional(),
});

async function canAccessProject(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === "admin") return true;
  const link = await prisma.userProject.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return !!link;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const canAccess = await canAccessProject(session.userId, session.role, projectId);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...project,
    performanceNotes: project.performanceNotes ? JSON.parse(project.performanceNotes) : undefined,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const canAccess = await canAccessProject(session.userId, session.role, projectId);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.locationCode !== undefined) data.locationCode = parsed.data.locationCode;
  if (parsed.data.locationName !== undefined) data.locationName = parsed.data.locationName;
  if (parsed.data.ga4PropertyId !== undefined) data.ga4PropertyId = parsed.data.ga4PropertyId;
  if (parsed.data.ga4PropertyName !== undefined) data.ga4PropertyName = parsed.data.ga4PropertyName;
  if (parsed.data.gscSiteUrl !== undefined) data.gscSiteUrl = parsed.data.gscSiteUrl;
  if (parsed.data.gscSiteLabel !== undefined) data.gscSiteLabel = parsed.data.gscSiteLabel;
  if (parsed.data.performanceNotes !== undefined) {
    data.performanceNotes = parsed.data.performanceNotes
      ? JSON.stringify(parsed.data.performanceNotes)
      : null;
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
  });

  return NextResponse.json({
    ...project,
    performanceNotes: project.performanceNotes ? JSON.parse(project.performanceNotes) : undefined,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const canAccess = await canAccessProject(session.userId, session.role, projectId);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
