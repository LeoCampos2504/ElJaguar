# PHASE_2B_PRISMA_GENERATED_CLIENT_RUNTIME_FIX

Fecha: 2026-09-26
Proyecto: `remis-norte-prototipo`
Rama de trabajo: `testing`

## Causa raíz y baseline

El operador confirmó físicamente en Railway TESTING el diagnóstico R3:

```text
GET /health=PASS
GET /ready=HTTP_503
stage=GENERATED_CLIENT_RESOLUTION
category=RUNTIME_ARTIFACT
code=GENERATED_CLIENT_ENTRY_MISSING
databaseRuntimeInitialized=false
generatedClientDirectoryExists=true
generatedClientEntryExists=false
generatedClientPackageMetadataExists=false
```

La aplicación usa Prisma 7.10.0 con `provider = "prisma-client"`. Este generator produce TypeScript. El output anterior era `server/node_modules/.prisma/generated`; el runtime importaba un `client.js` que no se generaba ahí. Además, `tsconfig.json` excluye `node_modules`, de modo que ese cliente no se emitía dentro de `dist`.

Preflight: `testing`, HEAD y `origin/testing` coincidían en `98b2411c5e1ff79d835db28717fb7143e215c5bf`; worktree limpio. `main` permaneció en `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.

Antes del cambio pasaron `prisma:validate`, `prisma:generate`, `typecheck`, 20/20 tests y `build`; la generación confirmó que el directorio viejo existía y `client.js` no.

## Cambio aplicado

- Se conserva el provider `prisma-client` y se mueve el output a `server/src/generated/prisma`, con formato ESM y extensiones generadas/importadas `.ts`.
- `rewriteRelativeImportExtensions: true` hace que TypeScript emita imports `.js` en `dist`.
- El cliente se importa estáticamente desde `src/generated/prisma/client.ts`; se eliminaron la búsqueda en `node_modules`, `process.cwd()`, `resolve`, `pathToFileURL` y el import dinámico.
- La ruta generada específica `/server/src/generated/prisma/` se agregó a `.gitignore`; el cliente generado no se versiona.
- `predev`, `pretypecheck` y `pretest` regeneran Prisma. `prebuild` ya existía y se mantiene.
- Pool, adapter y PrismaClient continúan creándose dentro de `getDatabaseRuntime()`; `/health` no pide acceso a la base.
- Se mantiene Prisma 7 con `@prisma/adapter-pg`, `pg.Pool` y `new PrismaClient({ adapter })`. No hubo cambios de modelos, enums, relaciones, índices o datasource en el schema; sólo cambió configuración del generator.
- El diagnóstico R3 permanece, sin resolución de generated client por filesystem/cwd.

## Verificación

```text
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS (20/20)
BUILD=PASS
GENERATED_SOURCE_DIRECTORY_EXISTS=YES
GENERATED_SOURCE_CLIENT_TS_EXISTS=YES
GENERATED_CLIENT_IGNORED=YES
GENERATED_CLIENT_TRACKED=NO
COMPILED_GENERATED_CLIENT_EXISTS=YES
COMPILED_RUNTIME_IMPORT_VALID=YES
OLD_GENERATED_CLIENT_RUNTIME_REFERENCE_COUNT=0
```

El runtime compilado importa `../../generated/prisma/client.js`, correspondiente a `dist/src/generated/prisma/client.js`. La única referencia restante a `process.cwd()` en `server/` es el test que fija el cwd del proceso hijo; no pertenece a la resolución del cliente.

Fresh-build: se comprobó que el directorio generado está específicamente ignorado y que no contiene archivos trackeados. El shell rechazó el borrado recursivo solicitado sobre el checkout compartido, por lo que no se eliminó esa copia. Como verificación equivalente de checkout limpio, se creó un sandbox temporal desde los archivos versionados actuales, omitiendo `node_modules`, `dist` y todo cliente generado, y enlazando las dependencias locales. Ejecutar `npm run build` allí disparó `prebuild → prisma:generate → tsc` y recreó tanto `src/generated/prisma/client.ts` como `dist/src/generated/prisma/client.js`.

Smoke del build local: `/health` devolvió HTTP 200 y el cuerpo esperado. Con una URL PostgreSQL sintética exclusivamente local apuntando a `127.0.0.1:1`, `/ready` devolvió HTTP 503 por `stage=POOL_CONNECT`, `category=CONNECTION_REFUSED`, `code=ECONNREFUSED`, `databaseRuntimeInitialized=true`. Así se superó la etapa del cliente generado. El puerto cerrado no es una base real; no se ejecutó SQL.

## Gates

```text
PRISMA_SCHEMA_BUSINESS_CONTENT_CHANGED=NO
CONNECTION_STRATEGY_CHANGED=NO
DEPENDENCIES_CHANGED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
RAILWAY_DATABASE_CONNECTED_BY_CODEX=NO
REAL_DATABASE_QUERIED=NO
DATABASE_MUTATED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
MODEL_QUERY_EXECUTED=NO
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
RAILWAY_CONFIGURATION_CHANGED_BY_CODEX=NO
SECRET_SCAN=PASS
```

La URL local de prueba contiene sólo los valores ficticios `demo`; no se consultó ni registró ninguna URL real, credencial, host Railway o token.

## Markers

```text
PHASE_2B_PRISMA_GENERATED_CLIENT_RUNTIME_FIX=PASS
PRE_FIX_HEAD=98b2411c5e1ff79d835db28717fb7143e215c5bf
ROOT_CAUSE_CONFIRMED=YES
OLD_GENERATOR_OUTPUT=node_modules/.prisma/generated
NEW_GENERATOR_OUTPUT=src/generated/prisma
PRISMA_GENERATOR_PROVIDER=prisma-client
PRISMA_SCHEMA_BUSINESS_CONTENT_CHANGED=NO
GENERATED_SOURCE_DIRECTORY_EXISTS=YES
GENERATED_SOURCE_CLIENT_TS_EXISTS=YES
GENERATED_CLIENT_TRACKED=NO
TYPESCRIPT_REWRITE_RELATIVE_IMPORT_EXTENSIONS=YES
OLD_DYNAMIC_CWD_IMPORT_REMOVED=YES
DATABASE_RUNTIME_LAZY=YES
PREDEV_GENERATES_PRISMA=YES
PRETYPECHECK_GENERATES_PRISMA=YES
PRETEST_GENERATES_PRISMA=YES
PREBUILD_GENERATES_PRISMA=YES
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
COMPILED_GENERATED_CLIENT_EXISTS=YES
COMPILED_RUNTIME_IMPORT_VALID=YES
FRESH_BUILD_GENERATES_CLIENT=PASS
FRESH_BUILD_METHOD=ISOLATED_CLEAN_SOURCE_SANDBOX
LOCAL_HEALTH_SMOKE=PASS
LOCAL_RUNTIME_PASSED_GENERATED_CLIENT_STAGE=YES
LOCAL_READY_REACHED_POOL_CONNECT=YES
RAILWAY_DATABASE_CONNECTED_BY_CODEX=NO
REAL_DATABASE_QUERIED=NO
DATABASE_MUTATED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
SECRET_SCAN=PASS
ROLLBACK_POINT=98b2411c5e1ff79d835db28717fb7143e215c5bf
RAILWAY_GENERATED_CLIENT_FIX=PENDING_PHYSICAL_SMOKE
RAILWAY_DATABASE_CONNECTIVITY=PENDING_PHYSICAL_SMOKE
MIGRATION_GATE=BLOCKED_PENDING_RAILWAY_READY_SMOKE
NEXT_ACTION=Esperar Railway TESTING, comprobar GET /health y GET /ready; GENERATED_CLIENT_ENTRY_MISSING no debe volver a aparecer.
```
