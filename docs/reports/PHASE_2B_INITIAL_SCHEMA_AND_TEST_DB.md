# Checkpoint — PHASE_2B_INITIAL_SCHEMA_AND_TEST_DB

Fecha: 2026-09-25
Proyecto: `remis-norte-prototipo`
Rama: `main`

## Resultado

La fase queda en `PARTIAL_PASS`:

- El schema persistente inicial de Prisma/PostgreSQL quedó definido y validado.
- Prisma Client se generó correctamente.
- El backend existente continúa pasando typecheck, tests, build y health smoke.
- El gate de PostgreSQL LOCAL/TEST aislada queda bloqueado porque Docker, Docker Compose, Docker Engine y `psql` no están disponibles.
- No se instaló Docker ni PostgreSQL.
- No se creó ni aplicó ninguna migration.
- No se conectó ninguna base de datos.

## Scope ejecutado

Se modificó únicamente `prisma/schema.prisma` y se creó este reporte. El schema contiene los modelos persistentes aprobados, enums, relaciones, constraints e índices normales expresables por Prisma. Las invariantes parciales PostgreSQL quedaron documentadas para la primera migration, pero no se implementaron.

No se implementaron endpoints, casos de uso, auth/login, worker, dispatch, integración frontend ni deploy.

## Phase 2A preflight

- `PHASE_2A_COMMIT_SHA=cbe87cfab17bb0dd598f74b054831264c7e7b908`.
- Commit: `feat: add Prisma PostgreSQL foundation`.
- Rama: `main`.
- Worktree antes de esta fase: limpio.
- El commit contiene sólo los paths autorizados de PHASE_2A.
- `PHASE_2A_COMMIT_VALID=YES`.

## Baseline técnico

Ejecutado desde `server/` antes de modificar el schema:

- `npm run prisma:validate`: PASS.
- `npm run prisma:generate`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS; 1 test, 0 fallos.
- `npm run build`: PASS.

Runtime confirmado:

- Node.js `v24.18.0`.
- NPM `11.16.0`.
- Prisma `7.10.0`.
- Prisma Client `7.10.0`.

## PostgreSQL runtime detection

Comprobaciones read-only:

- Docker CLI: no disponible.
- Docker Engine: no disponible.
- Docker Compose: no disponible.
- `psql`: no disponible.

Por ese motivo no se creó `infra/postgres/`, no se inició ningún container y no se generaron credenciales locales. No se utilizó una DB remota, empresarial, Railway, DeliGO ni FNET.

```text
TEST_DB_STRATEGY=DOCKER_POSTGRES_ISOLATED
ISOLATED_TEST_DB_READY=NO
TEST_DB_GATE=BLOCKED
```

## ID and timestamp decisions

```text
PRIMARY_ID_STRATEGY=CUID
```

Se eligió `cuid()` para todos los IDs principales porque es soportado por Prisma, no requiere extensión PostgreSQL, es seguro para generación desde aplicación y mantiene interoperabilidad sencilla. `DriverLocation.driverId` es la clave primaria del snapshot único por Driver.

La convención temporal es consistente:

- `createdAt @default(now())` donde corresponde.
- `updatedAt @updatedAt` en entidades mutables.
- timestamps de ciclo de vida explícitos en Trip, Session, Offer, búsqueda, ubicación y asignación.

## Enums

Se definieron los siete enums aprobados:

- `ActorType`: `PASSENGER`, `DRIVER`, `DISPATCHER`, `ADMIN`, `SYSTEM`.
- `TripRequestSource`: `APP`, `PHONE`, `DISPATCHER`, `OTHER`.
- `TripStatus`: `REQUESTED`, `ASSIGNED`, `DRIVER_EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- `TripOfferStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
- `DispatchSearchStatus`: `SEARCHING`, `WAITING_FOR_RESPONSE`, `NO_CANDIDATES`, `MANUAL_INTERVENTION`, `ASSIGNED`, `STOPPED`.
- `DriverAvailabilityStatus`: `OFFLINE`, `AVAILABLE`, `UNAVAILABLE`.
- `AgencyRole`: `DRIVER`, `DISPATCHER`, `ADMIN`.

