# Checkpoint — RAILWAY_PORT_COMPATIBILITY

Fecha: 2026-09-25
Proyecto: `remis-norte-prototipo`
Rama de trabajo: `testing`

## Preflight

- Worktree inicial: limpio.
- HEAD inicial: `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- `main`: `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- `testing`: `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- La rama actual fue `testing` durante toda la implementación.

## Causa

El backend sólo resolvía el puerto desde `API_PORT`, con fallback a `3001`. Railway puede proporcionar el puerto efectivo mediante `PORT`, por lo que el servicio podía ignorar el puerto asignado por la plataforma.

## Cambio mínimo

Se modificó únicamente la resolución de puerto en `server/src/config/env.ts` y se amplió el script de tests para ejecutar la nueva suite de configuración. No se agregaron dependencias.

La precedencia efectiva quedó:

```text
PORT -> API_PORT -> 3001
```

La variable explícita seleccionada se valida como entero dentro de `1..65535`. Un valor inválido falla con un error que identifica `PORT` o `API_PORT`. El contrato de `GET /health` no cambió.

## Tests

Se agregaron casos mínimos para:

- `PORT=8080`, `API_PORT=3001` → puerto `8080`.
- `PORT` ausente, `API_PORT=3001` → puerto `3001`.
- Ambas variables ausentes → puerto `3001`.
- `PORT` inválido → error claro.

Validación ejecutada desde `server/`:

- `npm run typecheck`: PASS.
- `npm test`: PASS; 5 tests, 0 fallos.
- `npm run build`: PASS.
- Smoke local: PASS; `GET http://127.0.0.1:3001/health` respondió HTTP 200 con `{"status":"ok","service":"remis-norte-api"}`. El proceso fue detenido.

## Gates negativos

- Base de datos: no tocada.
- Prisma schema: no modificado.
- Migrations: no creadas ni aplicadas.
- SQL: no ejecutado.
- Trip/domain: no modificado.
- Worker/dispatch/auth: no modificado.
- Frontend: no modificado.
- `main`: no modificado; permanece en `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4`.
- Production: no tocada.
- DeliGO: no tocado.

## Commit and publication

El cambio se publicará únicamente en `origin/testing` con el mensaje:

```text
fix: support Railway PORT configuration
```

No se usará force push. El commit de esta fase se registra en la respuesta final y el remoto `testing` debe coincidir exactamente con el HEAD local.

## Next action

Esperar deploy automático de Railway TESTING y volver a certificar `/health` antes de conectar Prisma a PostgreSQL TESTING.

## Markers

```text
RAILWAY_PORT_COMPATIBILITY=PASS
PRE_IMPLEMENTATION_HEAD=4804e8be5b478e0ea0fb92f78e2736fbf61c39b4
CURRENT_BRANCH=testing
PORT_PRIORITY=PORT,API_PORT,3001
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS
DATABASE_TOUCHED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
SQL_EXECUTED=NO
PRISMA_SCHEMA_CHANGED=NO
TRIP_DOMAIN_CHANGED=NO
WORKER_CHANGED=NO
FRONTEND_CHANGED=NO
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEW_COMMIT_CREATED=YES
REMOTE_TESTING_MATCHES_LOCAL=YES
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Esperar deploy automático de Railway TESTING y volver a certificar /health antes de conectar Prisma a PostgreSQL TESTING.
```
