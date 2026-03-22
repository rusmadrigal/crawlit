import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url =
  (process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : null) ?? "file:./dev.db";
const adapter = new PrismaLibSql({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(adminPassword, 10);

  const existing = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (existing) {
    console.log(`Admin user "${adminUsername}" already exists. Updating password.`);
    await prisma.user.update({
      where: { username: adminUsername },
      data: { passwordHash: hash, role: "admin" },
    });
  } else {
    await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash: hash,
        role: "admin",
      },
    });
    console.log(`Created admin user: ${adminUsername}`);
  }
  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
