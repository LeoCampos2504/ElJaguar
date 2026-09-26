import { PrismaPg } from "@prisma/adapter-pg"
import { Pool, type PoolClient } from "pg"
import { statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { PrismaClient as GeneratedPrismaClient } from "../../../node_modules/.prisma/generated/client.js"
import {
  DatabaseRuntimeStageError,
  GeneratedClientEntryMissingError,
  logDatabaseConnectivityFailure,
  type DatabaseConnectivityStage,
  type GeneratedClientArtifactFlags,
} from "./connectivity-diagnostics.js"

type PrismaClientInstance = GeneratedPrismaClient

interface DatabaseRuntime {
  pool: Pool
  prisma: PrismaClientInstance
  generatedClientArtifacts: GeneratedClientArtifactFlags
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
  let generatedClientArtifacts: GeneratedClientArtifactFlags | undefined

  try {
    const connectionString = requireDatabaseUrl()

    stage = "POOL_CREATION"
    pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 })

    stage = "GENERATED_CLIENT_RESOLUTION"
    const generatedClientResolution = resolveGeneratedClientEntry()
    generatedClientArtifacts = generatedClientResolution.artifacts
    if (!generatedClientArtifacts.generatedClientEntryExists) {
      throw new GeneratedClientEntryMissingError()
    }

    stage = "GENERATED_CLIENT_IMPORT"
    const generatedClient = (await import(generatedClientResolution.url)) as typeof import("../../../node_modules/.prisma/generated/client.js")

    stage = "PRISMA_ADAPTER_CREATION"
    const adapter = new PrismaPg(pool)

    stage = "PRISMA_CLIENT_CREATION"
    const prisma = new generatedClient.PrismaClient({ adapter })
    return { pool, prisma, generatedClientArtifacts }
  } catch (error) {
    if (pool) await pool.end().catch(() => undefined)
    throw new DatabaseRuntimeStageError(stage, error, false, generatedClientArtifacts)
  }
}

function resolveGeneratedClientEntry(): {
  url: string
  artifacts: GeneratedClientArtifactFlags
} {
  const generatedClientDirectory = resolve(process.cwd(), "node_modules/.prisma/generated")
  const generatedClientEntry = resolve(generatedClientDirectory, "client.js")
  const generatedClientPackageMetadata = resolve(generatedClientDirectory, "package.json")

  const isDirectory = (path: string) => {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  }
  const isFile = (path: string) => {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  }

  return {
    url: pathToFileURL(generatedClientEntry).href,
    artifacts: {
      generatedClientDirectoryExists: isDirectory(generatedClientDirectory),
      generatedClientEntryExists: isFile(generatedClientEntry),
      generatedClientPackageMetadataExists: isFile(generatedClientPackageMetadata),
    },
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
      throw new DatabaseRuntimeStageError("POOL_CONNECT", error, true, runtime.generatedClientArtifacts)
    }

    try {
      client.release()
    } catch (error) {
      throw new DatabaseRuntimeStageError("CLIENT_RELEASE", error, true, runtime.generatedClientArtifacts)
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
