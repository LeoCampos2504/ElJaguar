# Checkpoint — RAILWAY_PRISMA_LAYOUT_COMPATIBILITY

Fecha: 2026-09-25
Proyecto: `remis-norte-prototipo`
Rama de trabajo: `testing`
Railway Root Directory: `/server`

## Contexto y motivo

Railway TESTING despliega el paquete backend con `ROOT_DIRECTORY=/server`. El layout anterior dejaba el schema en la raíz del repositorio (`prisma/schema.prisma`) y la configuración dentro de `server/` apuntaba a `../prisma/schema.prisma`. Ese layout funcionaba desde el repositorio completo, pero no hacía al paquete backend autocontenido para Railway.

## Cambio realizado

Se movió el schema mediante `git mv`:

```text
prisma/schema.prisma
  -> server/prisma/schema.prisma
```

Se actualizó `server/prisma.config.ts` para resolver `./prisma/schema.prisma` desde `server/`.

El generator Prisma 7 conserva el output dentro del paquete:

```text
server/node_modules/.prisma/generated
```

El único cambio semántico del archivo schema es la ruta relativa del output generado; modelos, enums, relaciones, índices, money strategy, version fields y delete policies permanecen equivalentes.

Se agregó el lifecycle script `prebuild`:

```text
prebuild = npm run prisma:generate
build    = tsc -p tsconfig.json
```

Así `npm run build` genera Prisma Client antes de compilar TypeScript, sin depender exclusivamente de postinstall.

## Validación de autocontención

Dentro de `server/` existen:

- `package.json`.
- `package-lock.json`.
- `prisma.config.ts`.
- `prisma/schema.prisma`.
- `src/`.
- `test/`.

La carpeta raíz `prisma/` desapareció. El generated client queda bajo `server/node_modules/`, ignorado y no versionado. No se modificó `package-lock.json` porque no cambió ninguna dependencia.

## Validaciones

Ejecutadas desde `server/`:

- `npm run prisma:validate`: PASS; schema cargado desde `prisma/schema.prisma`.
- `npm run prisma:generate`: PASS; output dentro de `server/node_modules/.prisma/generated`.
- `npm run typecheck`: PASS.
- `npm test`: PASS; 5 tests, 0 fallos.
- `npm run build`: PASS; ejecutó `prebuild`, `prisma:generate` y luego TypeScript build.
- Health smoke local: PASS; `GET http://127.0.0.1:3001/health` respondió HTTP 200 con `{"status":"ok","service":"remis-norte-api"}`. El proceso fue detenido.

## Gates negativos

- No se conectó, consultó ni mutó ninguna base de datos.
- No se creó ni aplicó ninguna migration.
- No se ejecutó SQL, `db push`, `db pull` ni `$connect()`.
- No se creó `server/prisma/migrations/`.
- No se instaló driver PostgreSQL, `@prisma/adapter-pg` ni `pg`.
- No se implementó conexión runtime de Prisma.
- No se modificaron Trip/domain, auth, dispatch, worker ni endpoints de dominio.
- No se modificó frontend.
- No se tocó `main`, Production, Railway ni DeliGO.

## Secret scan

El diff tracked fue revisado sin imprimir valores sensibles. No aparecen DATABASE_URL reales, passwords, tokens, API keys ni URLs privadas de Railway/PostgreSQL. El placeholder seguro existente permanece sin cambios.

## Rollback point

`1301ec2aa75de2c41c5434cac8fa116bb145c2c4` (`fix: support Railway PORT configuration`). No se ejecuta rollback.

## Next action

Esperar deployment automático de Railway TESTING, certificar nuevamente `/health` y recién después preparar Prisma 7 runtime PostgreSQL adapter más connection-only check contra PostgreSQL TESTING. No se instala el adapter en esta tarea.

## Markers

```text
RAILWAY_PRISMA_LAYOUT_COMPATIBILITY=PASS
CURRENT_BRANCH=testing
PRE_IMPLEMENTATION_HEAD=1301ec2aa75de2c41c5434cac8fa116bb145c2c4
SCHEMA_MOVED_INTO_SERVER=YES
SCHEMA_SEMANTICALLY_UNCHANGED=YES
PRISMA_CONFIG_UPDATED=YES
GENERATED_CLIENT_INSIDE_SERVER=YES
PRISMA_GENERATE_BEFORE_BUILD=YES
SERVER_PACKAGE_SELF_CONTAINED_FOR_PRISMA=YES
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS
DATABASE_CONNECTED=NO
DATABASE_QUERIED=NO
DATABASE_MUTATED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
SQL_EXECUTED=NO
PRISMA_POSTGRES_DRIVER_INSTALLED=NO
PG_INSTALLED=NO
PRISMA_CLIENT_RUNTIME_CONNECTION_IMPLEMENTED=NO
FRONTEND_CHANGED=NO
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
SECRET_SCAN=PASS
COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
REMOTE_TESTING_MATCHES_LOCAL=YES
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Esperar Railway TESTING, recertificar /health y preparar adapter PostgreSQL de Prisma 7 más connection-only check.
```
