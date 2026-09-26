import assert from "node:assert/strict"
import { test } from "node:test"
import { loadConfig } from "../src/config/env.js"

test("PORT takes precedence over API_PORT", () => {
  assert.equal(loadConfig({ PORT: "8080", API_PORT: "3001" }).port, 8080)
})

test("API_PORT is used when PORT is absent", () => {
  assert.equal(loadConfig({ API_PORT: "3001" }).port, 3001)
})

test("the default port is used when PORT and API_PORT are absent", () => {
  assert.equal(loadConfig({}).port, 3001)
})

test("an invalid PORT fails clearly", () => {
  assert.throws(
    () => loadConfig({ PORT: "invalid" }),
    /PORT must be an integer between 1 and 65535/,
  )
})
