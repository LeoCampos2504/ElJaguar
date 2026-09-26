# PHASE_2B_POSTGRES_CONNECTIVITY_DIAGNOSTIC

Fecha: 2026-09-26
Proyecto: `remis-norte-prototipo`
Rama: `testing`
Railway environment/service: `testing` / `testing jaguar`

## Situación y alcance

El operador reporta en Railway TESTING: `GET /health` pasa; `GET /ready` responde HTTP 503 con el contrato `not_ready/unreachable`. También informa que la Reference Variable fue corregida y hubo redeploy posterior. No se accedió a Railway desde esta tarea ni se volvió a probar la base remota.

La causa no se podía observar porque Fastify se instancia con `logger: false` y el handler de readiness captura la excepción para conservar el 503 sanitizado, sin emitir un log. Esta tarea sólo agrega clasificación y logging diagnóstico seguro; no corrige ni cambia la estrategia de conexión.

## Preflight y baseline

```text
CURRENT_BRANCH=testing
PRE_DIAGNOSTIC_HEAD=380bf871741d29d2f3bb13c69dbb4e8d3b16334d
MAIN_SHA=4804e8be5b478e0ea0fb92f78e2736fbf61c39b4
WORKTREE_CLEAN_BEFORE=YES
READY_ENDPOINT_CREATED=YES
PHYSICAL_CONNECTION_PROBE=PG_POOL_CONNECT_WITHOUT_QUERY
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
```

Prisma validate, generate, typecheck, tests y build pasaron antes de los cambios.

## Clasificador y salida segura

Se añadió `classifyDatabaseConnectivityError(error)`, que devuelve sólo `category` y `code` constantes para DNS, conexión rechazada, timeout, autenticación, base inexistente, TLS, red, URL inválida y desconocidos. La capa de diagnóstico clasifica ausencia de `DATABASE_URL` como `CONFIGURATION` usando únicamente el flag de presencia, sin cambiar el tipo de error original. Sólo expone códigos explícitamente allowlisted; códigos TLS `ERR_SSL_*` se normalizan a `TLS_ERROR`, y cualquier código no reconocido a `UNCLASSIFIED`. Los errores sin código sólo inspeccionan dos frases exactas de timeout de `pg-pool`; el texto nunca se conserva ni se registra.

Las flags de URL sólo exponen booleanos: presente, parseable, literal `${{...}}` y protocolo aceptado (`postgres:`/`postgresql:`). El valor, protocolo no aceptado y componentes de URL quedan dentro del scope local de comprobación.

Ante fallo, el probe emite una sola línea JSON construida manualmente con `event`, categoría/código controlados y esas cuatro flags. Nunca se pasa el error original a consola, Fastify ni HTTP. El handler `/ready` conserva exactamente sus contratos públicos 200/503 y no recibe campos diagnósticos.

## Tests y validación

Los tests cubren los códigos de DNS/red/TLS, SQLSTATE `28P01` y `3D000`, URL inválida, código desconocido, timeout sin código, error de configuración, flags booleanas para URL ausente/válida/literal/no aceptada, y ausencia de datos sensibles del error (message, stack, conexión) en el diagnóstico. La prueba HTTP de `/ready` confirma que message y stack no se filtran al body. `/health` sigue sin invocar el probe.

```text
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS (12/12)
BUILD=PASS
DIAGNOSTIC_SECRET_LEAK_TEST=PASS
LOCAL_DIAGNOSTIC_SMOKE=PASS
```

Smoke local sin `DATABASE_URL` ni defaults `PG*`: `/health` respondió 200 con el cuerpo inalterado; `/ready` respondió 503 con el cuerpo inalterado. El log fue únicamente:

```text
{"event":"database_readiness_failed","category":"CONFIGURATION","code":"DATABASE_URL_MISSING","databaseUrlPresent":false,"databaseUrlParseable":false,"databaseUrlReferenceLiteral":false,"protocolAccepted":false}
```

Ese smoke sólo verifica la clasificación local de configuración ausente; no determina la causa del error reportado en Railway.

## Gates negativos

```text
PRISMA_SCHEMA_CHANGED=NO
TRIP_DOMAIN_CHANGED=NO
AUTH_CHANGED=NO
DISPATCH_CHANGED=NO
WORKER_CHANGED=NO
FRONTEND_UNCHANGED=YES
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
PRISMA_QUERY_RAW_EXECUTED=NO
PRISMA_EXECUTE_RAW_EXECUTED=NO
MODEL_QUERY_EXECUTED=NO
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
RAILWAY_CONFIGURATION_CHANGED_BY_CODEX=NO
DEPENDENCIES_CHANGED=NO
DATABASE_URL_VALUE_LOGGED=NO
ERROR_MESSAGE_LOGGED=NO
ERROR_STACK_LOGGED=NO
SECRET_SCAN=PASS
```

No se ejecutaron comandos Prisma de migración, introspección ni push/pull de schema. No se cambió `Pool`, `PrismaPg`, `PrismaClient`, `DATABASE_URL`, timeout, lifecycle, lazy initialization ni shutdown.

## Diagnóstico remoto pendiente

```text
DATABASE_CONNECTIVITY_ROOT_CAUSE=PENDING_RUNTIME_DIAGNOSTIC
MIGRATION_GATE=BLOCKED
```

Tras el auto-deploy, el operador debe llamar una sola vez `GET /ready` en Railway TESTING y leer únicamente la línea estructurada `database_readiness_failed` en Deploy Logs. Con categoría, código y flags booleanas se determinará el arreglo exacto en una tarea separada; no se corrige nada automáticamente en ésta.

Rollback point: `380bf871741d29d2f3bb13c69dbb4e8d3b16334d`. No se ejecutó rollback. El cambio se publicará sólo a `origin/testing`, sin force.

## Markers

```text
PHASE_2B_POSTGRES_CONNECTIVITY_DIAGNOSTIC=PASS
CURRENT_BRANCH=testing
PRE_DIAGNOSTIC_HEAD=380bf871741d29d2f3bb13c69dbb4e8d3b16334d
DIAGNOSTIC_CLASSIFIER_CREATED=YES
SAFE_RUNTIME_LOG_CREATED=YES
DATABASE_URL_VALUE_LOGGED=NO
ERROR_MESSAGE_LOGGED=NO
ERROR_STACK_LOGGED=NO
DIAGNOSTIC_SECRET_LEAK_TEST=PASS
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
PRISMA_QUERY_RAW_EXECUTED=NO
PRISMA_EXECUTE_RAW_EXECUTED=NO
MODEL_QUERY_EXECUTED=NO
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS
LOCAL_READY_NO_DB_SMOKE=PASS
LOCAL_DIAGNOSTIC_SMOKE=PASS
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
RAILWAY_CONFIGURATION_CHANGED_BY_CODEX=NO
SECRET_SCAN=PASS
DATABASE_CONNECTIVITY_ROOT_CAUSE=PENDING_RUNTIME_DIAGNOSTIC
MIGRATION_GATE=BLOCKED
COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
REMOTE_TESTING_MATCHES_LOCAL=YES
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Esperar Railway TESTING, llamar GET /ready una vez y leer únicamente la línea segura database_readiness_failed en Deploy Logs.
```
