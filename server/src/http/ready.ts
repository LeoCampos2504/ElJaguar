import type { FastifyInstance } from "fastify"

export type DatabaseProbe = () => Promise<void>

export function registerReadyRoute(app: FastifyInstance, databaseProbe: DatabaseProbe): void {
  app.get("/ready", async (_request, reply) => {
    try {
      await databaseProbe()
      return reply.code(200).send({
        status: "ready",
        service: "remis-norte-api",
        database: "reachable",
      })
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        service: "remis-norte-api",
        database: "unreachable",
      })
    }
  })
}
