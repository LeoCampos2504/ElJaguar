import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { buildApp } from "../src/app/build-app.js"
import { requireDatabaseUrl } from "../src/infrastructure/prisma/client.js"
import {
  DatabaseRuntimeStageError,
  GeneratedClientEntryMissingError,
  classifyDatabaseConnectivityError,
  createSafeDatabaseConnectivityDiagnostic,
  getDatabaseUrlDiagnosticFlags,
  logDatabaseConnectivityFailure,
} from "../src/infrastructure/prisma/connectivity-diagnostics.js"

test("GET /health returns the minimal API health contract", async () => {
  let databaseProbeCalls = 0
  const app = buildApp({
    databaseProbe: async () => {
      databaseProbeCalls += 1
    },
  })

  try {
    const response = await app.inject({ method: "GET", url: "/health" })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      status: "ok",
      service: "remis-norte-api",
    })
    assert.equal(databaseProbeCalls, 0)
  } finally {
    await app.close()
  }
})

test("GET /ready reports a successful database probe", async () => {
  const app = buildApp({ databaseProbe: async () => {} })

  try {
    const response = await app.inject({ method: "GET", url: "/ready" })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      status: "ready",
      service: "remis-norte-api",
      database: "reachable",
    })
  } finally {
    await app.close()
  }
})

test("GET /ready sanitizes database probe failures", async () => {
  const sensitiveError = new Error("postgresql://user:secret@private-host/database")
  sensitiveError.stack = "fake secret material in stack"
  const app = buildApp({
    databaseProbe: async () => {
      throw sensitiveError
    },
  })

  try {
    const response = await app.inject({ method: "GET", url: "/ready" })
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), {
      status: "not_ready",
      service: "remis-norte-api",
      database: "unreachable",
    })
    assert.equal(response.body.includes("postgresql://"), false)
    assert.equal(response.body.includes("secret"), false)
    assert.equal(response.body.includes("private-host"), false)
    assert.equal(response.body.includes("DATABASE_URL"), false)
    assert.equal(response.body.includes("fake secret material"), false)
  } finally {
    await app.close()
  }
})

test("a missing DATABASE_URL is rejected explicitly without pg defaults", () => {
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required for database access/)
})

test("GET /ready returns sanitized 503 when DATABASE_URL and pg defaults are absent", () => {
  const script = `
    import { buildApp } from "./src/app/build-app.js"
    const app = buildApp()
    try {
      const health = await app.inject({ method: "GET", url: "/health" })
      const ready = await app.inject({ method: "GET", url: "/ready" })
      process.stdout.write(JSON.stringify({
        health: { statusCode: health.statusCode, body: health.json() },
        ready: { statusCode: ready.statusCode, body: ready.json() },
      }))
    } finally {
      await app.close()
    }
  `
  const env = {
    PATH: process.env.PATH ?? "",
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
    ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
  }
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    timeout: 10_000,
  })

  assert.equal(child.status, 0, child.stderr)
  assert.deepEqual(JSON.parse(child.stdout), {
    health: {
      statusCode: 200,
      body: {
        status: "ok",
        service: "remis-norte-api",
      },
    },
    ready: {
      statusCode: 503,
      body: {
        status: "not_ready",
        service: "remis-norte-api",
        database: "unreachable",
      },
    },
  })
  assert.deepEqual(JSON.parse(child.stderr.trim()), {
    event: "database_readiness_failed",
    diagnosticVersion: "R3",
    category: "CONFIGURATION",
    code: "DATABASE_URL_MISSING",
    stage: "DATABASE_URL_VALIDATION",
    errorKind: "ERROR",
    databaseRuntimeInitialized: false,
    errorCodePresent: false,
    errorCodeFamily: "NONE",
    hasCause: false,
    hasAggregateChildren: false,
    databaseUrlPresent: false,
    databaseUrlParseable: false,
    databaseUrlReferenceLiteral: false,
    protocolAccepted: false,
  })
})

