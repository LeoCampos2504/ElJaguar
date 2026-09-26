# PHASE_2B_POSTGRES_CONNECTIVITY_DIAGNOSTIC_R3 — stage isolation

Fecha: 2026-09-26
Proyecto: `remis-norte-prototipo`
Rama: `testing`

## Propósito y baseline

R3 agrega identificación segura de la etapa del fallo de `/ready`; no corrige todavía la causa ni altera la estrategia de conexión. La auditoría documental DeliGO/Jaguar quedó registrada en `docs/reports/DELIGO_VS_JAGUAR_POSTGRES_PRISMA_AUDIT.md` y publicada en el checkpoint `32ab3263f4e0b3d13e2d2e7799e8d3347aad47c2`.

El reporte comparativo confirma que DeliGO usa Prisma 6.19.3, generator `prisma-client-js`, import estático desde `@prisma/client` y no tiene adapter ni `pg.Pool` externo. Jaguar usa Prisma 7.10.0, `@prisma/adapter-pg`, `pg.Pool`, output generado personalizado y carga dinámica dependiente de `process.cwd()`. No se copia el código de Prisma 6 porque las versiones, generator y modalidad de conexión difieren.

```text
PRE_DIAGNOSTIC_R3_HEAD=32ab3263f4e0b3d13e2d2e7799e8d3347aad47c2
MAIN_SHA=4804e8be5b478e0ea0fb92f78e2736fbf61c39b4
CURRENT_BRANCH=testing
WORKTREE_CLEAN_BEFORE=YES
ORIGIN_TESTING_SHA=32ab3263f4e0b3d13e2d2e7799e8d3347aad47c2
```

Los reportes previos confirman `/ready` y el probe físico `pool.connect()` + `client.release()` sin query. No se ejecutan queries ni migraciones en esta fase.

Evidencia física remota informada para R2, sin consulta a Railway en este trabajo:

```text
GET /health=PASS
GET /ready=HTTP_503
diagnosticVersion=R2
category=UNKNOWN
code=UNCLASSIFIED
errorKind=ERROR
hasCause=false
hasAggregateChildren=false
databaseUrlPresent=true
databaseUrlParseable=true
databaseUrlReferenceLiteral=false
protocolAccepted=true
```

Ese diagnóstico no distingue si la ejecución llegó a `pool.connect()`.

## Observación local de artefactos

Después de `npm run prisma:generate` y `npm run build`, la inspección local devolvió únicamente estos booleanos:

```text
generatedClientDirectoryExists=true
generatedClientEntryExists=false
generatedClientPackageMetadataExists=false
```

El directorio generado local contiene fuentes `.ts` (incluido `client.ts`), pero el runtime intenta importar `client.js`. Esto hace prioritaria la etapa `GENERATED_CLIENT_RESOLUTION` como hipótesis local si Railway empaqueta el mismo layout. **No confirma el estado del filesystem remoto ni se declara causa raíz confirmada**; el único diagnóstico físico posterior a deploy sigue pendiente.

## Implementación R3

Las etapas están limitadas a enum cerrado: `DATABASE_URL_VALIDATION`, `POOL_CREATION`, `GENERATED_CLIENT_RESOLUTION`, `GENERATED_CLIENT_IMPORT`, `PRISMA_ADAPTER_CREATION`, `PRISMA_CLIENT_CREATION`, `POOL_CONNECT`, `CLIENT_RELEASE` y `UNKNOWN`.

Cada error de inicialización se envuelve internamente con etapa y referencia al error original. El wrapper nunca se serializa. El log se construye de forma explícita y emite sólo enums, códigos allowlisted, banderas booleanas y los resúmenes agregados seguros heredados de R2. No registra mensaje, stack, causa completa, URL, paths, hostname, dirección IP, usuario ni nombre de base.

Antes del import dinámico se miden existencia de directorio, entrada `client.js` y metadata `package.json` como booleanos. Si falla antes de llegar a esa etapa, esas banderas se omiten (no se presentan como falsamente negativas). Si falta la entrada, la clasificación sintética es `RUNTIME_ARTIFACT/GENERATED_CLIENT_ENTRY_MISSING` en `GENERATED_CLIENT_RESOLUTION`.

`databaseRuntimeInitialized=false` para fallos de URL, creación de pool, resolución/import del cliente, adapter o PrismaClient. Al entrar en `POOL_CONNECT` pasa a true; también es true si falla `client.release()`.

Errores Node allowlisted: `ERR_MODULE_NOT_FOUND`, `MODULE_NOT_FOUND`, `ERR_PACKAGE_PATH_NOT_EXPORTED`, `ERR_UNSUPPORTED_DIR_IMPORT`, `ERR_UNKNOWN_FILE_EXTENSION` se normalizan como `RUNTIME_ARTIFACT` con su código exacto. Otros códigos arbitrarios no se emiten. Las familias del código original se limitan a `NONE`, `NODE_ERR`, `OS_NETWORK`, `POSTGRES_SQLSTATE` u `OTHER`.

