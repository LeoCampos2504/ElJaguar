import { buildApp } from "./app/build-app.js"
import { loadConfig } from "./config/env.js"

const config = loadConfig()
const app = buildApp()

try {
  await app.listen({ host: "0.0.0.0", port: config.port })
} catch {
  console.error("API startup failed")
  process.exit(1)
}