test("database connectivity classifier maps only allowlisted PostgreSQL and network codes", () => {
  const cases: Array<[string, string, string]> = [
    ["ENOTFOUND", "DNS", "ENOTFOUND"],
    ["EAI_AGAIN", "DNS", "EAI_AGAIN"],
    ["ECONNREFUSED", "CONNECTION_REFUSED", "ECONNREFUSED"],
    ["ETIMEDOUT", "TIMEOUT", "ETIMEDOUT"],
    ["28P01", "AUTHENTICATION", "28P01"],
    ["3D000", "DATABASE_NOT_FOUND", "3D000"],
    ["ERR_INVALID_URL", "INVALID_URL", "ERR_INVALID_URL"],
    ["ECONNRESET", "NETWORK", "ECONNRESET"],
    ["EHOSTUNREACH", "NETWORK", "EHOSTUNREACH"],
    ["ENETUNREACH", "NETWORK", "ENETUNREACH"],
    ["ENETDOWN", "NETWORK", "ENETDOWN"],
    ["SELF_SIGNED_CERT_IN_CHAIN", "TLS", "SELF_SIGNED_CERT_IN_CHAIN"],
    ["DEPTH_ZERO_SELF_SIGNED_CERT", "TLS", "DEPTH_ZERO_SELF_SIGNED_CERT"],
    ["CERT_HAS_EXPIRED", "TLS", "CERT_HAS_EXPIRED"],
  ]

  for (const [code, category, safeCode] of cases) {
    const result = classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code }))
    assert.equal(result.category, category)
    assert.equal(result.code, safeCode)
    assert.equal(result.errorKind, /^[0-9A-Z]{5}$/.test(code) ? "POSTGRES_ERROR" : "ERROR")
    assert.equal(result.hasCause, false)
    assert.equal(result.hasAggregateChildren, false)
  }

  assert.equal(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code: "ERR_SSL_PRIVATE_DETAIL" })).code, "TLS_ERROR")
  assert.equal(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code: "PRIVATE_UNKNOWN_CODE" })).code, "UNCLASSIFIED")
  for (const code of ["constructor", "__proto__"]) {
    assert.equal(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code })).code, "UNCLASSIFIED")
  }
  const revokedErrorProxy = Proxy.revocable({}, {})
  revokedErrorProxy.revoke()
  assert.equal(classifyDatabaseConnectivityError(revokedErrorProxy.proxy).code, "UNCLASSIFIED")
  assert.equal(classifyDatabaseConnectivityError(new Error("ordinary failure")).code, "UNCLASSIFIED")
  assert.equal(classifyDatabaseConnectivityError(new TypeError("invalid input")).errorKind, "TYPE_ERROR")
  assert.equal(classifyDatabaseConnectivityError({ arbitrary: true }).errorKind, "UNKNOWN")
  assert.equal(
    classifyDatabaseConnectivityError(
      new DatabaseRuntimeStageError("POOL_CONNECT", new Error("timeout exceeded when trying to connect"), true),
    ).code,
    "CONNECTION_TIMEOUT",
  )
})

