import { Pool, type PoolConfig } from "pg";

// Prisma's pg adapter formats datetime parameters as UTC wall-clock strings.
// Explicit UTC sessions keep both stored instants and returned timestamptz
// values correct even when PostgreSQL's server timezone is not UTC.
export function createDatabasePool(connectionString: string, config: Pick<PoolConfig, "application_name"> = {}) {
  const url = new URL(connectionString);
  url.searchParams.set("options", `${url.searchParams.get("options") ?? ""} -c timezone=UTC`.trim());
  return new Pool({ ...config, connectionString: url.toString() });
}