No se persistió `BUSY`; continúa siendo un estado derivado de Trips/ofertas activas. No se agregaron `SEARCHING`, `OFFERED` ni `WAITING_ACCEPTANCE` a `TripStatus`.

## Models and relations

Se definieron los 18 modelos aprobados:

`Agency`, `User`, `Session`, `AgencyMembership`, `PassengerProfile`, `Driver`, `Vehicle`, `DriverVehicleAssignment`, `Trip`, `DispatchSearch`, `TripOffer`, `DriverLocation`, `Zone`, `FareVersion`, `FareRule`, `TripEvent`, `AuditLog`, `IdempotencyRecord`.

Relaciones principales:

- Agency agrupa memberships, drivers, vehicles, trips, offers, locations, zones, tarifas, eventos y auditoría.
- User tiene sesiones, memberships, perfil Passenger y relaciones de actor/creador.
- Driver pertenece a Agency/User, tiene snapshot de ubicación, ofertas, trips y asignaciones de vehículo.
- PassengerProfile es 1:1 con User y tiene historial de Trips.
- Trip pertenece a Agency y referencia opcionalmente Passenger, creador, Driver, Vehicle, zonas y FareVersion.
- DispatchSearch es 1:1 con Trip.
- TripOffer pertenece a Trip, Agency, Driver y opcionalmente Vehicle.
- FareVersion agrupa FareRule; FareRule referencia zonas de origen y destino.
- TripEvent y AuditLog mantienen metadata `Json` nativa.

## Prisma indexes and unique constraints

Se agregaron sólo índices normales justificados:

- Trip por Agency/status/createdAt, Passenger/createdAt y Driver/status.
- TripOffer por Trip/status, Driver/status y status/expiresAt.
- Driver por Agency/availabilityStatus/isEnabled.
- DriverLocation por Agency/recordedAt.
- Session por User/expiresAt.
- FareVersion por Agency/effectiveFrom/effectiveTo.
- FareRule por zonas.
- TripEvent y AuditLog por recurso/Agency y fecha.

Unique constraints expresables por Prisma:

- `Session.tokenHash`.
- `User.email` y `User.phoneNormalized` con semántica nullable de PostgreSQL.
- `AgencyMembership(agencyId, userId, role)`.
- `PassengerProfile.userId`.
- `Driver(agencyId, userId)`.
- `Vehicle(agencyId, plate)`.
- `Zone(agencyId, code)`.
- `FareRule(fareVersionId, originZoneId, destinationZoneId)`.
- `DispatchSearch.tripId`.
- `IdempotencyRecord(scope, key)`.

## Delete policies and cross-Agency strategy

- `Cascade` se reserva para hijos técnicos o dependencias 1:1 cuya eliminación no borra historia operativa: Session/User, PassengerProfile/User, DriverLocation/Driver y DispatchSearch/Trip.
- `SetNull` se usa en referencias opcionales históricas a Passenger, actor creador/cancelador, Driver, Vehicle, zonas, tarifa y Vehicle de una oferta.
- `Restrict` protege Agency-scoped resources, asignaciones, Trip, TripOffer, TripEvent y relaciones históricas contra borrados destructivos.
- La operación normal debe desactivar actores y recursos; el borrado físico no es el mecanismo de negocio.

```text
CROSS_AGENCY_INVARIANTS_STRATEGY=APPLICATION_AND_TRANSACTION_VALIDATION; FUTURE_DB_CONSTRAINTS_ONLY_WHEN_JUSTIFIED
```

Las FK simples no garantizan por sí solas que Agency IDs relacionados coincidan; esa validación queda en casos de uso/transacciones futuras, sin sobrecomplicar este schema inicial.

## Money and coordinates

```text
MONEY_STRATEGY=INTEGER_MINOR_UNITS_WITH_EXPLICIT_CURRENCY_SCALE
DRIVER_BUSY_DERIVED=YES
```

`FareVersion.amount`, `Trip.fareAmount` y `FareRule.amount` usan `Int`; `currency` y `scale` conservan la interpretación explícita. No se usa Float para dinero.