test("AggregateError children are classified safely with only address families", () => {
  const ipv6Child = Object.assign(new Error("fake ipv6 2001:db8::beef"), {
    code: "ENETUNREACH",
    address: "2001:db8::beef",
  })
  const ipv4Child = Object.assign(new Error("fake ipv4 192.0.2.44"), {
    code: "ECONNREFUSED",
    address: "192.0.2.44",
  })
  const aggregate = new AggregateError(
    [ipv6Child, ipv4Child],
    "postgresql://fakeuser:fakepassword@secret.internal/fakedb",
    { cause: new Error("fake cause secret material") },
  )
  const result = createSafeDatabaseConnectivityDiagnostic(aggregate, {
    DATABASE_URL: "postgresql://fakeuser:fakepassword@secret.internal/fakedb",
  })

  assert.deepEqual(result, {
    event: "database_readiness_failed",
    diagnosticVersion: "R3",
    category: "CONNECTION_REFUSED",
    code: "ECONNREFUSED",
    stage: "UNKNOWN",
    errorKind: "AGGREGATE",
    databaseRuntimeInitialized: false,
    errorCodePresent: false,
    errorCodeFamily: "NONE",
    hasCause: true,
    hasAggregateChildren: true,
    childErrorCount: 2,
    childErrors: [
      { category: "NETWORK", code: "ENETUNREACH", addressFamily: 6 },
      { category: "CONNECTION_REFUSED", code: "ECONNREFUSED", addressFamily: 4 },
    ],
    databaseUrlPresent: true,
    databaseUrlParseable: true,
    databaseUrlReferenceLiteral: false,
    protocolAccepted: true,
  })

  const serialized = JSON.stringify(result)
  for (const forbidden of [
    "2001:db8::beef",
    "192.0.2.44",
    "fakeuser",
    "fakepassword",
    "secret.internal",
    "fakedb",
    "postgresql://",
    "fake cause secret material",
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }

  const manyChildren = new AggregateError(
    Array.from({ length: 8 }, (_, index) => Object.assign(new Error("network"), { code: "ENETUNREACH", address: `192.0.2.${index + 1}` })),
    "many children",
  )
  const bounded = classifyDatabaseConnectivityError(manyChildren)
  assert.equal(bounded.childErrorCount, 8)
  assert.equal(bounded.childErrors?.length, 6)
})

test("PostgreSQL SQLSTATE startup codes are allowlisted and unknown SQLSTATEs expose only their class", () => {
  for (const code of ["08000", "08001", "08003", "08004", "08006", "08007", "08P01"]) {
    const result = classifyDatabaseConnectivityError(Object.assign(new Error("private postgres detail"), { code }))
    assert.equal(result.category, "POSTGRES_CONNECTION")
    assert.equal(result.code, code)
    assert.equal(result.errorKind, "POSTGRES_ERROR")
  }
  assert.deepEqual(
    classifyDatabaseConnectivityError(Object.assign(new Error("private"), { code: "ZZ999" })),
    {
      category: "UNKNOWN",
      code: "POSTGRES_UNCLASSIFIED",
      stage: "UNKNOWN",
      errorKind: "POSTGRES_ERROR",
      databaseRuntimeInitialized: false,
      errorCodePresent: true,
      errorCodeFamily: "POSTGRES_SQLSTATE",
      hasCause: false,
      hasAggregateChildren: false,
      sqlstateClass: "ZZ",
    },
  )
  assert.equal(classifyDatabaseConnectivityError(Object.assign(new Error("private"), { code: "57P03" })).category, "DATABASE_NOT_READY")
  assert.equal(classifyDatabaseConnectivityError(Object.assign(new Error("private"), { code: "53300" })).category, "CONNECTION_LIMIT")
})

test("pg_hba and SASL messages yield only safe classifications", () => {
  const pgHbaError = Object.assign(
    new Error("no pg_hba.conf entry for host 192.0.2.80, user fakeuser, database fakedb, SSL encryption"),
    { code: "28000" },
  )
  const pgHbaDiagnostic = createSafeDatabaseConnectivityDiagnostic(pgHbaError, {
    DATABASE_URL: "postgresql://fakeuser:fakepassword@secret.internal/fakedb",
  })
  assert.deepEqual(
    {
      category: pgHbaDiagnostic.category,
      code: pgHbaDiagnostic.code,
      pgHbaRejected: pgHbaDiagnostic.pgHbaRejected,
      connectionEncryption: pgHbaDiagnostic.connectionEncryption,
    },
    {
      category: "AUTHORIZATION",
      code: "PG_HBA_REJECTED",
      pgHbaRejected: true,
      connectionEncryption: "SSL",
    },
  )
  const safePgHba = JSON.stringify(pgHbaDiagnostic)
  for (const forbidden of ["192.0.2.80", "fakeuser", "fakedb", "secret.internal", "fakepassword", "no pg_hba.conf entry"]) {
    assert.equal(safePgHba.includes(forbidden), false)
  }

  const noEncryption = classifyDatabaseConnectivityError(Object.assign(new Error("no pg_hba.conf entry; no encryption"), { code: "28000" }))
  assert.equal(noEncryption.connectionEncryption, "NONE")
  const genericAuthorization = classifyDatabaseConnectivityError(Object.assign(new Error("authorization denied"), { code: "28000" }))
  assert.equal(genericAuthorization.code, "28000")
  assert.equal(genericAuthorization.pgHbaRejected, false)

  const sasl = classifyDatabaseConnectivityError(
    new DatabaseRuntimeStageError(
      "POOL_CONNECT",
      new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"),
      true,
    ),
  )
  assert.equal(sasl.category, "CONFIGURATION")
  assert.equal(sasl.code, "SASL_PASSWORD_NOT_STRING")
  assert.equal(JSON.stringify(sasl).includes("client password"), false)
})

test("DATABASE_URL diagnostics expose booleans only", () => {
  assert.deepEqual(getDatabaseUrlDiagnosticFlags({}), {
    databaseUrlPresent: false,
    databaseUrlParseable: false,
    databaseUrlReferenceLiteral: false,
    protocolAccepted: false,
  })
  assert.deepEqual(
    getDatabaseUrlDiagnosticFlags({ DATABASE_URL: "postgresql://fakeuser:fakepassword@secret.internal:5432/fakedb" }),
    {
      databaseUrlPresent: true,
      databaseUrlParseable: true,
      databaseUrlReferenceLiteral: false,
      protocolAccepted: true,
    },
  )
  assert.deepEqual(getDatabaseUrlDiagnosticFlags({ DATABASE_URL: "${{Postgres.DATABASE_URL}}" }), {
    databaseUrlPresent: true,
    databaseUrlParseable: false,
    databaseUrlReferenceLiteral: true,
    protocolAccepted: false,
  })
  assert.deepEqual(getDatabaseUrlDiagnosticFlags({ DATABASE_URL: "not a URL" }), {
    databaseUrlPresent: true,
    databaseUrlParseable: false,
    databaseUrlReferenceLiteral: false,
    protocolAccepted: false,
  })
  assert.deepEqual(getDatabaseUrlDiagnosticFlags({ DATABASE_URL: "https://example.invalid" }), {
    databaseUrlPresent: true,
    databaseUrlParseable: true,
    databaseUrlReferenceLiteral: false,
    protocolAccepted: false,
  })
})

test("safe diagnostic log never includes error or connection secrets", () => {
  const fakeError = new Error(
    "postgresql://fakeuser:fakepassword@secret.internal:5432/fakedb timeout exceeded when trying to connect",
  )
  fakeError.stack = "fake secret material from stack"
  Object.assign(fakeError, { code: "UNLISTED_PRIVATE_CODE" })

  const safeDiagnostic = createSafeDatabaseConnectivityDiagnostic(fakeError, {
    DATABASE_URL: "postgresql://fakeuser:fakepassword@secret.internal:5432/fakedb",
  })
  assert.deepEqual(safeDiagnostic, {
    event: "database_readiness_failed",
    diagnosticVersion: "R3",
    category: "UNKNOWN",
    code: "UNCLASSIFIED",
    stage: "UNKNOWN",
    errorKind: "ERROR",
    databaseRuntimeInitialized: false,
    errorCodePresent: true,
    errorCodeFamily: "OTHER",
    hasCause: false,
    hasAggregateChildren: false,
    databaseUrlPresent: true,
    databaseUrlParseable: true,
    databaseUrlReferenceLiteral: false,
    protocolAccepted: true,
  })

  const originalConsoleError = console.error
  const output: string[] = []
  console.error = (...args) => output.push(args.map(String).join(" "))
  try {
    logDatabaseConnectivityFailure(fakeError)
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(output.length, 1)
  for (const forbidden of ["fakeuser", "fakepassword", "secret.internal", "fakedb", "postgresql://", "fake secret material", "UNLISTED_PRIVATE_CODE"]) {
    assert.equal(output[0].includes(forbidden), false)
  }
  assert.deepEqual(Object.keys(JSON.parse(output[0])).sort(), [
    "category",
    "code",
    "databaseRuntimeInitialized",
    "databaseUrlParseable",
    "databaseUrlPresent",
    "databaseUrlReferenceLiteral",
    "diagnosticVersion",
    "errorCodeFamily",
    "errorCodePresent",
    "errorKind",
    "event",
    "hasAggregateChildren",
    "hasCause",
    "protocolAccepted",
    "stage",
  ])
})

test("R3 reports generated client resolution failure with booleans and no filesystem path", () => {
  const diagnostic = createSafeDatabaseConnectivityDiagnostic(
    new DatabaseRuntimeStageError(
      "GENERATED_CLIENT_RESOLUTION",
      new GeneratedClientEntryMissingError(),
      false,
      {
        generatedClientDirectoryExists: true,
        generatedClientEntryExists: false,
        generatedClientPackageMetadataExists: false,
      },
    ),
    { DATABASE_URL: "postgresql://fake:secret@db.invalid/fake" },
  )

  assert.equal(diagnostic.stage, "GENERATED_CLIENT_RESOLUTION")
  assert.equal(diagnostic.category, "RUNTIME_ARTIFACT")
  assert.equal(diagnostic.code, "GENERATED_CLIENT_ENTRY_MISSING")
  assert.equal(diagnostic.databaseRuntimeInitialized, false)
  assert.equal(diagnostic.generatedClientDirectoryExists, true)
  assert.equal(diagnostic.generatedClientEntryExists, false)
  assert.equal(diagnostic.generatedClientPackageMetadataExists, false)
  assert.equal(JSON.stringify(diagnostic).includes("node_modules"), false)
})

test("R3 allowlists Node module errors without exposing paths in their messages", () => {
  const diagnostic = createSafeDatabaseConnectivityDiagnostic(
    new DatabaseRuntimeStageError(
      "GENERATED_CLIENT_IMPORT",
      Object.assign(new Error("Cannot find module C:\\private\\fake-project\\node_modules\\generated\\client.js"), {
        code: "ERR_MODULE_NOT_FOUND",
      }),
      false,
      {
        generatedClientDirectoryExists: true,
        generatedClientEntryExists: true,
        generatedClientPackageMetadataExists: false,
      },
    ),
    { DATABASE_URL: "postgresql://fake:secret@db.invalid/fake" },
  )

  assert.equal(diagnostic.category, "RUNTIME_ARTIFACT")
  assert.equal(diagnostic.code, "ERR_MODULE_NOT_FOUND")
  assert.equal(diagnostic.errorCodePresent, true)
  assert.equal(diagnostic.errorCodeFamily, "NODE_ERR")
  assert.equal(diagnostic.stage, "GENERATED_CLIENT_IMPORT")
  const serialized = JSON.stringify(diagnostic)
  assert.equal(serialized.includes("C:\\\\private"), false)
  assert.equal(serialized.includes("fake-project"), false)

  const otherErr = classifyDatabaseConnectivityError(
    Object.assign(new Error("private module detail"), { code: "ERR_PRIVATE_DETAIL" }),
  )
  assert.equal(otherErr.category, "UNKNOWN")
  assert.equal(otherErr.code, "UNCLASSIFIED")
  assert.equal(otherErr.errorCodeFamily, "OTHER")
})

test("R3 distinguishes Prisma client creation from pool connection failures", () => {
  const clientCreation = classifyDatabaseConnectivityError(
    new DatabaseRuntimeStageError("PRISMA_CLIENT_CREATION", new Error("private constructor detail"), false),
  )
  assert.equal(clientCreation.stage, "PRISMA_CLIENT_CREATION")
  assert.equal(clientCreation.category, "UNKNOWN")
  assert.equal(clientCreation.code, "UNCLASSIFIED")
  assert.equal(clientCreation.databaseRuntimeInitialized, false)

  const poolConnect = classifyDatabaseConnectivityError(
    new DatabaseRuntimeStageError(
      "POOL_CONNECT",
      Object.assign(new Error("private socket detail"), { code: "ECONNREFUSED" }),
      true,
    ),
  )
  assert.equal(poolConnect.stage, "POOL_CONNECT")
  assert.equal(poolConnect.databaseRuntimeInitialized, true)
  assert.equal(poolConnect.category, "CONNECTION_REFUSED")
  assert.equal(poolConnect.code, "ECONNREFUSED")
  assert.equal(poolConnect.errorCodeFamily, "OS_NETWORK")
})

test("R3 pool-connect message fingerprints map only to fixed safe codes", () => {
  const cases: Array<[string, string, string]> = [
    ["The server does not support SSL connections; private host db.internal", "TLS", "SERVER_SSL_UNSUPPORTED"],
    ["The server requires encryption for private-user", "TLS", "SERVER_REQUIRES_ENCRYPTION"],
    ["Connection terminated unexpectedly at 10.1.2.3", "NETWORK", "CONNECTION_TERMINATED_UNEXPECTEDLY"],
    ["SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string secret", "CONFIGURATION", "SASL_PASSWORD_NOT_STRING"],
  ]

  for (const [message, category, code] of cases) {
    const result = classifyDatabaseConnectivityError(
      new DatabaseRuntimeStageError("POOL_CONNECT", new Error(message), true),
    )
    assert.equal(result.category, category)
    assert.equal(result.code, code)
    assert.equal(JSON.stringify(result).includes(message), false)
  }

  const beforePoolConnect = classifyDatabaseConnectivityError(
    new DatabaseRuntimeStageError(
      "PRISMA_CLIENT_CREATION",
      new Error("The server does not support SSL connections"),
      false,
    ),
  )
  assert.equal(beforePoolConnect.category, "UNKNOWN")
  assert.equal(beforePoolConnect.code, "UNCLASSIFIED")
})

test("R3 safe diagnostic leaks none of synthetic URL, Railway, path, identity, or IP values", () => {
  const secretValues = [
    "fake-user-r3",
    "fake-password-r3",
    "railway-fake-r3.internal",
    "fake-database-r3",
    "C:\\private\\fake-project-r3\\node_modules\\.prisma\\generated\\client.js",
    "192.0.2.201",
    "2001:db8::201",
    "postgresql://fake-user-r3:fake-password-r3@railway-fake-r3.internal:5432/fake-database-r3",
  ]
  const children = [
    Object.assign(new Error(secretValues[4]), { code: "ENETUNREACH", address: secretValues[6] }),
    Object.assign(new Error(secretValues[4]), { code: "ECONNREFUSED", address: secretValues[5] }),
  ]
  const sensitiveAggregate = new AggregateError(children, secretValues[7], { cause: new Error(secretValues[1]) })
  const diagnostic = createSafeDatabaseConnectivityDiagnostic(
    new DatabaseRuntimeStageError("POOL_CONNECT", sensitiveAggregate, true, {
      generatedClientDirectoryExists: true,
      generatedClientEntryExists: true,
      generatedClientPackageMetadataExists: true,
    }),
    { DATABASE_URL: secretValues[7] },
  )

  const serialized = JSON.stringify(diagnostic)
  for (const secret of secretValues) assert.equal(serialized.includes(secret), false)
  assert.equal(diagnostic.diagnosticVersion, "R3")
  assert.equal(diagnostic.stage, "POOL_CONNECT")
  assert.equal(diagnostic.databaseRuntimeInitialized, true)
  assert.equal(diagnostic.childErrorCount, 2)
  assert.equal(diagnostic.childErrors?.[0].addressFamily, 6)
  assert.equal(diagnostic.childErrors?.[1].addressFamily, 4)
})
