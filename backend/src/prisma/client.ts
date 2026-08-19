import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";
import { env } from "../config/env.js";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Explicit pool settings for Supabase cloud PostgreSQL.
  // Without these, pg defaults to max=10 connections with a 2s connection
  // acquisition timeout which causes "Unable to start a transaction in the
  // given time" errors under Supabase network latency.
  max: 5,                      // keep the pool small; Supabase free tier has a 60-connection limit
  connectionTimeoutMillis: 30_000,  // wait up to 30s to acquire a connection
  idleTimeoutMillis: 10_000,   // release idle connections after 10s
});

export const prisma = new PrismaClient({ adapter });
