import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const putSchema = z.object({ projectIds: z.array(z.string()) });

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "projectIds required" }, { status: 400 });
  }
  const { projectIds } = parsed.data;
  const uniqueIds = [...new Set(projectIds)];

  await prisma.userProject.deleteMany({ where: { userId } });
  if (uniqueIds.length > 0) {
    await prisma.userProject.createMany({
      data: uniqueIds.map((projectId) => ({ userId, projectId })),
    });
  }

  return NextResponse.json({ ok: true });
}
