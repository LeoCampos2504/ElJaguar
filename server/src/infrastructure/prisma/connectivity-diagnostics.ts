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
  | "RUNTIME_ARTIFACT"
  | "TLS"
  | "NETWORK"
  | "INVALID_URL"
  | "UNKNOWN"

export type DatabaseErrorKind = "AGGREGATE" | "ERROR" | "TYPE_ERROR" | "POSTGRES_ERROR" | "UNKNOWN"
export type ConnectionEncryption = "SSL" | "NONE" | "UNKNOWN"
export type DatabaseConnectivityStage =
  | "DATABASE_URL_VALIDATION"
  | "POOL_CREATION"
  | "GENERATED_CLIENT_RESOLUTION"
  | "GENERATED_CLIENT_IMPORT"
  | "PRISMA_ADAPTER_CREATION"
  | "PRISMA_CLIENT_CREATION"
  | "POOL_CONNECT"
  | "CLIENT_RELEASE"
  | "UNKNOWN"
export type ErrorCodeFamily = "NONE" | "NODE_ERR" | "OS_NETWORK" | "POSTGRES_SQLSTATE" | "OTHER"

export interface GeneratedClientArtifactFlags {
  generatedClientDirectoryExists: boolean
  generatedClientEntryExists: boolean
  generatedClientPackageMetadataExists: boolean
}

export class DatabaseRuntimeStageError extends Error {
  constructor(
    readonly stage: DatabaseConnectivityStage,
    readonly originalError: unknown,
    readonly databaseRuntimeInitialized: boolean,
    readonly generatedClientArtifacts?: GeneratedClientArtifactFlags,
  ) {
    super("Database runtime stage failed")
  }
}

export class GeneratedClientEntryMissingError extends Error {
  constructor() {
    super("Generated Prisma client entry is missing")
  }
}

export interface ChildDatabaseConnectivityDiagnostic {
  category: DatabaseConnectivityCategory
  code: string
  addressFamily: 0 | 4 | 6
}

