# Auditoría comparativa read-only: DeliGO vs El Jaguar — Prisma/PostgreSQL/Railway

Fecha: 2026-09-26  
Alcance: inspección local de repositorios; no se consultaron servicios remotos.

## Resumen ejecutivo

Los repositorios no comparten la misma arquitectura de cliente PostgreSQL: DeliGO usa Prisma 6 (`prisma-client-js`) y el import estático convencional de `@prisma/client`, con una instancia `db` creada al importar el módulo. El Jaguar usa Prisma 7, el driver adapter `@prisma/adapter-pg`, un `pg.Pool` explícito y un import dinámico de un cliente generado en una ruta calculada desde `process.cwd()`.

La diferencia más útil para el síntoma actual no prueba una causa: en Jaguar, `/ready` inicializa URL, pool, import del cliente generado, adapter y `PrismaClient` antes de alcanzar `pool.connect()`. El error R2 `ERROR / UNCLASSIFIED`, sin `cause` ni hijos agregados, no permite saber en cuál de esas etapas falla. Por eso se recomienda una instrumentación R3 de etapas, sin cambiar la configuración de conexión ni copiar el patrón Prisma 6.

## Preflight y preservación de estado

```text
DELIGO_ROOT=C:\Leo Campos\Trabajo\deligo-main-limpio
DELIGO_BRANCH=work/p2-t43-r2
DELIGO_HEAD=e1fee008d326b800cb311f5a65a391601c4dc1ab
DELIGO_DIRTY=YES (estado dirty observado en preflight; no se limpió)

JAGUAR_ROOT=C:\Leo Campos\Trabajo\EL JAGUAR
JAGUAR_BRANCH=testing
JAGUAR_HEAD=39c1da35bac28885c92bd97f5a45859294298559
JAGUAR_DIRTY_BEFORE=NO
JAGUAR_DIRTY_AFTER=únicamente el reporte autorizado de esta auditoría
```

No se cambió de rama, no se hizo stash/reset/clean/checkout, commit ni push. DeliGO fue sólo leído; sus modificaciones y archivos no seguidos preexistentes se conservaron. En Jaguar, la única escritura autorizada es este reporte. No se ejecutaron comandos Prisma, migraciones, SQL, conexiones a bases ni comandos/consultas de Railway.

El estado dirty de DeliGO es amplio y no se atribuye a esta auditoría. La cantidad reportada corresponde al status medido al cierre; no se usó esa condición como autorización para limpiar nada.

## DeliGO: arquitectura observada

### Topología y versiones

- Repositorio raíz: `package.json`, `package-lock.json` y `bun.lock`. El subservicio `mini-services/chat-service/` tiene package/lockfiles propios; no forma parte del runtime Prisma de la aplicación web principal.
- Gestor/runtime: lock de Bun y comandos `bun`/`bunx`; el `start` principal invoca Bun. También existe `package-lock.json`, por lo que el gestor de instalación no está fijado de forma unívoca en package metadata.
- No se encontró `engines.node`, `packageManager`, `.nvmrc` ni `.node-version`: no hay versión Node pinneada en los archivos examinados.
- `prisma` y `@prisma/client` declaran major `6`; el lock raíz resuelve ambos a `6.19.3`.
- No hay dependencia runtime declarada `pg` ni `@prisma/adapter-pg` para el cliente principal.

### Schema y cliente generado

- Schema activo del comando de build: `prisma/schema.prisma`.
- Generator: `prisma-client-js`; no declara `output`, `engineType` ni `binaryTargets`.
- Datasource: `postgresql`, URL desde `DATABASE_URL`.
- Ubicación efectiva del cliente principal: generación estándar administrada por `@prisma/client` (sin output personalizado en el schema activo).
- Hay schemas auxiliares `schema.postgres.prisma` y `schema.sqlite.prisma` con outputs personalizados para clientes de scripts (`node_modules/.prisma/client-postgres` y `client-sqlite`). No son el schema señalado por `prisma generate` en el script principal de build.
- `src/lib/db.ts` hace import estático `import { PrismaClient } from '@prisma/client'`; no se encontró import dinámico para el cliente principal.

### Construcción, lifecycle y conexión

