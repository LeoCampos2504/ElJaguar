# PHASE_2C_FIRST_MIGRATION_PREPARE

Fecha: 2026-09-26
Proyecto: `remis-norte-prototipo`
Rama: `testing`

## Alcance y preflight

Fase limitada a generar, completar y revisar el artefacto inicial de Prisma Migrate. No se aplicó migration, no se ejecutó SQL y no se conectó PostgreSQL desde Codex.

El operador certificó físicamente Railway TESTING: `/health` HTTP 200 con `status=ok`, y `/ready` HTTP 200 con `status=ready`, `database=reachable`. Es evidencia aportada por el operador; Codex no llamó Railway.

```text
PRE_MIGRATION_PREP_HEAD=81de210a7dd76032d957bec7f2967dde1f54131c
CURRENT_BRANCH=testing
ORIGIN_TESTING_SHA=81de210a7dd76032d957bec7f2967dde1f54131c
WORKTREE_CLEAN_BEFORE=YES
MAIN_SHA=4804e8be5b478e0ea0fb92f78e2736fbf61c39b4
ROLLBACK_POINT=81de210a7dd76032d957bec7f2967dde1f54131c
```

La política técnica autoriza y exige SQL custom versionado para invariantes PostgreSQL no expresables por Prisma; Prisma sigue siendo el ORM principal y `db push` en Production está prohibido. El schema contiene 18 modelos y 7 enums. No se modificó `schema.prisma`.

## Configuración y generación

Se explicitó `migrations.path = "./prisma/migrations"` en Prisma config. La migration lock canónica declara únicamente `provider = "postgresql"`.

```text
INITIAL_MIGRATION_NAME=20260926_000000_initial_schema
PRISMA_VERSION=7.10.0
MIGRATION_GENERATION_COMMAND=prisma migrate diff --config=./prisma.config.ts --from-empty --to-schema=./prisma/schema.prisma --script --output=./prisma/migrations/20260926_000000_initial_schema/migration.sql
```

Se ejecutó el comando anterior desde `server/` usando el Prisma CLI instalado. Sólo comparó empty con el schema local y escribió el archivo solicitado; no se usaron opciones de datasource y no se ejecutó el SQL.

Archivos creados:

- `server/prisma/migrations/20260926_000000_initial_schema/migration.sql`
- `server/prisma/migrations/migration_lock.toml`

## Revisión del SQL generado

Se leyó el archivo completo. El SQL base generado coincide con el schema en enums, tablas, columnas nullable/required, tipos, defaults, PK, unique constraints, índices, relaciones y políticas referenciales:

- 7 PostgreSQL enum types y 18 tablas;
- 11 unique indexes generados desde las declaraciones `@unique`/`@@unique`;
- 16 índices normales, coincidentes con los 16 `@@index`;
- 36 foreign keys, coincidentes con las 36 relaciones Prisma con campos referenciales;
- 6 columnas `DECIMAL(10,7)`, 1 `DECIMAL(10,2)` y 2 `JSONB`;
- timestamps emitidos como `TIMESTAMP(3)`, con defaults `CURRENT_TIMESTAMP` sólo donde define el schema;
- las acciones `ON DELETE`/`ON UPDATE` coinciden con `onDelete` del schema y el default referencial de Prisma.

`GENERATED_SQL_SCHEMA_MATCH=YES`. La migration mantiene la creación de schema `public` que genera Prisma. Los `ON DELETE CASCADE` observados pertenecen exclusivamente a las FKs expresamente definidas en Prisma; no son `DROP ... CASCADE` ni operaciones destructivas ad hoc.

## Invariantes custom autorizadas

Al final del archivo, después de crear las tres tablas involucradas, se agregaron exactamente estas cinco reglas aprobadas:

1. Índice único parcial `TripOffer_one_pending_per_trip_uq` sobre `TripOffer("tripId") WHERE "status" = 'PENDING'`.
2. Índice único parcial `TripOffer_one_pending_per_driver_uq` sobre `TripOffer("driverId") WHERE "status" = 'PENDING'`.
3. Índice único parcial `DriverVehicleAssignment_one_current_per_driver_uq` sobre `("driverId") WHERE "isCurrent" = true`.
4. Índice único parcial `DriverVehicleAssignment_one_current_per_vehicle_uq` sobre `("vehicleId") WHERE "isCurrent" = true`.
5. CHECK `User_email_or_phone_required_ck`: `"email" IS NOT NULL OR "phoneNormalized" IS NOT NULL`.

Los índices ordinarios generados sobre `(TripOffer.tripId,status)`, `(TripOffer.driverId,status)`, `(DriverVehicleAssignment.driverId,isCurrent)` y `(DriverVehicleAssignment.vehicleId,isCurrent)` no son únicos ni parciales y no duplican estas invariantes. No se eliminó ninguno. No se agregaron otras constraints, triggers, funciones, procedimientos, views ni bloques procedurales.

```text
TRIP_OFFER_PENDING_TRIP_UNIQUE=YES
TRIP_OFFER_PENDING_DRIVER_UNIQUE=YES
CURRENT_ASSIGNMENT_DRIVER_UNIQUE=YES
CURRENT_ASSIGNMENT_VEHICLE_UNIQUE=YES
USER_CONTACT_CHECK=YES
CUSTOM_CONSTRAINT_DUPLICATION=NO
```

