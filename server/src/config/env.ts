export type Environment = "local" | "test" | "production"

export interface AppConfig {
  port: number
  environment: Environment
}

const DEFAULT_PORT = 3001

function parsePort(rawPort: string | undefined, variableName: "PORT" | "API_PORT"): number {
  if (rawPort === undefined) return DEFAULT_PORT

  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${variableName} must be an integer between 1 and 65535`)
  }

  return port
}

function parseEnvironment(rawEnvironment: string | undefined): Environment {
  const environment = (rawEnvironment ?? "local").trim().toLowerCase()
  if (environment === "local" || environment === "test" || environment === "production") {
    return environment
  }

  throw new Error("ENVIRONMENT must be one of: local, test, production")
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = env.PORT !== undefined
    ? parsePort(env.PORT, "PORT")
    : parsePort(env.API_PORT, "API_PORT")

  return {
    port,
    environment: parseEnvironment(env.ENVIRONMENT),
  }
}
