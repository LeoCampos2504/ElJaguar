# PHASE_2B_RAILWAY_POSTGRES_CONNECTION_GATE

Fecha: 2026-09-26
Proyecto: `remis-norte-prototipo`
Rama: `testing`
Railway Root Directory: `/server`

## Contexto y resolución técnica

La ejecución anterior se detuvo correctamente porque el lifecycle `$connect()` de Prisma con `@prisma/adapter-pg` crea el adapter/pool, pero no garantiza por sí mismo una conexión física. Esta reanudación autoriza expresamente `pg.Pool.connect()` sin ejecutar una query.

Se verificó en los tipos instalados de `@prisma/adapter-pg@7.10.0` que `PrismaPg` acepta un `pg.Pool` externo. Su opción `disposeExternalPool` es `false` por defecto; por ello el módulo `closeDatabaseRuntime()` es el único dueño explícito del cierre: ejecuta `PrismaClient.$disconnect()` y luego `pool.end()` una sola vez.

## Preflight y baseline

```text
CURRENT_BRANCH=testing
PRE_IMPLEMENTATION_HEAD=f220fd5a8b1f81d88a2e9a27e54ed3761bbc2cda
MAIN_SHA=4804e8be5b478e0ea0fb92f78e2736fbf61c39b4
WORKTREE_CLEAN_BEFORE=YES
PRIOR_LAYOUT_GATE_VALID=YES
```

El HEAD corresponde a `fix: make Prisma layout Railway-compatible`; contiene el schema en `server/prisma/schema.prisma` y `server/prisma.config.ts`. Prisma validate/generate, typecheck, tests y build pasaron también antes de los cambios.

## Dependencias y runtime

```text
PRISMA_VERSION=7.10.0
PRISMA_CLIENT_VERSION=7.10.0
PRISMA_PG_ADAPTER_VERSION=7.10.0
PG_VERSION=8.23.0
PG_TYPES_VERSION=8.23.1 (transitive dependency; not added directly)
PG_TYPES_INSTALLED=YES
PRISMA_PG_ACCEPTS_EXTERNAL_POOL=YES
DATABASE_POOL_STRATEGY=SINGLE_SHARED_PG_POOL
POOL_LIFECYCLE_OWNER=closeDatabaseRuntime
```

Se añadieron únicamente `@prisma/adapter-pg` y `pg` en `server/`. El runtime crea de forma lazy un único `Pool` desde `process.env.DATABASE_URL` con `connectionTimeoutMillis=5000`, entrega ese mismo pool a `new PrismaPg(pool)` y construye el cliente generado existente con `new PrismaClient({ adapter })`. No lee la URL al importar ni durante la construcción de Fastify. Si falta, falla sólo al solicitar el runtime DB; no permite que `pg` use defaults implícitos.

El cliente Prisma se importa dinámicamente desde el output generado en `server/node_modules/.prisma/generated`, evitando iniciar el runtime durante import. El proceso ejecuta el shutdown mediante `app.close()` en SIGINT/SIGTERM; el hook de cierre delega en el dueño único del pool.

## Connectivity probe y HTTP

El probe físico ejecuta exclusivamente `const client = await pool.connect()` y `client.release()` en `finally`. El pool es compartido con Prisma. No se envía SQL; por tanto esta comprobación acredita apertura de conexión/autenticación, pero todavía no acredita schema, tablas, migrations ni consultas de modelos.

`GET /health` conserva el contrato liveness existente y no llama ni inicializa DB. `GET /ready` usa el probe inyectable: éxito responde HTTP 200 con `status=ready` y `database=reachable`; cualquier fallo responde HTTP 503 con `status=not_ready` y `database=unreachable`. El handler no devuelve ni registra errores internos.

## Tests y validación

Los tests usan probes fake; un test aislado lanza un proceso hijo con una lista permitida de variables de entorno, omitiendo `DATABASE_URL` y variables de defaults `PG*`. Así se prueba el 503 real del readiness sin tocar credenciales del entorno ni conectar Railway.

```text
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS (9/9)
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS (HTTP 200, contrato exacto)
LOCAL_READY_NO_DB_SMOKE=PASS (HTTP 503, cuerpo sanitizado)
```

