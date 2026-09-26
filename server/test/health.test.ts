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
    category: "CONFIGURATION",
    code: "DATABASE_URL_MISSING",
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
    ["SELF_SIGNED_CERT_IN_CHAIN", "TLS", "SELF_SIGNED_CERT_IN_CHAIN"],
    ["DEPTH_ZERO_SELF_SIGNED_CERT", "TLS", "DEPTH_ZERO_SELF_SIGNED_CERT"],
    ["CERT_HAS_EXPIRED", "TLS", "CERT_HAS_EXPIRED"],
  ]

  for (const [code, category, safeCode] of cases) {
    assert.deepEqual(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code })), {
      category,
      code: safeCode,
    })
  }

  assert.deepEqual(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code: "ERR_SSL_PRIVATE_DETAIL" })), {
    category: "TLS",
    code: "TLS_ERROR",
  })
  assert.deepEqual(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code: "PRIVATE_UNKNOWN_CODE" })), {
    category: "UNKNOWN",
    code: "UNCLASSIFIED",
  })
  for (const code of ["constructor", "__proto__"]) {
    assert.deepEqual(classifyDatabaseConnectivityError(Object.assign(new Error("ignored"), { code })), {
      category: "UNKNOWN",
      code: "UNCLASSIFIED",
    })
  }
  const revokedErrorProxy = Proxy.revocable({}, {})
  revokedErrorProxy.revoke()
  assert.deepEqual(classifyDatabaseConnectivityError(revokedErrorProxy.proxy), {
    category: "UNKNOWN",
    code: "UNCLASSIFIED",
  })
  assert.deepEqual(classifyDatabaseConnectivityError(new Error("ordinary failure")), {
    category: "UNKNOWN",
    code: "UNCLASSIFIED",
  })
  assert.deepEqual(
    classifyDatabaseConnectivityError(new Error("timeout exceeded when trying to connect")),
    { category: "TIMEOUT", code: "CONNECTION_TIMEOUT" },
  )
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
    category: "UNKNOWN",
    code: "UNCLASSIFIED",
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
    "event",
    "protocolAccepted",
  ])
})