- `src/lib/db.ts` crea `new PrismaClient(...)` al evaluar el módulo y reutiliza `globalThis.prisma` fuera de producción. En producción conserva la instancia en el módulo; no implementa un `globalThis` singleton de producción.
- No hay llamada explícita a `$connect()` en el módulo principal. La construcción del objeto no equivale a una prueba de conexión. No se encontró hook general de shutdown de Next que desconecte este cliente en el módulo compartido.
- El cliente principal depende de `DATABASE_URL` vía datasource Prisma. No se encontró consumo principal de `DIRECT_URL`, `POSTGRES_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `DATABASE_PRIVATE_URL` ni `DATABASE_PUBLIC_URL`. Un schema auxiliar usa el nombre `POSTGRES_DATABASE_URL`.
- No se encontró configuración SSL explícita (`ssl`, `rejectUnauthorized`, `sslmode`, `PGSSLMODE` o `NODE_TLS`) para el cliente principal.
- Pooling: no hay `pg.Pool` externo ni adapter configurado en el módulo principal; la conexión queda en manos del cliente/query engine de Prisma 6. No se identificó configuración explícita de PgBouncer, Accelerate, `connection_limit` o `pool_timeout`.
- El código de aplicación crea/usa el cliente compartido en módulos de rutas; no hay readiness propio encontrado en `src/app`.
- No hay evidencia en los scripts de conexión a DB obligatoria durante el arranque del proceso. El objeto Prisma se crea al importar `db`; las rutas que realizan operaciones de datos son las que pueden requerir DB. No se certifica aquí el comportamiento de prerender de cada página durante `next build`.

### Build, start, Railway y migraciones

- `build`: `prisma generate && next build && node scripts/copy-standalone-assets.js`; generación ocurre antes de `next build`. El script auxiliar copia `.next/static` y `public` al output standalone, no contiene copia explícita de clientes Prisma.
- `start`: `bun .next/standalone/server.js`; Next configura `output: "standalone"`.
- En el repositorio no se encontraron `railway.json`, `railway.toml`, `nixpacks.toml`, Dockerfile ni Procfile. La raíz del repo es la raíz inferible por ubicación del package, schema y build script; el Railway Root Directory remoto no puede determinarse a partir del repo.
- Hay migraciones bajo `prisma/migrations/`. Los scripts incluyen `db:migrate` (`prisma migrate dev`) y `db:push`, pero no se encontró script `migrate deploy` ni se infiere que el `start` aplique migraciones.
- No se encontraron endpoints `/health` o `/ready` en `src/app`; no se ejecutó ninguno.

## El Jaguar: arquitectura actual observada

- `server/package.json` declara Prisma CLI/client `7.10.0`, `@prisma/adapter-pg` `7.10.0` y `pg` `8.23.0`.
- `server/prisma/schema.prisma`: generator `prisma-client`, output personalizado `../node_modules/.prisma/generated`, datasource PostgreSQL. `server/prisma.config.ts` toma `process.env.DATABASE_URL` (con placeholder local si falta para operaciones de configuración Prisma).
- En `client.ts`, el import del tipo generado es type-only; el runtime importa dinámicamente `client.js` desde `resolve(process.cwd(), "node_modules/.prisma/generated/client.js")`.
- `getDatabaseRuntime()` se inicializa bajo demanda y comparte una promesa singleton por proceso. Durante esa inicialización verifica `DATABASE_URL`, crea `new Pool({ connectionString, connectionTimeoutMillis: 5_000 })`, importa el cliente generado, crea `PrismaPg(pool)` y `new PrismaClient({ adapter })`.
- Sólo después de que `getDatabaseRuntime()` resuelve, `probeDatabaseConnection()` intenta `pool.connect()` y libera el cliente. No ejecuta query Prisma ni SQL.
- `GET /health` responde constante 200 y no consulta DB. `GET /ready` ejecuta ese probe y devuelve 200/503 sanitizado.
- `api.ts` inicia Fastify en `0.0.0.0` y registra cierre en `SIGINT`/`SIGTERM`; el hook `onClose` cierra Prisma y el pool.
- Scripts: `prebuild` ejecuta `prisma:generate`, `build` compila TypeScript a `dist`, `start` usa `node dist/src/api.js`. No hay script de migración. El directorio `server/prisma` observado sólo contiene el schema, no una carpeta de migraciones.
- No se encontró configuración SSL explícita en el constructor del pool. Tampoco se encontró archivo Railway/Docker/Nixpacks/Procfile en el repo. Por la estructura separada `server/package.json`, lock, config y schema, el root directory esperado para el servicio es inferiblemente `server`; no se consultó ni certificó el valor remoto.

## Tabla comparativa

| Área | DeliGO | Jaguar | Diferencia | Riesgo / relevancia para el 503 |
|---|---|---|---|---|
| Prisma y client | 6.19.3 | 7.10.0 | Major distinto | No copiar código de cliente/adapter entre versiones. Contexto, no causa probada. |
| Generator | `prisma-client-js` | `prisma-client` | Generator distinto | Jaguar requiere que exista/importable el output custom en runtime. Relevancia alta como etapa previa al TCP. |
| Output | Default `@prisma/client` | `server/node_modules/.prisma/generated` | Jaguar custom | Un output ausente o ubicación/CWD distintos podría fallar antes de conectar. No verificado remotamente. |
| Import del cliente | Estático desde `@prisma/client` | Dinámico con URL de archivo construida desde `process.cwd()` | Resolución y filesystem difieren | Posible causa pre-`pool.connect`; log actual no separa esa etapa. |
| Creación PrismaClient | Al importar `db.ts` | Lazy durante `getDatabaseRuntime()` | Eager del objeto vs inicialización bajo demanda | En Jaguar `/ready` expone errores de import/adapter antes del probe TCP; relevante. |
| Adapter/driver | Sin adapter explícito; Prisma 6 | `PrismaPg` + `pg` | No es el mismo patrón | Diferencia relevante para comportamiento de driver/TLS/errores; no implica que sea incorrecto. |
| Pool externo | No | `pg.Pool` explícito, un pool por runtime | Lifecycle/pooling diferentes | Posible durante conectividad; error R2 sin código no permite atribuirlo. |
| `DATABASE_URL` | Datasource Prisma principal | Leída por pool en runtime y por config Prisma | Mismo nombre, consumidores distintos | Los flags R2 sólo validan presencia/sintaxis/protocolo; no prueban autenticación ni alcance de red. |
| Railway/private URL | No hay variable privada/pública codificada ni config de Railway | Igual; config remota no inspeccionada | No se puede inferir enlace privado de repo | No permite explicar ni descartar 503. |
| SSL | Sin configuración explícita encontrada | Sin configuración explícita en opciones del `Pool` | Defaults de stacks diferentes | Posible, pero no existe evidencia suficiente para cambiar SSL. |
| Pooling | Interno a Prisma 6, sin knobs explícitos detectados | Pool node-postgres explícito; timeout 5 s | Owners y parámetros diferentes | Puede importar una vez alcanzada la conexión; no explica fallos de inicialización previos. |
| Build/generación | `prisma generate` → `next build` → assets standalone | `prebuild` genera; `build` compila TS | Artefacto se empaqueta por pipelines diferentes | Verificar presencia en runtime de Jaguar; no hay prueba del filesystem Railway en esta auditoría. |
| Runtime/start | Next standalone bajo Bun | Fastify Node persistente | Framework/runtime y cwd/start distintos | Root directory, cwd y artefactos pueden diferir; config remota sin verificar. |
| Health/readiness | No endpoint encontrado | `/health` independiente; `/ready` hace `pool.connect()` | Contrato distinto | `/health` 200 no prueba inicialización/conectividad PostgreSQL; Jaguar `/ready` sí agrupa varias etapas. |
| Migraciones | Presentes; `db:migrate` dev / `db:push`; sin `migrate deploy` | No hay carpeta migrations ni script | Estrategia distinta | No relevante para el error de readiness previo a ejecutar consultas; gate permanece separado. |
| Shutdown | Sin desconexión central del singleton evidenciada | `onClose` desconecta Prisma y termina pool | Lifecycle explícito sólo Jaguar | Baja relevancia para el fallo inicial de `/ready`. |

## Diferencias sospechosas y etapas posibles

Clasificación basada sólo en archivos locales:

- **HIGHLY_RELEVANT (a verificar, no causa raíz):** cliente generado personalizado y carga dinámica de Jaguar dependiente de `process.cwd()`. `createDatabaseRuntime()` debe completar esa importación antes de devolver el pool al código que invoca `pool.connect()`.
- **POSSIBLY_RELEVANT:** Prisma 7 + `PrismaPg` + `pg.Pool` versus Prisma 6 sin adapter explícito. Difieren manejo de conexión/SSL/pooling y superficie de errores, pero el patrón de Jaguar corresponde a su propia versión y no debe sustituirse por Prisma 6 a ciegas.
- **POSSIBLY_RELEVANT:** build y filesystem de despliegue distintos (Next standalone/Bun vs Node/Fastify y output de server personalizado). Los archivos del repo no establecen el root directory/cwd real de Railway.
- **POSSIBLY_RELEVANT, evidencia insuficiente:** defaults TLS del Prisma 6 vs node-postgres. Ningún repo configura SSL explícitamente; no hay evidencia para modificarlo.
- **DEFINITELY_IRRELEVANT como explicación directa de este 503:** diferencias de endpoint de health (DeliGO no tiene readiness detectado); que `/health` sea 200 en Jaguar sólo verifica el proceso HTTP y no el probe DB. Tampoco una migración explica un fallo del probe, que no ejecuta query ni SQL.

En Jaguar las etapas que pueden fallar antes de TCP son: URL ausente/vacía, construcción/resolución de la URL de archivo del cliente, import dinámico del artefacto, creación del adapter o del `PrismaClient`. Luego se ejecuta `pool.connect()`, donde entrarían resolución/conexión/TLS/autenticación. El log R2 aportado (`ERROR`, sin código, cause ni aggregate children) no localiza el fallo entre ellas. Los flags válidos de `DATABASE_URL` no confirman credenciales ni red.

## Hasta cinco diferencias de mayor relevancia

1. **Cliente generado y ruta de import.** DeliGO: schema principal sin `output` y `import { PrismaClient } from '@prisma/client'` (`prisma/schema.prisma`, `src/lib/db.ts`). Jaguar: output custom y dynamic import calculado con `process.cwd()` (`server/prisma/schema.prisma`, `server/src/infrastructure/prisma/client.ts`). Una ruta/artefacto ausente puede producir 503 antes de `pool.connect()`. Confirmación/refutación segura: instrumentar sólo etapa (`generated_client_import_started/ok/failed`) y verificar existencia/carga dentro del runtime/cwd efectivos, sin emitir URL ni error completo.
2. **Prisma 6 sin adapter explícito vs Prisma 7 con adapter y pool propio.** La combinación es específica de versiones y afecta el camino que abre la conexión. No se debe copiar el PrismaClient de DeliGO en Jaguar. Prueba: marcar si se alcanza la etapa `pool.connect()` y clasificar el error de esa etapa; no modificar SSL/pool hasta obtener evidencia.
3. **Build/runtime y CWD.** DeliGO genera antes del build Next standalone y lo inicia con Bun; Jaguar genera en `prebuild`, emite JS a `dist` y lo ejecuta con Node. El import de Jaguar resuelve desde CWD, mientras que la compilación TS no garantiza por sí sola que el cliente generado esté en el filesystem final. Prueba: logging seguro de etapa y booleano `generatedClientPresent` calculado en el proceso desplegado; inspeccionar el Root Directory configurado por operador por separado, sin usar Railway desde esta auditoría.
4. **Pool/lifecycle.** DeliGO no construye `pg.Pool`; Jaguar sí y lo comparte mediante una promesa de runtime, con timeout de conexión de 5 s y `release()` en `finally`. Puede ser relevante sólo después de inicializar cliente/adapter. Prueba: confirmar por marcador si se entra y sale del `pool.connect()`; no hace falta ejecutar query.
5. **SSL/defaults.** No hay configuración SSL explícita encontrada en ninguno, pero los stacks y Prisma majors difieren. Podría afectar la conexión remota, pero el error actual no ofrece evidencia TLS. Prueba: observar etapa/categoría TLS segura antes de considerar una decisión de SSL; no cambiar settings durante el diagnóstico.

## Decisión sobre cliente generado y adapter

```text
DELIGO_CUSTOM_GENERATED_CLIENT=NO (cliente principal; schemas auxiliares sí generan clientes propios)
DELIGO_DYNAMIC_CLIENT_IMPORT=NO
JAGUAR_CUSTOM_GENERATED_CLIENT=YES
JAGUAR_DYNAMIC_CLIENT_IMPORT=YES
SAME_ADAPTER_PATTERN=NO
```

La diferencia puede producir `/health` 200 y `/ready` 503 sin llegar a `pool.connect()`: sí, porque el health no toca DB y Jaguar carga el cliente dinámicamente dentro de `getDatabaseRuntime()` antes del `pool.connect()`. **Esto es una posibilidad de etapa, no una causa confirmada.** El artefacto existe en el checkout local observado, lo cual no demuestra que esté en el filesystem/cwd del contenedor Railway.

## Siguiente acción técnica recomendada

```text
RECOMMENDED_NEXT_ACTION=STAGE_DIAGNOSTIC_R3_BEFORE_POOL_CONNECT
CONFIDENCE=MEDIUM
EVIDENCE=El código de Jaguar realiza validación de DATABASE_URL, creación del pool, import dinámico del cliente y construcción adapter/PrismaClient antes de pool.connect(); el R2 recibido sigue siendo ERROR/UNCLASSIFIED y no distingue esas etapas.
```

R3 debería añadir marcadores de etapa de bajo riesgo (inicio/éxito/fallo para cliente generado, adapter y `pool.connect`) y sólo campos booleanos/allowlisted. No modificar estrategia de conexión, URL, SSL, versiones ni filesystem hasta saber la etapa; después de un despliegue, una única llamada a `/ready` bastaría para obtener el primer fallo de etapa.

## Evidencia local principal

| Proyecto | Archivo(s) | Evidencia |
|---|---|---|
| DeliGO | `package.json`, `package-lock.json`, `bun.lock` | Scripts build/start, Prisma major y lockfile/runtime Bun. |
| DeliGO | `prisma/schema.prisma` | Generator estándar y datasource PostgreSQL con `DATABASE_URL`. |
| DeliGO | `prisma/schema.postgres.prisma`, `prisma/schema.sqlite.prisma` | Outputs auxiliares de scripts; no son el schema principal del build. |
| DeliGO | `src/lib/db.ts` | Import estático, creación de instancia y global singleton no-prod. |
| DeliGO | `next.config.ts`, `scripts/copy-standalone-assets.js` | Next standalone y copia explícita de assets static/public. |
| DeliGO | `prisma/migrations/`, `mini-services/chat-service/package.json` | Estructura de migrations y topología del servicio aparte. |
| Jaguar | `server/package.json`, `server/prisma.config.ts`, `server/prisma/schema.prisma` | Versiones, lifecycle build/start, URL y output generado. |
| Jaguar | `server/src/infrastructure/prisma/client.ts` | Fuente URL, Pool, import dinámico, adapter, probe y cierre. |
| Jaguar | `server/src/http/health.ts`, `server/src/http/ready.ts`, `server/src/app/build-app.ts`, `server/src/api.ts` | Contratos HTTP, hook de cierre y proceso persistente. |

## Gates y markers

```text
DELIGO_VS_JAGUAR_POSTGRES_PRISMA_AUDIT=PASS
DELIGO_BRANCH=work/p2-t43-r2
DELIGO_HEAD=e1fee008d326b800cb311f5a65a391601c4dc1ab
DELIGO_DIRTY=YES (preexistente; no limpiado)
DELIGO_PACKAGE_MANAGER=Bun runtime; package-lock también presente; instalación no pinneada
DELIGO_NODE_VERSION_HINT=NO_PIN_FOUND
DELIGO_PRISMA_VERSION=6.19.3
DELIGO_PRISMA_CLIENT_VERSION=6.19.3
DELIGO_PG_DRIVER=Prisma 6 query engine; no pg dependency/adapter explícito
DELIGO_POSTGRES_ADAPTER=NO
DELIGO_RUNTIME=Next standalone iniciado con Bun
DELIGO_PRISMA_SCHEMA_PATH=prisma/schema.prisma
DELIGO_GENERATOR_PROVIDER=prisma-client-js
DELIGO_GENERATOR_CUSTOM_OUTPUT=NO (schema principal)
DELIGO_GENERATED_CLIENT_LOCATION=default @prisma/client / node_modules/.prisma/client
DELIGO_DATASOURCE_PROVIDER=postgresql
DELIGO_PRISMA_CLIENT_IMPORT=static @prisma/client
DELIGO_PRISMA_CLIENT_CONSTRUCTION=new PrismaClient en src/lib/db.ts al importar módulo
DELIGO_USES_DRIVER_ADAPTER=NO
DELIGO_USES_PG_POOL=NO
DELIGO_USES_EXTERNAL_POOL=NO
DELIGO_USES_SINGLETON=YES (globalThis fuera de production; módulo en production)
DELIGO_LAZY_INITIALIZATION=client NO; conexión explícita NO
DELIGO_CALLS_PRISMA_CONNECT_EXPLICITLY=NO
DELIGO_DATABASE_URL_VARIABLE=DATABASE_URL (schema principal); POSTGRES_DATABASE_URL (schema auxiliar)
DELIGO_USES_PRIVATE_RAILWAY_DATABASE_URL=UNKNOWN
DELIGO_USES_PUBLIC_DATABASE_URL=UNKNOWN
DELIGO_USES_DIRECT_URL=NO
DELIGO_EXPLICIT_SSL_CONFIG=NO
DELIGO_CONNECTION_POOL_STRATEGY=pool interno del cliente Prisma 6; sin configuración explícita detectada
DELIGO_PGBOUNCER=NO (no se encontró uso/configuración en el código revisado)
DELIGO_PRISMA_ACCELERATE=NO
DELIGO_RAILWAY_CONFIG_FILES=none found
DELIGO_BUILD_COMMAND=prisma generate && next build && node scripts/copy-standalone-assets.js
DELIGO_START_COMMAND=bun .next/standalone/server.js
DELIGO_ROOT_DIRECTORY_INFERRED=repo root by layout; Railway remote value UNKNOWN
DELIGO_PRISMA_GENERATE_STAGE=build, antes de next build
DELIGO_BUILD_REQUIRES_DATABASE=UNKNOWN (generate no conecta; no se certificó prerender de Next)
DELIGO_START_REQUIRES_DATABASE=NO explicit connection at process start found; DB is used by request paths
DELIGO_MIGRATIONS_PRESENT=YES
DELIGO_MIGRATE_DEPLOY_SCRIPT_PRESENT=NO
DELIGO_DB_RUNTIME_CREATION_STAGE=module evaluation creates client; no explicit connect found
DELIGO_DATABASE_REQUIRED_AT_PROCESS_START=NO evidence of unconditional DB connect at process start
DELIGO_HEALTH_ENDPOINT=NOT_FOUND_IN_REPO
DELIGO_READY_ENDPOINT=NOT_FOUND_IN_REPO

