# PHASE_2B_POSTGRES_CONNECTIVITY_DIAGNOSTIC_R2

Fecha: 2026-09-26
Proyecto: `remis-norte-prototipo`
Rama: `testing`
Railway environment/service: `testing` / `testing jaguar`

## Resultado remoto previo

El operador informó que en Railway TESTING `/health` responde correctamente y `/ready` continúa con HTTP 503. La línea diagnóstica de R1 indicó `UNKNOWN/UNCLASSIFIED`, con URL presente, parseable, no literal y protocolo aceptado. Estos valores son evidencia reportada por el operador; no se consultó Railway ni se volvió a conectar desde esta tarea.

No se elige todavía entre AggregateError/red, TCP individual, SQLSTATE, autorización/pg_hba, TLS, SASL/password, timeout u otra causa. No se modificaron Railway, `DATABASE_URL`, SSL, resolución DNS, family ni configuración del pool.

## Preflight y baseline

```text
CURRENT_BRANCH=testing
PRE_DIAGNOSTIC_R2_HEAD=4053ccb3a745166246c03f9f9c834f686551e927
ORIGIN_TESTING_SHA=4053ccb3a745166246c03f9f9c834f686551e927
MAIN_SHA=4804e8be5b478e0ea0fb92f78e2736fbf61c39b4
WORKTREE_CLEAN_BEFORE=YES
READY_ENDPOINT_CREATED=YES
PHYSICAL_CONNECTION_PROBE=PG_POOL_CONNECT_WITHOUT_QUERY
DATABASE_URL_VALUE_LOGGED=NO
ERROR_MESSAGE_LOGGED=NO
ERROR_STACK_LOGGED=NO
MIGRATIONS_CREATED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
```

La baseline previa a editar pasó Prisma validate/generate, typecheck, 12 tests y build.

## Clasificación R2

El diagnóstico seguro ahora añade `diagnosticVersion=R2`, `errorKind`, `hasCause` y `hasAggregateChildren`. Los tipos de error se reducen a `AGGREGATE`, `ERROR`, `TYPE_ERROR`, `POSTGRES_ERROR` o `UNKNOWN`; nunca se emite `Error.name` arbitrario.

Para errores agregados o con un array estándar `errors`, se conserva el total de hijos, pero se resumen como máximo seis. Cada resumen incluye sólo categoría, código allowlisted y `addressFamily` calculada con `net.isIP`; no se conserva ni se emite `address`, hostname o `remoteAddress`. La categoría/código superior se selecciona de forma determinística desde los hijos conocidos.

La allowlist incluye los SQLSTATE de conexión `08000`, `08001`, `08003`, `08004`, `08006`, `08007`, `08P01`; autenticación `28P01`; autorización `28000`; base inexistente `3D000`; DB no lista `57P03`; límite `53300`; y los códigos de DNS/red, TLS y timeout ya contemplados. SQLSTATE sintácticamente válido pero no reconocido se normaliza a `POSTGRES_UNCLASSIFIED` y puede exponer únicamente su clase de dos caracteres.

Para `28000`, el patrón `no pg_hba.conf entry` produce `PG_HBA_REJECTED` y, si se puede derivar sin ambigüedad, `connectionEncryption=SSL|NONE`; en otro caso se usa `UNKNOWN`. La frase SASL permitida se reduce a `CONFIGURATION/SASL_PASSWORD_NOT_STRING`. Ningún fragmento de mensaje se devuelve o persiste.

## Logging y contratos

La única línea de fallo es JSON manual con el evento, versión R2, categoría/código controlados, tipo estructural seguro, flags booleanas de URL y los campos estructurales allowlisted opcionales. Nunca se serializa `Error`, `cause`, message, stack, objetos PostgreSQL ni direcciones. `/ready` mantiene exactamente HTTP 200/503 y sus cuerpos previos; los diagnósticos no llegan al cliente. `/health` permanece independiente del probe.

## Tests y validación

```text
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS (15/15)
BUILD=PASS
DIAGNOSTIC_R2_SECRET_LEAK_TEST=PASS
LOCAL_DIAGNOSTIC_R2_SMOKE=PASS
```

Los tests cubren AggregateError IPv6/IPv4, límite de seis resúmenes, códigos de red, SQLSTATE conocidos/desconocidos, `pg_hba` con y sin indicador de cifrado, SASL, errores unknown/TLS, preservación del contrato HTTP y ausencia de valores falsos sensibles en JSON.

Smoke local, con `DATABASE_URL` y defaults `PG*` ausentes: `/health` 200; `/ready` 503; log seguro `CONFIGURATION/DATABASE_URL_MISSING`, versión R2 y flags false. No hubo conexión a Railway/PostgreSQL.

## Gates negativos

```text
CONNECTION_STRATEGY_CHANGED=NO
PRISMA_SCHEMA_CHANGED=NO
DEPENDENCIES_CHANGED=NO
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
SECRET_SCAN=PASS
```

El probe sigue limitado a `pool.connect()` y `client.release()`. No se ejecutaron comandos de migración, `db push/pull` ni SQL. El secret scan reconoce las cadenas de credenciales deliberadamente falsas de los tests como fixtures y no encontró secretos reales.

## Diagnóstico físico pendiente

```text
DATABASE_CONNECTIVITY_ROOT_CAUSE=PENDING_RUNTIME_DIAGNOSTIC_R2
MIGRATION_GATE=BLOCKED
```

Rollback point: `4053ccb3a745166246c03f9f9c834f686551e927`; no se ejecuta rollback. Después del auto-deploy, el operador hará una sola llamada `GET /ready` en Railway TESTING y leerá únicamente la línea `database_readiness_failed` con `diagnosticVersion=R2`. No se aplicará ningún fix automáticamente a partir de esta fase.

## Markers

```text
PHASE_2B_POSTGRES_CONNECTIVITY_DIAGNOSTIC_R2=PASS
PRE_DIAGNOSTIC_R2_HEAD=4053ccb3a745166246c03f9f9c834f686551e927
AGGREGATE_ERROR_SUPPORTED=YES
CHILD_ERRORS_SAFELY_CLASSIFIED=YES
ADDRESS_FAMILY_ONLY_LOGGED=YES
POSTGRES_SQLSTATE_CLASSIFICATION_EXTENDED=YES
PG_HBA_SAFE_CLASSIFICATION=YES
SASL_SAFE_CLASSIFICATION=YES
DIAGNOSTIC_R2_SECRET_LEAK_TEST=PASS
DATABASE_URL_VALUE_LOGGED=NO
ERROR_MESSAGE_LOGGED=NO
ERROR_STACK_LOGGED=NO
CONNECTION_STRATEGY_CHANGED=NO
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_DIAGNOSTIC_R2_SMOKE=PASS
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
SECRET_SCAN=PASS
DATABASE_CONNECTIVITY_ROOT_CAUSE=PENDING_RUNTIME_DIAGNOSTIC_R2
MIGRATION_GATE=BLOCKED
COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
REMOTE_TESTING_MATCHES_LOCAL=YES
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Esperar Railway TESTING, llamar GET /ready una vez y leer la línea segura database_readiness_failed diagnosticVersion=R2.
```
