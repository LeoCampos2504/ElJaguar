# Checkpoint — PHASE_2A_PRISMA_FOUNDATION

Fecha: 2026-09-25
Proyecto: `remis-norte-prototipo`
Rama: `main`

## Scope

Se implementó únicamente la fundación Prisma/PostgreSQL, sin conexión ni mutación de ninguna base de datos:

- Prisma CLI y Prisma Client instalados sólo en `server/`.
- Versiones alineadas `7.10.0`.
- Configuración moderna `prisma.config.ts` compatible con Prisma 7.
- `prisma/schema.prisma` mínimo con generator Prisma Client y datasource PostgreSQL.
- No se agregaron modelos de negocio.
- `.env.example` con contrato seguro y placeholder no operativo.
- Scripts seguros de validate y generate.
- No se creó wrapper de Prisma porque esta fase no tiene modelos ni uso de DB; queda diferido a PHASE_2B.

No se implementaron User, Session, Agency, Driver, Vehicle, Trip, TripOffer, DispatchSearch, DriverLocation, Fare, Zone, worker, auth, migraciones ni SQL.

## Phase 1 recovery and preflight

- `PHASE_1_COMMIT_SHA=1002489235b1a633aa764602825ff970010e8ed0`.
- El commit corresponde a `feat: add backend Fastify skeleton`.
- El contenido del commit coincide exclusivamente con los paths autorizados de PHASE_1.
- Rama actual: `main`.
- Worktree antes de esta fase: limpio.
- Phase 1 typecheck baseline: PASS.
- Phase 1 tests baseline: PASS; 1 test, 0 fallos.
- Phase 1 build baseline: PASS.

## Node, NPM and Prisma compatibility

- Node.js: `v24.18.0`.
- NPM: `11.16.0`.
- Prisma estable seleccionada: `7.10.0`.
- Prisma Client seleccionado: `7.10.0`.
- La metadata de NPM declara compatibilidad de Prisma 7.10.0 con Node `^20.19 || ^22.12 || >=24.0`; el Node actual es compatible.
- No se cambió Node ni se instalaron herramientas globales.
- No se agregó `pg`, `postgres`, `drizzle`, `typeorm`, `sequelize`, `dotenv`, `zod`, Redis, queues ni plugins Fastify.

## Prisma configuration

La versión instalada utiliza `prisma.config.ts`. El archivo vive en `server/` para resolver `prisma/config` desde las dependencias locales del backend, mientras conserva `prisma/schema.prisma` en la raíz del proyecto según la arquitectura aprobada.

```text
server/prisma.config.ts
  schema = ../prisma/schema.prisma
  datasource.url = process.env.DATABASE_URL o placeholder seguro
```

La configuración usa sólo un placeholder:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

No es una URL real, no contiene credenciales y no se creó `.env`.

## Schema foundation

El schema declara únicamente:

- `generator client` con `provider = "prisma-client"` y output dentro de `server/node_modules/.prisma/generated`.
- `datasource db` con `provider = "postgresql"`.

No contiene bloques `model`, enums de negocio, índices, relaciones, migrations ni SQL. El output generado es un artefacto ignorado dentro de `node_modules` y no forma parte del commit.

## Scripts

Se conservaron intactos los scripts existentes y se agregaron sólo:

- `npm run prisma:validate` → `prisma validate --config=./prisma.config.ts`.
- `npm run prisma:generate` → `prisma generate --config=./prisma.config.ts`.

No se agregaron `db:migrate`, `db:deploy`, `db:push`, `db:reset`, `db:seed` ni scripts equivalentes.

## Validation

- `npm run prisma:validate`: PASS.
- `npm run prisma:generate`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS; 1 test, 0 fallos.
- `npm run build`: PASS.
- Smoke local: PASS; `GET http://127.0.0.1:3001/health` respondió HTTP 200 con `{ "status": "ok", "service": "remis-norte-api" }`. El proceso fue detenido después.
- El endpoint health no importa Prisma ni consulta DB.

La CLI fue inspeccionada antes de ejecutar los comandos y sólo se ejecutaron `validate` y `generate`; ninguno conecta ni muta una base de datos.

## Negative gates

- `DATABASE_CREATED=NO`.
- `DATABASE_CONNECTED=NO`.
- `DATABASE_QUERIED=NO`.
- `DATABASE_MUTATED=NO`.
- `MIGRATIONS_CREATED=NO`.
- `SQL_EXECUTED=NO`.
- `prisma/migrations/` no existe.
- No se ejecutaron `migrate dev`, `migrate deploy`, `migrate reset`, `db push` ni `db pull`.
- No existe `.env` real.
- No se creó Docker, PostgreSQL local/remoto, Railway ni Production.

## Domain gates

Todos los siguientes quedan en `NO`: User, Session, Agency, PassengerProfile, Driver, Vehicle, Trip, TripOffer, DispatchSearch, DriverLocation, Fare, Zone, AuditLog, IdempotencyRecord y worker.

La política documental se preserva sin contradicciones:

```text
MIGRATION_SOURCE_OF_TRUTH=VERSION_CONTROLLED_MIGRATION_HISTORY
PRISMA_DB_PUSH_PRODUCTION=FORBIDDEN
CUSTOM_SQL_MIGRATIONS_POLICY=ALLOWED_AND_REQUIRED_WHEN_NEEDED
```

No se implementaron todavía índices parciales ni migrations SQL.

## Frontend and secret gates

- Frontend sin cambios respecto de `PHASE_1_COMMIT_SHA` en `src/`, manifests raíz, Vite, TypeScript raíz e `index.html`.
- `.gitignore` ya cubría `.env`, `.env.*` y permitía `.env.example`; no fue modificado.
- Scan básico de archivos nuevos: PASS.
- No se encontraron URLs PostgreSQL reales, passwords, tokens, API keys, Railway URLs privadas ni secretos.
- DeliGO: no tocado.

## Files created or modified

Creados:

- `.env.example`.
- `prisma/schema.prisma`.
- `server/prisma.config.ts`.
- `docs/reports/PHASE_2A_PRISMA_FOUNDATION.md`.

Modificados:

- `server/package.json`.
- `server/package-lock.json`.

Sin cambios:

- `server/src/api.ts`.
- `server/src/app/build-app.ts`.
- `server/src/http/health.ts`.
- frontend y manifests de raíz.
- `.gitignore`.

## Risks and notes

- El placeholder de `DATABASE_URL` permite validar y generar sin exigir secretos ni una conexión. Debe reemplazarse sólo en una fase posterior con un ambiente LOCAL/TEST explícito.
- Prisma 7 requiere configuración moderna y output explícito para el generator `prisma-client`; el output quedó dentro de `node_modules` para no versionar artefactos generados en esta fase.
- El wrapper/singleton de Prisma queda diferido porque importar un cliente no es necesario para este foundation y no debe sugerir conexión durante startup.

## Rollback and next action

Rollback point: `1002489235b1a633aa764602825ff970010e8ed0` (PHASE_1). Como no existe DB ni migration aplicada, el rollback conceptual de esta fase consiste en revertir únicamente el commit de PHASE_2A; no se ejecuta rollback aquí.

La próxima acción autorizable es preparar PHASE_2B para definir el schema persistente inicial y una PostgreSQL LOCAL/TEST aislada antes de crear o aplicar la primera migration. Esta fase no se inicia automáticamente.

## Markers

```text
PHASE_2A_PRISMA_FOUNDATION=PASS
PHASE_1_COMMIT_SHA=1002489235b1a633aa764602825ff970010e8ed0
PHASE_1_COMMIT_VALID=YES
BACKEND_RUNTIME=NODE_JS
BACKEND_FRAMEWORK=FASTIFY
PACKAGE_MANAGER=NPM
DATABASE_PROVIDER=POSTGRESQL
ORM=PRISMA
PRISMA_VERSION=7.10.0
PRISMA_CLIENT_VERSION=7.10.0
PRISMA_NODE_COMPATIBLE=YES
PRISMA_CONFIGURATION_STYLE=PRISMA_7_CONFIG_TS_IN_SERVER_WITH_ROOT_SCHEMA
PRISMA_INSTALLED=YES
PRISMA_CLIENT_INSTALLED=YES
PRISMA_SCHEMA_CREATED=YES
PRISMA_MODELS_CREATED=NO
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
PRISMA_CLIENT_WRAPPER_CREATED=NO
PRISMA_CLIENT_WRAPPER_DEFERRED_REASON=NO_MODELS_OR_DATABASE_USAGE_IN_PHASE_2A
DATABASE_CREATED=NO
DATABASE_CONNECTED=NO
DATABASE_QUERIED=NO
DATABASE_MUTATED=NO
MIGRATIONS_CREATED=NO
SQL_EXECUTED=NO
MIGRATION_POLICY_PRESERVED=YES
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS
FRONTEND_UNCHANGED=YES
USER_MODEL_IMPLEMENTED=NO
SESSION_MODEL_IMPLEMENTED=NO
AGENCY_MODEL_IMPLEMENTED=NO
PASSENGER_MODEL_IMPLEMENTED=NO
DRIVER_MODEL_IMPLEMENTED=NO
VEHICLE_MODEL_IMPLEMENTED=NO
TRIP_DOMAIN_IMPLEMENTED=NO
TRIP_OFFER_IMPLEMENTED=NO
DISPATCH_SEARCH_IMPLEMENTED=NO
DRIVER_LOCATION_IMPLEMENTED=NO
FARE_MODEL_IMPLEMENTED=NO
ZONE_MODEL_IMPLEMENTED=NO
AUDIT_LOG_IMPLEMENTED=NO
IDEMPOTENCY_MODEL_IMPLEMENTED=NO
WORKER_IMPLEMENTED=NO
SECRET_SCAN=PASS
DELIGO_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES
PHASE_2A_COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Preparar PHASE_2B para schema inicial y PostgreSQL LOCAL/TEST aislada antes de la primera migration.
```