export interface ClassifiedDatabaseConnectivityError {
  category: DatabaseConnectivityCategory
  code: string
  stage: DatabaseConnectivityStage
  errorKind: DatabaseErrorKind
  databaseRuntimeInitialized: boolean
  generatedClientDirectoryExists?: boolean
  generatedClientEntryExists?: boolean
  generatedClientPackageMetadataExists?: boolean
  errorCodePresent: boolean
  errorCodeFamily: ErrorCodeFamily
  hasCause: boolean
  hasAggregateChildren: boolean
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
  diagnosticVersion: "R3"
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
const NODE_MODULE_ERROR_CODES = new Set([
  "ERR_MODULE_NOT_FOUND",
  "MODULE_NOT_FOUND",
  "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "ERR_UNSUPPORTED_DIR_IMPORT",
  "ERR_UNKNOWN_FILE_EXTENSION",
])
const OS_NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
])
const DATABASE_CONNECTIVITY_STAGES = new Set<DatabaseConnectivityStage>([
  "DATABASE_URL_VALIDATION",
  "POOL_CREATION",
  "GENERATED_CLIENT_RESOLUTION",
  "GENERATED_CLIENT_IMPORT",
  "PRISMA_ADAPTER_CREATION",
  "PRISMA_CLIENT_CREATION",
  "POOL_CONNECT",
  "CLIENT_RELEASE",
  "UNKNOWN",
])

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
  ERR_MODULE_NOT_FOUND: { category: "RUNTIME_ARTIFACT", code: "ERR_MODULE_NOT_FOUND" },
  MODULE_NOT_FOUND: { category: "RUNTIME_ARTIFACT", code: "MODULE_NOT_FOUND" },
  ERR_PACKAGE_PATH_NOT_EXPORTED: { category: "RUNTIME_ARTIFACT", code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
  ERR_UNSUPPORTED_DIR_IMPORT: { category: "RUNTIME_ARTIFACT", code: "ERR_UNSUPPORTED_DIR_IMPORT" },
  ERR_UNKNOWN_FILE_EXTENSION: { category: "RUNTIME_ARTIFACT", code: "ERR_UNKNOWN_FILE_EXTENSION" },
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

function getErrorContext(error: unknown): {
  originalError: unknown
  stage: DatabaseConnectivityStage
  databaseRuntimeInitialized: boolean
  generatedClientArtifacts: Partial<GeneratedClientArtifactFlags>
} {
  try {
    if (error instanceof DatabaseRuntimeStageError) {
      return {
        originalError: error.originalError,
        stage: DATABASE_CONNECTIVITY_STAGES.has(error.stage) ? error.stage : "UNKNOWN",
        databaseRuntimeInitialized: error.databaseRuntimeInitialized,
        generatedClientArtifacts: {
          ...(typeof error.generatedClientArtifacts?.generatedClientDirectoryExists === "boolean"
            ? { generatedClientDirectoryExists: error.generatedClientArtifacts.generatedClientDirectoryExists }
            : {}),
          ...(typeof error.generatedClientArtifacts?.generatedClientEntryExists === "boolean"
            ? { generatedClientEntryExists: error.generatedClientArtifacts.generatedClientEntryExists }
            : {}),
          ...(typeof error.generatedClientArtifacts?.generatedClientPackageMetadataExists === "boolean"
            ? { generatedClientPackageMetadataExists: error.generatedClientArtifacts.generatedClientPackageMetadataExists }
            : {}),
        },
      }
    }
  } catch {
    // Revoked proxies or hostile objects fall back to an UNKNOWN-safe context.
  }
  return {
    originalError: error,
    stage: "UNKNOWN",
    databaseRuntimeInitialized: false,
    generatedClientArtifacts: {},
  }
}

function getErrorCodeFamily(code: string | undefined): ErrorCodeFamily {
  if (code === undefined) return "NONE"
  if (NODE_MODULE_ERROR_CODES.has(code)) return "NODE_ERR"
  if (OS_NETWORK_ERROR_CODES.has(code)) return "OS_NETWORK"
  if (SQLSTATE_PATTERN.test(code)) return "POSTGRES_SQLSTATE"
  return "OTHER"
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

function classifyBasicError(error: unknown, stage: DatabaseConnectivityStage): BasicClassification {
  const code = getErrorCode(error)

  try {
    if (error instanceof GeneratedClientEntryMissingError) {
      return { category: "RUNTIME_ARTIFACT", code: "GENERATED_CLIENT_ENTRY_MISSING" }
    }
  } catch {
    // Continue with the safe code-only classification.
  }

  if (stage === "POOL_CONNECT") {
    const message = getMessage(error)
    if (message?.includes(SASL_PASSWORD_PATTERN)) {
      return { category: "CONFIGURATION", code: "SASL_PASSWORD_NOT_STRING" }
    }
    if (message?.includes("The server does not support SSL connections")) {
      return { category: "TLS", code: "SERVER_SSL_UNSUPPORTED" }
    }
    if (message?.includes("The server requires encryption")) {
      return { category: "TLS", code: "SERVER_REQUIRES_ENCRYPTION" }
    }
    if (message?.includes("Connection terminated unexpectedly")) {
      return { category: "NETWORK", code: "CONNECTION_TERMINATED_UNEXPECTEDLY" }
    }
  }

  if (code === "28000") {
    const message = getMessage(error)
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

  if (stage === "POOL_CONNECT") {
    const normalizedMessage = getMessage(error)?.toLowerCase()
    if (
      normalizedMessage?.includes("timeout exceeded when trying to connect") ||
      normalizedMessage?.includes("connection terminated due to connection timeout")
    ) {
      return { category: "TIMEOUT", code: "CONNECTION_TIMEOUT" }
    }
  }

  return { category: "UNKNOWN", code: "UNCLASSIFIED" }
}

function summarizeAggregateChildren(
  children: unknown[],
  stage: DatabaseConnectivityStage,
): ChildDatabaseConnectivityDiagnostic[] {
  return children.slice(0, MAX_CHILD_ERRORS).map((child) => {
    const classification = classifyBasicError(child, stage)
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
    "RUNTIME_ARTIFACT",
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
  const context = getErrorContext(error)
  const sourceError = context.originalError
  const children = getAggregateChildren(sourceError)
  const aggregate = isAggregateError(sourceError) || children !== undefined
  const errorCode = getErrorCode(sourceError)
  const errorKind = getErrorKind(sourceError, errorCode, aggregate)
  const childSummaries = aggregate ? summarizeAggregateChildren(children ?? [], context.stage) : undefined
  const base = aggregate
    ? classifyAggregate(childSummaries ?? [])
    : classifyBasicError(sourceError, context.stage)

  const result: ClassifiedDatabaseConnectivityError = {
    ...base,
    stage: context.stage,
    errorKind,
    databaseRuntimeInitialized: context.databaseRuntimeInitialized,
    ...context.generatedClientArtifacts,
    errorCodePresent: errorCode !== undefined,
    errorCodeFamily: getErrorCodeFamily(errorCode),
    hasCause: hasCause(sourceError),
    hasAggregateChildren: children !== undefined,
  }

  if (aggregate) {
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
    diagnosticVersion: "R3",
    ...safeClassification,
    ...urlFlags,
  }
}

export function logDatabaseConnectivityFailure(error: unknown): void {
  const safeDiagnostic = createSafeDatabaseConnectivityDiagnostic(error)
  console.error(JSON.stringify(safeDiagnostic))
}
