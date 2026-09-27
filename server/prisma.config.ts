import { defineConfig } from "prisma/config"

const placeholderDatabaseUrl = "postgresql://USER:PASSWORD@HOST:5432/DATABASE"

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? placeholderDatabaseUrl,
  },
})
