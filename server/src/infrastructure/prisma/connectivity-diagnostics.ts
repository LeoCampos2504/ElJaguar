import { isIP } from "node:net"

export type DatabaseConnectivityCategory =
  | "CONFIGURATION"
  | "DNS"
  | "CONNECTION_REFUSED"
  | "TIMEOUT"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "DATABASE_NOT_FOUND"
  | "DATABASE_NOT_READY"
  | "CONNECTION_LIMIT"
  | "POSTGRES_CONNECTION"
  | "TLS"
  | "NETWORK"
  | "INVALID_URL"
  | "UNKNOWN"

export type DatabaseErrorKind = "AGGREGATE" | "ERROR" | "TYPE_ERROR" | "POSTGRES_ERROR" | "UNKNOWN"
export type ConnectionEncryption = "SSL" | "NONE" | "UNKNOWN"

export interface ChildDatabaseConnectivityDiagnostic {
  category: DatabaseConnectivityCategory
  code: string
  addressFamily: 0 | 4 | 6
}

export interface ClassifiedDatabaseConnectivityError {
  category: DatabaseConnectivityCategory
  code: string
  errorKind: DatabaseErrorKind
  hasCause: boolean
  hasAggregateChildren: boolean
  aggregate?: true
  childErrorCount?: number
  childErrors?: ChildDatabaseConnectivityDiagnostic[]
  sqlstateClass?: string
  pgHbaRejected?: boolean
  connectionEncryption?: ConnectionEncryption
}

export interface DatabaseUrlDiagnosticFlags {
  databaseUrlPresent: boolean
  databaseUrlParseable: boolean
  databaseUrlReferenceLiteral: boolean
  protocolAccepted: boolean
}

export interface SafeDatabaseConnectivityDiagnostic extends ClassifiedDatabaseConnectivityError, DatabaseUrlDiagnosticFlags {
  event: "database_readiness_failed"
  diagnosticVersion: "R2"
}

interface BasicClassification {
  category: DatabaseConnectivityCategory
  code: string
  sqlstateClass?: string
  pgHbaRejected?: boolean
  connectionEncryption?: ConnectionEncryption
}

const MAX_CHILD_ERRORS = 6
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/
const PG_HBA_PATTERN = "no pg_hba.conf entry"
const SASL_PASSWORD_PATTERN = "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"

