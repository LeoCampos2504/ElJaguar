import { buildApp } from "./app/build-app.js"
import { loadConfig } from "./config/env.js"

const config = loadConfig()
const app = buildApp()

try {
  await app.listen({ host: "0.0.0.0", port: config.port })

  let shutdownPromise: Promise<void> | undefined
  const shutdown = () => {
    shutdownPromise ??= app.close().catch(() => {
      console.error("API shutdown failed")
      process.exitCode = 1
    })
    return shutdownPromise
  }

  process.once("SIGINT", () => void shutdown())
  process.once("SIGTERM", () => void shutdown())
} catch {
  console.error("API startup failed")
  process.exit(1)
}
