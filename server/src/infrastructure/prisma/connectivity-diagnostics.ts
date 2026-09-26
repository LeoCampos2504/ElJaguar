export type DatabaseConnectivityCategory =
  | "CONFIGURATION"
  | "DNS"
  | "CONNECTION_REFUSED"
  | "TIMEOUT"
  | "AUTHENTICATION"
  | "DATABASE_NOT_FOUND"
  | "TLS"
  | "NETWORK"
  | "INVALID_URL"
  | "UNKNOWN"

export interface ClassifiedDatabaseConnectivityError {
  category: DatabaseConnectivityCategory
  code: string
}

export interface DatabaseUrlDiagnosticFlags {
  databaseUrlPresent: boolean
  databaseUrlParseable: boolean
  databaseUrlReferenceLiteral: boolean
  protocolAccepted: boolean
}

export interface SafeDatabaseConnectivityDiagnostic
  extends ClassifiedDatabaseConnectivityError,
    DatabaseUrlDiagnosticFlags {
  event: "database_readiness_failed"
}

const codeClassifications: Record<string, ClassifiedDatabaseConnectivityError> = {
  ERR_INVALID_URL: { category: "INVALID_URL", code: "ERR_INVALID_URL" },
  ENOTFOUND: { category: "DNS", code: "ENOTFOUND" },
  EAI_AGAIN: { category: "DNS", code: "EAI_AGAIN" },
  ECONNREFUSED: { category: "CONNECTION_REFUSED", code: "ECONNREFUSED" },
  ETIMEDOUT: { category: "TIMEOUT", code: "ETIMEDOUT" },
  ECONNRESET: { category: "NETWORK", code: "ECONNRESET" },
  EHOSTUNREACH: { category: "NETWORK", code: "EHOSTUNREACH" },
  ENETUNREACH: { category: "NETWORK", code: "ENETUNREACH" },
  "28P01": { category: "AUTHENTICATION", code: "28P01" },
  "3D000": { category: "DATABASE_NOT_FOUND", code: "3D000" },
  SELF_SIGNED_CERT_IN_CHAIN: { category: "TLS", code: "SELF_SIGNED_CERT_IN_CHAIN" },
  DEPTH_ZERO_SELF_SIGNED_CERT: { category: "TLS", code: "DEPTH_ZERO_SELF_SIGNED_CERT" },
  CERT_HAS_EXPIRED: { category: "TLS", code: "CERT_HAS_EXPIRED" },
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined
  try {
    if (!("code" in error)) return undefined
    const code = (error as { code?: unknown }).code
    return typeof code === "string" ? code : undefined
  } catch {
    return undefined
  }
}

function isKnownConnectionTimeoutMessage(error: unknown): boolean {
  try {
    if (!(error instanceof Error)) return false
    const normalizedMessage = error.message.toLowerCase()
    return (
      normalizedMessage.includes("timeout exceeded when trying to connect") ||
      normalizedMessage.includes("connection terminated due to connection timeout")
    )
  } catch {
    return false
  }
}

export function classifyDatabaseConnectivityError(error: unknown): ClassifiedDatabaseConnectivityError {
  const code = getErrorCode(error)
  if (code !== undefined) {
    if (Object.hasOwn(codeClassifications, code)) return { ...codeClassifications[code] }
    if (code.startsWith("ERR_SSL_")) return { category: "TLS", code: "TLS_ERROR" }
    return { category: "UNKNOWN", code: "UNCLASSIFIED" }
  }

  if (isKnownConnectionTimeoutMessage(error)) {
    return { category: "TIMEOUT", code: "CONNECTION_TIMEOUT" }
  }

  return { category: "UNKNOWN", code: "UNCLASSIFIED" }
}

export function getDatabaseUrlDiagnosticFlags(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseUrlDiagnosticFlags {
  const connectionString = environment.DATABASE_URL
  const databaseUrlPresent = typeof connectionString === "string" && connectionString.trim().length > 0
  if (!databaseUrlPresent) {
    return {
      databaseUrlPresent: false,
      databaseUrlParseable: false,
      databaseUrlReferenceLiteral: false,
      protocolAccepted: false,
    }
  }

  const databaseUrlReferenceLiteral = /\$\{\{[^}]*\}\}/.test(connectionString)
  let databaseUrlParseable = false
  let protocolAccepted = false
  try {
    const parsedUrl = new URL(connectionString)
    databaseUrlParseable = true
    protocolAccepted = parsedUrl.protocol === "postgres:" || parsedUrl.protocol === "postgresql:"
  } catch {
    // Only boolean diagnostics escape this scope; never retain parsed URL fields.
  }

  return {
    databaseUrlPresent,
    databaseUrlParseable,
    databaseUrlReferenceLiteral,
    protocolAccepted,
  }
}

export function createSafeDatabaseConnectivityDiagnostic(
  error: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): SafeDatabaseConnectivityDiagnostic {
  const urlFlags = getDatabaseUrlDiagnosticFlags(environment)
  return {
    event: "database_readiness_failed",
    ...(urlFlags.databaseUrlPresent
      ? classifyDatabaseConnectivityError(error)
      : { category: "CONFIGURATION" as const, code: "DATABASE_URL_MISSING" }),
    ...urlFlags,
  }
}

export function logDatabaseConnectivityFailure(error: unknown): void {
  const safeDiagnostic = createSafeDatabaseConnectivityDiagnostic(error)
  console.error(JSON.stringify(safeDiagnostic))
}
