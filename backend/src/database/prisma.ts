import { PrismaPg } from "@prisma/adapter-pg";
import { createDatabasePool } from "./pool.js";

import { PrismaClient } from "../../generated/prisma/client.js"
import { env } from "../config/env.js";

const pool = createDatabasePool(env.DATABASE_URL);

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
    adapter,
});

export async function disconnectDatabase() {
  await prisma.$disconnect();
  await pool.end();
}