El smoke local levantó el build desde `server/`, sin `DATABASE_URL` ni defaults `PG*`; no estableció conexión PostgreSQL. El test opcional de `Pool.connect/release` aislado con pool fake se difiere: el contrato de endpoint e integración sin DB están cubiertos y no se agregó una librería de mocking.

## Gates negativos y revisión

```text
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
PRISMA_DB_PUSH_EXECUTED=NO
PRISMA_DB_PULL_EXECUTED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
PRISMA_QUERY_RAW_EXECUTED=NO
PRISMA_EXECUTE_RAW_EXECUTED=NO
MODEL_QUERY_EXECUTED=NO
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
RAILWAY_CONFIGURATION_CHANGED_BY_CODEX=NO
```

`server/prisma/migrations/` continúa ausente. El frontend y los manifests raíz no forman parte del diff. El secret scan revisó los archivos versionados cambiados sin imprimir valores; no hay credenciales reales, tokens, contraseñas ni URL PostgreSQL privada.

## Publicación, rollback y siguiente gate

Rollback point: `f220fd5a8b1f81d88a2e9a27e54ed3761bbc2cda`; no se ejecutó rollback. El commit se registra en la respuesta final. Se publicará únicamente a `origin/testing`, sin force; el SHA remoto se verificará después del push.

```text
RAILWAY_DATABASE_CONNECTIVITY=PENDING_PHYSICAL_SMOKE
MIGRATION_GATE=BLOCKED_PENDING_RAILWAY_READY_SMOKE
```

Después del auto-deploy, el operador debe verificar físicamente `GET /health` y `GET /ready` en Railway TESTING. Sólo cuando ambos pasen puede prepararse la fase de primera migration. Esta fase no modifica Railway y no asume conectividad remota.

## Markers

```text
PHASE_2B_RAILWAY_POSTGRES_CONNECTION_GATE=PASS
TECHNICAL_LIMITATION_RESOLVED=YES
CURRENT_BRANCH=testing
PRE_IMPLEMENTATION_HEAD=f220fd5a8b1f81d88a2e9a27e54ed3761bbc2cda
PRISMA_VERSION=7.10.0
PRISMA_CLIENT_VERSION=7.10.0
PRISMA_PG_ADAPTER_INSTALLED=YES
PG_INSTALLED=YES
PG_TYPES_INSTALLED=YES (transitive via @prisma/adapter-pg)
PRISMA_PG_ACCEPTS_EXTERNAL_POOL=YES
DATABASE_POOL_STRATEGY=SINGLE_SHARED_PG_POOL
PRISMA_RUNTIME_CLIENT_CREATED=YES
PRISMA_RUNTIME_CONNECTION_LAZY=YES
POOL_LIFECYCLE_OWNER=closeDatabaseRuntime
PHYSICAL_CONNECTION_PROBE_IMPLEMENTED=YES
PHYSICAL_CONNECTION_PROBE=PG_POOL_CONNECT_WITHOUT_QUERY
PHYSICAL_CONNECTION_WITHOUT_SQL=YES
DATABASE_CONNECTION_REQUIRED_AT_STARTUP=NO
HEALTH_DB_INDEPENDENT=YES
READY_ENDPOINT_CREATED=YES
READY_SUCCESS_STATUS=200
READY_FAILURE_STATUS=503
DATABASE_URL_REQUIRED_ONLY_FOR_DB_ACCESS=YES
DOMAIN_QUERY_EXECUTED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
PRISMA_QUERY_RAW_EXECUTED=NO
PRISMA_EXECUTE_RAW_EXECUTED=NO
MODEL_QUERY_EXECUTED=NO
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
PRISMA_DB_PUSH_EXECUTED=NO
PRISMA_DB_PULL_EXECUTED=NO
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS
LOCAL_READY_NO_DB_SMOKE=PASS
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
SECRET_SCAN=PASS
RAILWAY_CONFIGURATION_CHANGED_BY_CODEX=NO
RAILWAY_DATABASE_CONNECTIVITY=PENDING_PHYSICAL_SMOKE
MIGRATION_GATE=BLOCKED_PENDING_RAILWAY_READY_SMOKE
COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
REMOTE_TESTING_MATCHES_LOCAL=YES
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Esperar auto-deploy Railway TESTING y certificar físicamente GET /health y GET /ready antes de crear la primera migration.
```
