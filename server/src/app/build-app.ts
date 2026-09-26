import Fastify, { type FastifyInstance } from "fastify"
import { registerHealthRoute } from "../http/health.js"
import { registerReadyRoute, type DatabaseProbe } from "../http/ready.js"
import { closeDatabaseRuntime, probeDatabaseConnection } from "../infrastructure/prisma/client.js"

export function buildApp(options: { databaseProbe?: DatabaseProbe } = {}): FastifyInstance {
  const app = Fastify({ logger: false })
  registerHealthRoute(app)
  registerReadyRoute(app, options.databaseProbe ?? probeDatabaseConnection)
  app.addHook("onClose", async () => {
    await closeDatabaseRuntime()
  })
  return app
}