Coordenadas usan `Decimal` PostgreSQL con precisión `Decimal(10,7)` para latitud/longitud y `Decimal(10,2)` para accuracy. No se creó PostGIS ni historial GPS. `TripOffer.distanceSnapshot` es `Int` en metros.

Se incluyó `version Int @default(0)` en Trip, DispatchSearch y TripOffer para optimistic concurrency futura.

## Prisma Client

`npm run prisma:validate` y `npm run prisma:generate` pasaron después del schema completo. El generator moderno `prisma-client` conserva el output dentro de `server/node_modules/.prisma/generated`, ignorado y no versionado.

No se creó `server/src/infrastructure/prisma/client.ts`: el wrapper no es necesario para el health actual, no existen casos de uso que lo consuman y el runtime DB está bloqueado. Se difiere a la fase que prepare la primera conexión LOCAL/TEST, manteniendo la regla de no conectar durante import/startup.

## First migration custom SQL requirements

No se ejecutó ni se creó SQL. Estas son las únicas invariantes que deben incorporarse en la primera migration versionada:

1. `REQUIRED` — `TripOffer`: índice único parcial equivalente a `UNIQUE(tripId) WHERE status='PENDING'`.
2. `REQUIRED` — `TripOffer`: índice único parcial equivalente a `UNIQUE(driverId) WHERE status='PENDING'`.
3. `REQUIRED` — `DriverVehicleAssignment`: unicidad parcial de asignación vigente por `driverId WHERE isCurrent=true` y por `vehicleId WHERE isCurrent=true`, si la operación mantiene una sola asignación vigente en cada lado.
4. `REQUIRED` — `User`: CHECK de que `email` o `phoneNormalized` exista, conforme al contrato de identidad autenticable.

```text
TRIP_PENDING_PARTIAL_UNIQUE_REQUIRES_CUSTOM_SQL=YES
DRIVER_PENDING_PARTIAL_UNIQUE_REQUIRES_CUSTOM_SQL=YES
REQUIRES_CUSTOM_SQL_IN_FIRST_MIGRATION=YES
```

No se simuló ninguna de estas reglas con `@@unique([..., status])`, porque eso rompería el historial de ofertas no-PENDING.

## Validation and negative gates

- `PRISMA_FORMAT=PASS`.
- `PRISMA_VALIDATE=PASS`.
- `PRISMA_GENERATE=PASS`.
- `TYPECHECK=PASS`.
- `TESTS=PASS`; 1 test, 0 fallos.
- `BUILD=PASS`.
- `LOCAL_HEALTH_SMOKE=PASS`; HTTP 200 y contrato exacto de `/health`.
- `prisma/migrations/` no existe.
- No se ejecutó `migrate dev`, `migrate deploy`, `migrate reset`, `db push`, `db pull` ni `db execute`.
- No se crearon tablas ni se aplicó el schema.
- No se ejecutó SQL.
- No existe una DB local/test disponible en este entorno.

## Domain, frontend and secret gates

Crear modelos no implementa casos de uso. Permanecen en `NO`:

- `AUTH_USE_CASES_IMPLEMENTED`.
- `TRIP_USE_CASES_IMPLEMENTED`.
- `DISPATCH_ENGINE_IMPLEMENTED`.
- `WORKER_IMPLEMENTED`.
- `HTTP_DOMAIN_ENDPOINTS_IMPLEMENTED`.
- `FRONTEND_INTEGRATION`.

El frontend permanece sin cambios respecto de `PHASE_2A_COMMIT_SHA` en `src/`, manifests raíz, Vite, TypeScript raíz e `index.html`.

El scan de archivos nuevos/modificados pasó sin imprimir valores sensibles. No se versionaron `.env.test.local`, `.env.local`, credenciales, tokens, API keys ni URLs PostgreSQL reales.

DeliGO, Railway y Production no fueron tocados.

## Files changed

- Modificado: `prisma/schema.prisma`.
- Creado: `docs/reports/PHASE_2B_INITIAL_SCHEMA_AND_TEST_DB.md`.
- No cambiaron `server/package.json`, `server/package-lock.json`, `server/prisma.config.ts`, `.env.example` ni `.gitignore`.
- No se creó `infra/postgres/` porque el runtime Docker requerido no está disponible.
- No se stagearán `server/node_modules/`, `server/dist/`, volúmenes ni archivos locales de credenciales.

