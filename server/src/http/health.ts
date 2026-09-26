import type { FastifyInstance } from "fastify"

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({
      status: "ok",
      service: "remis-norte-api",
    })
  })
}