JAGUAR_BRANCH=testing
JAGUAR_HEAD=39c1da35bac28885c92bd97f5a45859294298559
JAGUAR_PRISMA_VERSION=7.10.0
JAGUAR_GENERATOR_PROVIDER=prisma-client
JAGUAR_GENERATOR_OUTPUT=../node_modules/.prisma/generated
JAGUAR_CLIENT_IMPORT_STRATEGY=type-only static reference plus runtime dynamic import via process.cwd()
JAGUAR_DRIVER_ADAPTER=PrismaPg from @prisma/adapter-pg
JAGUAR_PG_POOL_STRATEGY=explicit pg.Pool, connectionTimeoutMillis=5000
JAGUAR_DATABASE_URL_SOURCE=process.env.DATABASE_URL
JAGUAR_SSL_CONFIG=no explicit SSL options found
JAGUAR_RUNTIME_INITIALIZATION=lazy singleton promise; URL/pool/import/adapter/client before pool.connect
JAGUAR_BUILD_GENERATE_STAGE=npm prebuild runs prisma:generate before build
JAGUAR_HEALTH_BEHAVIOR=HTTP 200, no DB probe
JAGUAR_READY_BEHAVIOR=pool.connect then release; HTTP 200/503
JAGUAR_USES_DRIVER_ADAPTER=YES
JAGUAR_USES_PG_POOL=YES
JAGUAR_CUSTOM_GENERATED_CLIENT=YES
JAGUAR_DYNAMIC_CLIENT_IMPORT=YES
SAME_ADAPTER_PATTERN=NO
MOST_RELEVANT_DIFFERENCE_1=Custom generated Prisma client imported dynamically from cwd in Jaguar, before pool.connect
MOST_RELEVANT_DIFFERENCE_2=Prisma 6 query-engine path in DeliGO vs Prisma 7 PrismaPg plus explicit pg.Pool in Jaguar
MOST_RELEVANT_DIFFERENCE_3=Next standalone/Bun build-runtime layout vs Node/Fastify and Jaguar's cwd-dependent generated-client path
CURRENT_503_ROOT_CAUSE_CONFIRMED=NO
RECOMMENDED_NEXT_ACTION=STAGE_DIAGNOSTIC_R3_BEFORE_POOL_CONNECT
CONFIDENCE=MEDIUM
DELIGO_MODIFIED=NO
JAGUAR_CODE_MODIFIED=NO
DATABASE_CONNECTED=NO
SQL_EXECUTED=NO
MIGRATIONS_EXECUTED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
```
