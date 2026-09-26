import { PrismaPg } from "@prisma/adapter-pg"
import { Pool, type PoolClient } from "pg"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { PrismaClient as GeneratedPrismaClient } from "../../../node_modules/.prisma/generated/client.js"
import { logDatabaseConnectivityFailure } from "./connectivity-diagnostics.js"

type PrismaClientInstance = GeneratedPrismaClient

interface DatabaseRuntime {
  pool: Pool
  prisma: PrismaClientInstance
}

let runtimePromise: Promise<DatabaseRuntime> | undefined

export function requireDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const connectionString = environment.DATABASE_URL
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error("DATABASE_URL is required for database access")
  }
  return connectionString
}

async function createDatabaseRuntime(): Promise<DatabaseRuntime> {
  const connectionString = requireDatabaseUrl()
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 })

  try {
    const generatedClientUrl = pathToFileURL(
      resolve(process.cwd(), "node_modules/.prisma/generated/client.js"),
    ).href
    const generatedClient = (await import(generatedClientUrl)) as typeof import("../../../node_modules/.prisma/generated/client.js")
    const adapter = new PrismaPg(pool)
    const prisma = new generatedClient.PrismaClient({ adapter })
    return { pool, prisma }
  } catch (error) {
    await pool.end()
    throw error
  }
}

export async function getDatabaseRuntime(): Promise<DatabaseRuntime> {
  if (!runtimePromise) {
    runtimePromise = createDatabaseRuntime()
  }

  const pendingRuntime = runtimePromise
  try {
    return await pendingRuntime
  } catch (error) {
    if (runtimePromise === pendingRuntime) {
      runtimePromise = undefined
    }
    throw error
  }
}

export async function probeDatabaseConnection(): Promise<void> {
  try {
    const { pool } = await getDatabaseRuntime()
    let client: PoolClient | undefined

    try {
      client = await pool.connect()
    } finally {
      client?.release()
    }
  } catch (error) {
    logDatabaseConnectivityFailure(error)
    throw error
  }
}

export async function closeDatabaseRuntime(): Promise<void> {
  const pendingRuntime = runtimePromise
  if (!pendingRuntime) return

  runtimePromise = undefined
  const runtime = await pendingRuntime.catch(() => undefined)
  if (!runtime) return

  try {
    await runtime.prisma.$disconnect()
  } finally {
    await runtime.pool.end()
  }
}