const codeClassifications: Record<string, BasicClassification> = {
  ERR_INVALID_URL: { category: "INVALID_URL", code: "ERR_INVALID_URL" },
  ENOTFOUND: { category: "DNS", code: "ENOTFOUND" },
  EAI_AGAIN: { category: "DNS", code: "EAI_AGAIN" },
  ECONNREFUSED: { category: "CONNECTION_REFUSED", code: "ECONNREFUSED" },
  ETIMEDOUT: { category: "TIMEOUT", code: "ETIMEDOUT" },
  ECONNRESET: { category: "NETWORK", code: "ECONNRESET" },
  EHOSTUNREACH: { category: "NETWORK", code: "EHOSTUNREACH" },
  ENETUNREACH: { category: "NETWORK", code: "ENETUNREACH" },
  ENETDOWN: { category: "NETWORK", code: "ENETDOWN" },
  "08000": { category: "POSTGRES_CONNECTION", code: "08000" },
  "08001": { category: "POSTGRES_CONNECTION", code: "08001" },
  "08003": { category: "POSTGRES_CONNECTION", code: "08003" },
  "08004": { category: "POSTGRES_CONNECTION", code: "08004" },
  "08006": { category: "POSTGRES_CONNECTION", code: "08006" },
  "08007": { category: "POSTGRES_CONNECTION", code: "08007" },
  "08P01": { category: "POSTGRES_CONNECTION", code: "08P01" },
  "28P01": { category: "AUTHENTICATION", code: "28P01" },
  "28000": { category: "AUTHORIZATION", code: "28000", pgHbaRejected: false },
  "3D000": { category: "DATABASE_NOT_FOUND", code: "3D000" },
  "57P03": { category: "DATABASE_NOT_READY", code: "57P03" },
  "53300": { category: "CONNECTION_LIMIT", code: "53300" },
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

function getMessage(error: unknown): string | undefined {
  try {
    if (error instanceof Error && typeof error.message === "string") return error.message
  } catch {
    return undefined
  }
  return undefined
}

function getAggregateChildren(error: unknown): unknown[] | undefined {
  if (typeof error !== "object" || error === null) return undefined
  try {
    const errors = (error as { errors?: unknown }).errors
    return Array.isArray(errors) ? errors : undefined
  } catch {
    return undefined
  }
}

function isAggregateError(error: unknown): boolean {
  try {
    return error instanceof AggregateError
  } catch {
    return false
  }
}

function hasCause(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  try {
    if (!("cause" in error)) return false
    const cause = (error as { cause?: unknown }).cause
    return cause !== undefined && cause !== null
  } catch {
    return false
  }
}

function getErrorKind(error: unknown, code: string | undefined, aggregate: boolean): DatabaseErrorKind {
  if (aggregate) return "AGGREGATE"
  if (code && SQLSTATE_PATTERN.test(code)) return "POSTGRES_ERROR"
  try {
    if (error instanceof TypeError) return "TYPE_ERROR"
    if (error instanceof Error) return "ERROR"
  } catch {
    return "UNKNOWN"
  }
  return "UNKNOWN"
}

function getAddressFamily(error: unknown): 0 | 4 | 6 {
  if (typeof error !== "object" || error === null) return 0
  try {
    const address = (error as { address?: unknown }).address
    if (typeof address !== "string") return 0
    const family = isIP(address)
    return family === 4 || family === 6 ? family : 0
  } catch {
    return 0
  }
}

function classifyBasicError(error: unknown): BasicClassification {
  const code = getErrorCode(error)
  const message = getMessage(error)

  if (message?.includes(SASL_PASSWORD_PATTERN)) {
    return { category: "CONFIGURATION", code: "SASL_PASSWORD_NOT_STRING" }
  }

  if (code === "28000") {
    if (!message?.includes(PG_HBA_PATTERN)) {
      return { category: "AUTHORIZATION", code: "28000", pgHbaRejected: false }
    }

    const hasSslEncryption = message.includes("SSL encryption")
    const hasNoEncryption = message.includes("no encryption")
    const connectionEncryption: ConnectionEncryption =
      hasSslEncryption === hasNoEncryption ? "UNKNOWN" : hasSslEncryption ? "SSL" : "NONE"
    return {
      category: "AUTHORIZATION",
      code: "PG_HBA_REJECTED",
      pgHbaRejected: true,
      connectionEncryption,
    }
  }

  if (code !== undefined) {
    if (Object.hasOwn(codeClassifications, code)) return { ...codeClassifications[code] }
    if (SQLSTATE_PATTERN.test(code)) {
      return { category: "UNKNOWN", code: "POSTGRES_UNCLASSIFIED", sqlstateClass: code.slice(0, 2) }
    }
    if (code.startsWith("ERR_SSL_")) return { category: "TLS", code: "TLS_ERROR" }
    return { category: "UNKNOWN", code: "UNCLASSIFIED" }
  }

  const normalizedMessage = message?.toLowerCase()
  if (
    normalizedMessage?.includes("timeout exceeded when trying to connect") ||
    normalizedMessage?.includes("connection terminated due to connection timeout")
  ) {
    return { category: "TIMEOUT", code: "CONNECTION_TIMEOUT" }
  }

  return { category: "UNKNOWN", code: "UNCLASSIFIED" }
}

function summarizeAggregateChildren(children: unknown[]): ChildDatabaseConnectivityDiagnostic[] {
  return children.slice(0, MAX_CHILD_ERRORS).map((child) => {
    const classification = classifyBasicError(child)
    return {
      category: classification.category,
      code: classification.code,
      addressFamily: getAddressFamily(child),
    }
  })
}

function classifyAggregate(children: ChildDatabaseConnectivityDiagnostic[]): BasicClassification {
  const priority: DatabaseConnectivityCategory[] = [
    "CONNECTION_REFUSED",
    "TIMEOUT",
    "DNS",
    "NETWORK",
    "POSTGRES_CONNECTION",
    "AUTHENTICATION",
    "AUTHORIZATION",
    "DATABASE_NOT_FOUND",
    "DATABASE_NOT_READY",
    "CONNECTION_LIMIT",
    "TLS",
    "CONFIGURATION",
    "INVALID_URL",
  ]

  for (const category of priority) {
    const child = children.find((candidate) => candidate.category === category)
    if (child) return { category: child.category, code: child.code }
  }
  return { category: "UNKNOWN", code: "UNCLASSIFIED" }
}

export function classifyDatabaseConnectivityError(error: unknown): ClassifiedDatabaseConnectivityError {
  const children = getAggregateChildren(error)
  const aggregate = isAggregateError(error) || children !== undefined
  const errorCode = getErrorCode(error)
  const errorKind = getErrorKind(error, errorCode, aggregate)
  const childSummaries = aggregate ? summarizeAggregateChildren(children ?? []) : undefined
  const base = aggregate
    ? classifyAggregate(childSummaries ?? [])
    : classifyBasicError(error)

  const result: ClassifiedDatabaseConnectivityError = {
    ...base,
    errorKind,
    hasCause: hasCause(error),
    hasAggregateChildren: children !== undefined,
  }

  if (aggregate) {
    result.aggregate = true
    result.childErrorCount = children?.length ?? 0
    result.childErrors = childSummaries ?? []
  }
  if (base.sqlstateClass) result.sqlstateClass = base.sqlstateClass
  if (base.pgHbaRejected !== undefined) result.pgHbaRejected = base.pgHbaRejected
  if (base.connectionEncryption) result.connectionEncryption = base.connectionEncryption
  return result
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

  return { databaseUrlPresent, databaseUrlParseable, databaseUrlReferenceLiteral, protocolAccepted }
}

export function createSafeDatabaseConnectivityDiagnostic(
  error: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): SafeDatabaseConnectivityDiagnostic {
  const urlFlags = getDatabaseUrlDiagnosticFlags(environment)
  const classification = classifyDatabaseConnectivityError(error)
  const safeClassification = urlFlags.databaseUrlPresent
    ? classification
    : { ...classification, category: "CONFIGURATION" as const, code: "DATABASE_URL_MISSING" }

  return {
    event: "database_readiness_failed",
    diagnosticVersion: "R2",
    ...safeClassification,
    ...urlFlags,
  }
}

export function logDatabaseConnectivityFailure(error: unknown): void {
  const safeDiagnostic = createSafeDatabaseConnectivityDiagnostic(error)
  console.error(JSON.stringify(safeDiagnostic))
}
