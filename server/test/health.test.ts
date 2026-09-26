import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { buildApp } from "../src/app/build-app.js"
import { requireDatabaseUrl } from "../src/infrastructure/prisma/client.js"

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
  const app = buildApp({
    databaseProbe: async () => {
      throw new Error("postgresql://user:secret@private-host/database")
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
})
