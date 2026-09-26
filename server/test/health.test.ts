import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { buildApp } from "../src/app/build-app.js"
import { requireDatabaseUrl } from "../src/infrastructure/prisma/client.js"
import {
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
      const response = await app.inject({ method: "GET", url: "/ready" })
      process.stdout.write(JSON.stringify({ statusCode: response.statusCode, body: response.json() }))
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
    statusCode: 503,
    body: {
      status: "not_ready",
      service: "remis-norte-api",
      database: "unreachable",
    },
  })
  assert.deepEqual(JSON.parse(child.stderr.trim()), {
    event: "database_readiness_failed",
    diagnosticVersion: "R2",
    category: "CONFIGURATION",
    code: "DATABASE_URL_MISSING",
    errorKind: "ERROR",
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
  assert.equal(classifyDatabaseConnectivityError(new Error("timeout exceeded when trying to connect")).code, "CONNECTION_TIMEOUT")
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
    diagnosticVersion: "R2",
    category: "CONNECTION_REFUSED",
    code: "ECONNREFUSED",
    errorKind: "AGGREGATE",
    hasCause: true,
    hasAggregateChildren: true,
    aggregate: true,
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
      errorKind: "POSTGRES_ERROR",
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
    new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"),
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
    diagnosticVersion: "R2",
    category: "UNKNOWN",
    code: "UNCLASSIFIED",
    errorKind: "ERROR",
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
    "databaseUrlParseable",
    "databaseUrlPresent",
    "databaseUrlReferenceLiteral",
    "diagnosticVersion",
    "errorKind",
    "event",
    "hasAggregateChildren",
    "hasCause",
    "protocolAccepted",
  ])
})
