import { PrismaClient } from "@/generated/prisma";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url =
  (process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : null) ??
  "file:./dev.db";

const adapter = new PrismaLibSql({ url });
export const prisma = new PrismaClient({ adapter });