## Rollback, risks and next action

Rollback point: `cbe87cfab17bb0dd598f74b054831264c7e7b908` (PHASE_2A). No hay migration aplicada ni schema creado en DB. El rollback de código sería revertir el commit de PHASE_2B; no se ejecuta aquí.

Riesgos/notes:

- El schema completo está validado por Prisma, pero sus constraints PostgreSQL parciales aún no existen físicamente.
- El gate de DB seguirá bloqueado hasta disponer de Docker/Compose/Engine o un runtime PostgreSQL LOCAL/TEST explícitamente aislado.
- No se debe crear la primera migration antes de disponer de esa DB aislada y revisar los cuatro requisitos custom SQL.

Next action: `Preparar un runtime PostgreSQL LOCAL/TEST aislado; no crear migration todavía.`

## Markers

```text
PHASE_2B_INITIAL_SCHEMA_AND_TEST_DB=PARTIAL_PASS
PHASE_2A_COMMIT_SHA=cbe87cfab17bb0dd598f74b054831264c7e7b908
PHASE_2A_COMMIT_VALID=YES
PRIMARY_ID_STRATEGY=CUID
SCHEMA_MODELS_DEFINED=YES
ENUMS_DEFINED=YES
RELATIONS_DEFINED=YES
PRISMA_INDEXES_DEFINED=YES
DELETE_POLICIES_DEFINED=YES
MONEY_STRATEGY_PRESERVED=YES
DRIVER_BUSY_DERIVED=YES
TRIP_VERSION_FIELD=YES
DISPATCH_SEARCH_VERSION_FIELD=YES
TRIP_OFFER_VERSION_FIELD=YES
TRIP_PENDING_PARTIAL_UNIQUE_REQUIRES_CUSTOM_SQL=YES
DRIVER_PENDING_PARTIAL_UNIQUE_REQUIRES_CUSTOM_SQL=YES
FIRST_MIGRATION_CUSTOM_SQL_REQUIREMENTS_DEFINED=YES
DOCKER_AVAILABLE=NO
DOCKER_ENGINE_AVAILABLE=NO
DOCKER_COMPOSE_AVAILABLE=NO
LOCAL_PSQL_AVAILABLE=NO
TEST_DB_STRATEGY=DOCKER_POSTGRES_ISOLATED
ISOLATED_TEST_DB_READY=NO
TEST_DB_ISOLATED=NO
POSTGRES_HEALTH=NOT_RUN
POSTGRES_CONNECTION_SMOKE=NOT_RUN
DATABASE_SCHEMA_CREATED=NO
MIGRATIONS_CREATED=NO
MIGRATIONS_APPLIED=NO
PRISMA_DB_PUSH_EXECUTED=NO
SQL_EXECUTED=NO
PRISMA_VALIDATE=PASS
PRISMA_GENERATE=PASS
PRISMA_CLIENT_WRAPPER_CREATED=NO
TYPECHECK=PASS
TESTS=PASS
BUILD=PASS
LOCAL_HEALTH_SMOKE=PASS
AUTH_USE_CASES_IMPLEMENTED=NO
TRIP_USE_CASES_IMPLEMENTED=NO
DISPATCH_ENGINE_IMPLEMENTED=NO
WORKER_IMPLEMENTED=NO
HTTP_DOMAIN_ENDPOINTS_IMPLEMENTED=NO
FRONTEND_INTEGRATION=NO
FRONTEND_UNCHANGED=YES
SECRET_SCAN=PASS
DELIGO_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES
PHASE_2B_COMMIT_SHA=RECORDED_IN_FINAL_RESPONSE
SCHEMA_GATE=PASS
TEST_DB_GATE=BLOCKED
PHASE_2B=PARTIAL_PASS
WORKTREE_CLEAN_AFTER=YES
NEXT_ACTION=Preparar un runtime PostgreSQL LOCAL/TEST aislado; no crear migration todavía.
```
