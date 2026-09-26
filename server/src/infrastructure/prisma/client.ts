import { PrismaClient as GeneratedPrismaClient } from "../../generated/prisma/client.ts"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool, type PoolClient } from "pg"
import {
  DatabaseRuntimeStageError,
  logDatabaseConnectivityFailure,
  type DatabaseConnectivityStage,
} from "./connectivity-diagnostics.js"

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
  let stage: DatabaseConnectivityStage = "DATABASE_URL_VALIDATION"
  let pool: Pool | undefined

  try {
    const connectionString = requireDatabaseUrl()

    stage = "POOL_CREATION"
    pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 })

    stage = "PRISMA_ADAPTER_CREATION"
    const adapter = new PrismaPg(pool)

    stage = "PRISMA_CLIENT_CREATION"
    const prisma = new GeneratedPrismaClient({ adapter })
    return { pool, prisma }
  } catch (error) {
    if (pool) await pool.end().catch(() => undefined)
    throw new DatabaseRuntimeStageError(stage, error, false)
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
    const runtime = await getDatabaseRuntime()
    let client: PoolClient
    try {
      client = await runtime.pool.connect()
    } catch (error) {
      throw new DatabaseRuntimeStageError("POOL_CONNECT", error, true)
    }

    try {
      client.release()
    } catch (error) {
      throw new DatabaseRuntimeStageError("CLIENT_RELEASE", error, true)
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