Sólo durante `POOL_CONNECT` se inspeccionan internamente las huellas exactas para SSL no soportado, cifrado requerido, terminación inesperada, SASL y timeout. Se mantienen las clasificaciones seguras R2 para SQLSTATE, red, `pg_hba`, TLS y AggregateError. Ningún message se devuelve ni registra.

Los contratos HTTP no cambiaron: `/health` sigue 200 sin probe de DB; `/ready` sigue 200/503 con cuerpos sanitizados y sin información de etapa.

## Tests y validación

```text
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS (20/20)
BUILD=PASS
DIAGNOSTIC_R3_SECRET_LEAK_TEST=PASS
```

Cobertura añadida: entrada generada ausente; error `ERR_MODULE_NOT_FOUND` con path sintético; fallo genérico en creación de PrismaClient; `ECONNREFUSED` en `POOL_CONNECT`; huellas TLS/network/SASL sólo dentro de `POOL_CONNECT`; y verificación de que no se serializan URL, password, hostname Railway sintético, path, username, database, IPv4, IPv6 ni causa. Se mantiene cobertura R2 para AggregateError, SQLSTATE y `pg_hba`.

Smoke local sin `DATABASE_URL` ni defaults PG: `/health` 200 con el cuerpo esperado y `/ready` 503 con el cuerpo esperado. La única línea segura fue:

```text
event=database_readiness_failed
diagnosticVersion=R3
stage=DATABASE_URL_VALIDATION
category=CONFIGURATION
code=DATABASE_URL_MISSING
databaseRuntimeInitialized=false
```

No se creó pool ni se intentó conectar durante ese smoke.

## Gates negativos

```text
CONNECTION_STRATEGY_CHANGED=NO
POOL_CONFIG_CHANGED=NO
SSL_CONFIG_CHANGED=NO
DNS_CONFIG_CHANGED=NO
IP_FAMILY_CONFIG_CHANGED=NO
PRISMA_SCHEMA_CHANGED=NO
DEPENDENCIES_CHANGED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
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
DATABASE_CONNECTED=NO
SECRET_SCAN=PASS
```

Archivos autorizados modificados: `server/src/infrastructure/prisma/client.ts`, `server/src/infrastructure/prisma/connectivity-diagnostics.ts`, `server/test/health.test.ts` y este reporte. No hubo cambios de schema, migraciones, dependencias o frontend.

## Diagnóstico remoto y siguiente paso

```text
DATABASE_CONNECTIVITY_ROOT_CAUSE=PENDING_RUNTIME_DIAGNOSTIC_R3
MIGRATION_GATE=BLOCKED
ROLLBACK_POINT=32ab3263f4e0b3d13e2d2e7799e8d3347aad47c2
```

No se aplica un fix automático. Después del auto-deploy en Railway TESTING, el operador hará una única llamada `GET /ready` y leerá la línea `database_readiness_failed` con `diagnosticVersion=R3`; los campos decisivos serán `stage`, `category` y `code`. No hacer rollback en esta fase.

## Markers

```text
PHASE_2B_POSTGRES_CONNECTIVITY_DIAGNOSTIC_R3=PASS
PRE_DIAGNOSTIC_R3_HEAD=32ab3263f4e0b3d13e2d2e7799e8d3347aad47c2
CURRENT_DIAGNOSTIC_CONFLATES_STAGES=YES
STAGE_DIAGNOSTIC_CREATED=YES
GENERATED_CLIENT_ARTIFACT_FLAGS_CREATED=YES
LOCAL_GENERATED_CLIENT_DIRECTORY_EXISTS=YES
LOCAL_GENERATED_CLIENT_ENTRY_EXISTS=NO
NODE_MODULE_ERROR_CLASSIFICATION_CREATED=YES
DATABASE_RUNTIME_INITIALIZED_FLAG_CREATED=YES
DIAGNOSTIC_R3_SECRET_LEAK_TEST=PASS
DATABASE_URL_VALUE_LOGGED=NO
ERROR_MESSAGE_LOGGED=NO
ERROR_STACK_LOGGED=NO
CONNECTION_STRATEGY_CHANGED=NO
POOL_CONFIG_CHANGED=NO
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_DIAGNOSTIC_R3_SMOKE=PASS
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
SECRET_SCAN=PASS
DATABASE_CONNECTIVITY_ROOT_CAUSE=PENDING_RUNTIME_DIAGNOSTIC_R3
MIGRATION_GATE=BLOCKED
ROLLBACK_POINT=32ab3263f4e0b3d13e2d2e7799e8d3347aad47c2
NEXT_ACTION=Esperar Railway TESTING, llamar GET /ready una sola vez y leer stage/category/code del diagnosticVersion=R3.
```