Conteos finales del archivo completo, incluidos custom SQL:

```text
CREATE_TYPE_COUNT=7
CREATE_TABLE_COUNT=18
CREATE_UNIQUE_INDEX_COUNT=15 (11 Prisma + 4 custom)
CREATE_INDEX_COUNT=16
FOREIGN_KEY_COUNT=36
CHECK_CONSTRAINT_COUNT=1
```

## Revisión estática de seguridad e historia

El scan estático no encontró `DROP TABLE/COLUMN/TYPE`, `TRUNCATE`, `DELETE FROM`, `UPDATE`, `INSERT INTO`, `ALTER ... DROP`, bloques `DO`, procedures, functions ni triggers. No hay `CASCADE` destructivo; las cláusulas referenciales `ON DELETE` fueron cotejadas contra el schema.

`MIGRATION_HISTORY_STATIC_CHECK=NOT_RUN`: el CLI Prisma 7 requiere una shadow database para `migrate diff` con `--from-migrations` o `--to-migrations`. Como no se autorizó conectar una DB ni crear una shadow DB, se dejó sin ejecutar; la comprobación del SQL generado contra el schema fue estática. Referencia de Prisma: [About the shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).

```text
DATABASE_CONNECTED_FOR_MIGRATION=NO
DATABASE_SCHEMA_INVENTORIED=NO
DATABASE_MUTATED=NO
MIGRATION_APPLIED=NO
SQL_EXECUTED=NO
SECRET_SCAN=PASS
```

No se registraron `DATABASE_URL`, hosts privados, passwords, tokens ni API keys. El operador proporcionó los resultados de los smoke remotos; Codex no alteró Railway ni Production.

## Validación y gates

Desde `server/`:

```text
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS (20/20)
BUILD=PASS
```

```text
PRISMA_SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=YES (un artefacto inicial versionable)
MIGRATIONS_APPLIED=NO
PG_QUERY_EXECUTED=NO
RAW_SQL_EXECUTED=NO
MODEL_QUERY_EXECUTED=NO
FRONTEND_UNCHANGED=YES
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
```

## Siguiente gate

Este commit sólo prepara y publica la migration en `testing`. No autoriza el apply. La fase separada `PHASE_2C_FIRST_MIGRATION_TESTING_APPLY` debe primero confirmar SHA/branch y readiness, inventariar PostgreSQL TESTING de forma READ-ONLY, confirmar identidad y ausencia de tablas inesperadas, y documentar rollback/fix-forward. Sólo una autorización posterior permite `migrate deploy` en TESTING. Production sigue prohibida.

```text
FIRST_MIGRATION_ARTIFACT=READY
TESTING_DATABASE_APPLY=NOT_AUTHORIZED_YET
MIGRATION_GATE=READY_FOR_TESTING_APPLY_PREFLIGHT
NEXT_ACTION=Ejecutar en una fase separada el preflight READ-ONLY de PostgreSQL TESTING antes de autorizar migrate deploy.
```

## Markers

```text
PHASE_2C_FIRST_MIGRATION_PREPARE=PASS
PRE_MIGRATION_PREP_HEAD=81de210a7dd76032d957bec7f2967dde1f54131c
RAILWAY_HEALTH_SMOKE=PASS
RAILWAY_READY_SMOKE=PASS
RAILWAY_DATABASE_CONNECTIVITY=PASS
PRISMA_VERSION=7.10.0
MODEL_COUNT=18
ENUM_COUNT=7
INITIAL_MIGRATION_NAME=20260926_000000_initial_schema
MIGRATION_SQL_CREATED=YES
MIGRATION_LOCK_CREATED=YES
MIGRATION_LOCK_REASON=Prisma Migrate expects the canonical provider lock file for migration history.
GENERATED_SQL_SCHEMA_MATCH=YES
TRIP_OFFER_PENDING_TRIP_UNIQUE=YES
TRIP_OFFER_PENDING_DRIVER_UNIQUE=YES
CURRENT_ASSIGNMENT_DRIVER_UNIQUE=YES
CURRENT_ASSIGNMENT_VEHICLE_UNIQUE=YES
USER_CONTACT_CHECK=YES
CUSTOM_CONSTRAINT_DUPLICATION=NO
DESTRUCTIVE_SQL_FOUND=NO
PRISMA_SCHEMA_CHANGED=NO
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
MIGRATION_HISTORY_STATIC_CHECK=NOT_RUN
DATABASE_CONNECTED_FOR_MIGRATION=NO
DATABASE_MUTATED=NO
MIGRATION_APPLIED=NO
SQL_EXECUTED=NO
SECRET_SCAN=PASS
MAIN_BRANCH_TOUCHED=NO
PRODUCTION_TOUCHED=NO
DELIGO_TOUCHED=NO
COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
REMOTE_TESTING_MATCHES_LOCAL=TO_BE_VERIFIED_AFTER_PUSH
WORKTREE_CLEAN_AFTER=TO_BE_VERIFIED_AFTER_PUSH
FIRST_MIGRATION_ARTIFACT=READY
TESTING_DATABASE_APPLY=NOT_AUTHORIZED_YET
MIGRATION_GATE=READY_FOR_TESTING_APPLY_PREFLIGHT
NEXT_ACTION=Ejecutar en una fase separada el preflight READ-ONLY de PostgreSQL TESTING antes de autorizar migrate deploy.
```
