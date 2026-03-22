import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  projectIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      projects: { include: { project: { select: { id: true, name: true, domain: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      projectIds: u.projects.map((p) => p.project.id),
      projects: u.projects.map((p) => ({ id: p.project.id, name: p.project.name, domain: p.project.domain })),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    const first = parsed.error.issues?.[0];
    return NextResponse.json(
      { error: (first?.message as string) ?? "Invalid data" },
      { status: 400 }
    );
  }
  const { username, password, projectIds } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hash,
      role: "client",
    },
  });

  if (projectIds?.length) {
    await prisma.userProject.createMany({
      data: projectIds.map((projectId) => ({ userId: user.id, projectId })),
    });
  }

  const withProjects = await prisma.user.findUnique({
    where: { id: user.id },
    include: { projects: { include: { project: true } } },
  });

  return NextResponse.json({
    id: withProjects!.id,
    username: withProjects!.username,
    role: withProjects!.role,
    projectIds: withProjects!.projects.map((p) => p.project.id),
  });
}
