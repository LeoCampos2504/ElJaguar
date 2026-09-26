# Arquitectura del backend mínimo persistente y contrato de datos

## 1. Contexto

Este documento diseña, sin implementar, el backend mínimo persistente para `remis-norte-prototipo`.

La arquitectura debe soportar cuentas de Passenger, sesiones, Agency, Drivers, disponibilidad, Vehicles, ubicación actual, Trips, tarifas versionadas, eventos, ofertas exclusivas, dispatch secuencial por cercanía, cancelaciones, ownership, idempotencia, auditoría y lecturas operativas.

La decisión de negocio vigente tiene precedencia:

- dispatch `PROXIMITY_FIRST_STRICT_SEQUENTIAL`;
- selección automática `NEAREST_FIRST`;
- una sola oferta `PENDING` por Trip;
- aceptación obligatoria del Driver;
- asignación manual sólo como `FALLBACK_AND_OVERRIDE`;
- APP con Passenger autenticado;
- cancelación Passenger permitida hasta `ARRIVED`;
- antiabuso diferido;
- `BACKEND_BLOCKERS_REMAINING=0`.

No se copia el dominio de DeliGO ni se migra Remis a Next.js. DeliGO se utiliza únicamente como referencia conceptual para sesiones revocables, ownership, transacciones, eventos y seguridad.

## 2. Scope

Incluido:

- arquitectura de servicios;
- layout futuro del repositorio;
- runtime/framework recomendado;
- PostgreSQL/ORM y límites de Prisma;
- entidades y contratos conceptuales;
- relaciones, constraints e índices;
- sesiones, roles y Agency;
- disponibilidad y ubicación;
- Trip, dispatch, offers y worker;
- transacciones, concurrencia, recovery e idempotencia;
- draft de API no implementable todavía;
- polling sin realtime;
- seguridad, tests, ambientes y despliegue futuro.

Excluido:

- código fuente;
- schema Prisma real;
- migraciones;
- SQL ejecutable;
- DB real;
- endpoints implementados;
- instalación de paquetes;
- configuración Railway;
- realtime, push, PWA, mapas, routing, pagos y economía.

## 3. Baseline

```text
PROJECT_NAME=remis-norte-prototipo
PROJECT_ROOT=C:\Leo Campos\Trabajo\EL JAGUAR
FUNCTIONAL_BASELINE_SHA=f4fde2cb4bf3032b2bdde02d3d171426169cd68d
EXPECTED_DOCUMENTATION_HEAD=34513a0635af0715ce98701186c6c8e413ce5d72
BRANCH=main
```

El frontend existente es un prototipo React/Vite funcional y permanece sin modificaciones. El backend futuro será un servicio separado.

## 4. Business invariants

Estas invariantes no son decisiones técnicas abiertas:

```text
DISPATCH_MODE=PROXIMITY_FIRST_STRICT_SEQUENTIAL
AUTOMATED_CANDIDATE_SELECTION=YES
CANDIDATE_ORDER=NEAREST_FIRST
MAX_ACTIVE_OFFERS_PER_TRIP=1
SIMULTANEOUS_DRIVER_OFFERS=NO
PRECREATED_FUTURE_OFFERS=NO
OFFER_NEXT_DRIVER_ONLY_AFTER_PREVIOUS_CLOSED=YES
DRIVER_ACCEPTANCE_REQUIRED=YES
DIRECT_ASSIGNMENT_PRIMARY=NO
MANUAL_DISPATCH_ROLE=FALLBACK_AND_OVERRIDE
```

```text
APP_PASSENGER_ACCOUNT_POLICY=AUTHENTICATED_ACCOUNT_REQUIRED
APP_GUEST_MODE=DISABLED
PASSENGER_ID_SOURCE=SESSION_ONLY
PHONE_TRIP_WITHOUT_ACCOUNT=YES
PASSENGER_CANCELLABLE_STATES=REQUESTED,ASSIGNED,DRIVER_EN_ROUTE,ARRIVED
PASSENGER_CANCELLATION_IN_PROGRESS=NO
ANTI_ABUSE_CANCELLATION_POLICY=FUTURE
```

`Trip.status` mantiene exactamente `REQUESTED`, `ASSIGNED`, `DRIVER_EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED` y `CANCELLED`. `SEARCHING`, `OFFERED` y `WAITING_ACCEPTANCE` no son estados de Trip.

## 5. Recommended architecture

```text
EXISTING_VITE_CLIENT
          |
          | HTTPS / JSON / cookie session
          v
SEPARATE_API_SERVICE (Node.js + Fastify + TypeScript)
          |
          +--> PostgreSQL through Prisma + controlled SQL migrations
          |
          +--> periodic dispatch worker using the same DB
          |
          +--> external side effects later, after domain commit
```

La separación permite conservar el prototipo frontend, aislar la autoridad de seguridad en servidor y evolucionar el backend sin una migración grande de framework.

La primera versión no necesita microservicios adicionales, Redis, WebSocket ni una cola externa. API y worker pueden compartir código de dominio y acceso a DB, aunque sus procesos sean separables operacionalmente.

## 6. Repository layout

Estructura futura recomendada, no aplicada:

```text
PROJECT_ROOT/
├─ src/                         # frontend Vite existente
├─ server/
│  ├─ src/
│  │  ├─ app/                   # composición Fastify/plugins
│  │  ├─ auth/                  # sesiones y resolución de actor
│  │  ├─ domain/                # Trip, dispatch, permisos, eventos
│  │  ├─ application/           # casos de uso/transacciones
│  │  ├─ infrastructure/        # Prisma, repositorios, clock, config
│  │  ├─ http/                  # routes/adapters, no reglas de dominio
│  │  └─ worker/                 # polling/recovery de dispatch
│  └─ package.json
├─ prisma/                      # schema y migraciones futuras
├─ docs/
│  └─ reports/
├─ package.json                 # frontend existente, sin mezclar aún
└─ ...
```

RECOMMENDED_REPOSITORY_LAYOUT=EXISTING_SRC_PLUS_SEPARATE_SERVER_AND_PRISMA

Se recomienda mantener inicialmente dos paquetes con responsabilidades claras, no convertir el proyecto en un monorepo genérico. Si más adelante se comparten tipos, pueden extraerse contratos mínimos sin compartir internals de DB ni reglas duplicadas.

## 7. Runtime/framework decision

### Alternativas consideradas

| Opción | Simplicidad | TypeScript/validación | Testing | Railway | Mantenimiento | Decisión |
|---|---|---|---|---|---|---|
| Node.js + Fastify + TypeScript | Alta | Buen ecosistema de plugins y schemas | Buen soporte HTTP/integración | Directo | Alta | Recomendada |
| Node.js + Express + TypeScript | Muy alta inicial | Requiere elegir más piezas | Maduro | Directo | Alta | Válida, menos estructurada |
| Bun + framework HTTP | Media | Rápido, pero menor uniformidad operativa | Debe validarse por librería | Posible | Media | No prioritaria |
| Otra | Variable | Sin razón concreta | Variable | Variable | Variable | No justificada |

### Selección

```text
RECOMMENDED_BACKEND_RUNTIME=NODE_JS
RECOMMENDED_BACKEND_FRAMEWORK=FASTIFY
```

WHY=Fastify ofrece un contrato HTTP explícito, plugins, validación basada en schemas, buen soporte TypeScript, testing con inject, performance suficiente y despliegue simple como servicio Node.

`Fastify` se recomienda por su contrato HTTP explícito, plugins, validación basada en schemas, buen soporte TypeScript, testing con `inject`, performance suficiente para este dominio y despliegue simple como servicio Node. Express sigue siendo una alternativa razonable si el equipo prioriza familiaridad, pero no aporta una ventaja funcional necesaria.

No se instala ni se modifica ninguna dependencia en esta fase.

## 8. ORM / database

```text
DATABASE_RECOMMENDATION=POSTGRESQL
RECOMMENDED_ORM=PRISMA
```

PostgreSQL es adecuado para relaciones, transacciones, locks, índices parciales, timestamps, constraints y consultas de dispatch. Prisma aporta tipos, migraciones normales y acceso consistente para el código de aplicación.

### Límites importantes

- índices únicos parciales como `WHERE status='PENDING'` no deben asumirse expresables directamente en el schema Prisma;
- pueden requerir una migración SQL controlada y tests de contrato;
- `SELECT ... FOR UPDATE`, advisory locks u otras construcciones específicas pueden requerir SQL controlado dentro de una transacción;
- las restricciones físicas de una sola oferta activa no deben reemplazarse por validaciones de aplicación;
- cualquier raw SQL debe estar encapsulado en infraestructura, parametrizado y revisado.

Se recomienda Prisma para el modelo ordinario y SQL de migración sólo para invariantes que el ORM no pueda expresar. No se copia el schema de DeliGO.

## 9. Data model overview

Entidades mínimas recomendadas:

| Entidad | Necesidad | Decisión |
|---|---|---|
| `Agency` | Límite de ownership y configuración | Tabla separada |
| `User` | Identidad autenticable | Tabla separada |
| `Session` | Sesión revocable | Tabla separada |
| `AgencyMembership` | Rol por Agency | Tabla separada |
| `PassengerProfile` | Historial y datos de pasajero autenticado | Tabla separada 1:1 con User |
| `Driver` | Recurso operativo por Agency | Tabla separada |
| `Vehicle` | Vehículo asignable | Tabla separada |
| `DriverVehicleAssignment` | Asociación actual/histórica flexible | Relación separada recomendada |
| `Trip` | Agregado principal | Tabla separada |
| `DispatchSearch` | Estado de búsqueda separado de Trip | Tabla 1:1 con Trip |
| `TripOffer` | Oferta e historial secuencial | Tabla separada |
| `DriverLocation` | Snapshot latest para ranking | Una fila vigente por Driver |
| `Zone` | Zona lógica/manual | Tabla separada |
| `FareVersion` | Versión inmutable de tarifa | Tabla separada |
| `FareRule` | Importe por zona/origen/destino | Tabla separada |
| `TripEvent` | Historia funcional append-only | Tabla separada |
| `AuditLog` | Acciones sensibles/admin | Tabla separada |
| `IdempotencyRecord` | Deduplicación de comandos | Tabla separada |

`DriverAvailability` no se recomienda como tabla independiente en MVP. El estado manual vive en `Driver`; `BUSY` se deriva de Trips/ofertas activas. Si la operación futura requiere turnos, presencia o múltiples dispositivos, puede extraerse a una entidad específica.

## 10. Entity contracts

### Agency

Identifica la remisería operadora y el tenant lógico. Debe tener identidad estable, nombre visible, estado activo y timestamps. Todos los recursos operativos deben resolver su Agency.

### User

Identidad autenticable global:

- `id`;
- `email` nullable;
- `phoneNormalized` nullable;
- `passwordHash`;
- `isActive`;
- `createdAt`;
- `updatedAt`.

Debe existir al menos un identificador autenticable. Nunca se guarda password en texto. Un User puede tener una o varias memberships y no se asume un rol permanente único.

### Session

Sesión opaca y revocable DB-backed:

- `id`;
- `userId`;
- `tokenHash`;
- `expiresAt`;
- `revokedAt` nullable;
- `createdAt`;
- `lastUsedAt` nullable.

El token crudo sólo vive en el cliente/cookie futura; DB conserva hash. No se fija nombre de cookie ni proveedor de hashing.

### AgencyMembership

Asocia User, Agency y rol operativo:

- `userId`;
- `agencyId`;
- `role` entre `DRIVER`, `DISPATCHER`, `ADMIN`;
- `isActive`;
- timestamps.

Una constraint única evita memberships duplicadas incoherentes. Los roles efectivos provienen de sesión/membership, nunca del cliente.

### PassengerProfile

Perfil de un Passenger autenticado asociado a User:

- `userId` único;
- nombre visible;
- teléfono normalizado/contacto;
- preferencias futuras;
- timestamps.

La identidad de Passenger es distinta del contacto operacional de un Trip PHONE/DISPATCHER con `passengerId=null`.

### Driver

Recurso Agency-scoped:

- `id`;
- `agencyId`;
- `userId`;
- `isEnabled`;
- `availabilityStatus` en `OFFLINE`, `AVAILABLE` o `UNAVAILABLE`;
- timestamps.

`isEnabled` representa habilitación de cuenta/operación. `availabilityStatus` representa disponibilidad manual. `BUSY` se deriva de Trips u ofertas incompatibles.

### Vehicle

Recurso Agency-scoped:

- `id`;
- `agencyId`;
- `plate` normalizada;
- `brand`;
- `model`;
- `color`;
- `isActive`;
- timestamps.

No se borra físicamente un vehículo usado por viajes históricos.

### DriverVehicleAssignment

Relación recomendada para no atar Vehicle a un único Driver para siempre:

- `driverId`;
- `vehicleId`;
- `agencyId`;
- `isCurrent` o intervalo de vigencia conceptual;
- timestamps.

El MVP puede mantener una sola relación vigente por Driver, pero la relación permite cambios, turnos e historial sin cambiar `Trip.vehicleId`. La asignación aceptada se snapshottea en Trip.

### Trip

El agregado conserva:

- `id`, `agencyId`;
- `passengerId` nullable;
- `createdByUserId` nullable;
- `createdByActorType`;
- `requestSource`;
- `originText`, `destinationText`;
- `originLat`, `originLng` nullable;
- `destinationLat`, `destinationLng` nullable;
- `originZoneId`, `destinationZoneId` nullable;
- `driverId`, `vehicleId` nullable;
- `status`;
- `fareAmount`, `fareCurrency`, `fareVersionId` nullable;
- `notes` nullable;
- `passengerDisplayName`, `contactPhone`, `referenceNotes` sólo como contacto operacional cuando corresponda y con minimización;
- timestamps de ciclo de vida;
- cancelación: `cancelReasonCode`, `cancelReasonText`, `cancelledByActorType`, `cancelledByUserId`;
- `createdAt`, `updatedAt`.

No se agregan estados de dispatch al campo `status`.

## 11. Relationships

Relaciones conceptuales:

```text
Agency 1---N AgencyMembership N---1 User
User 1---0..1 PassengerProfile
Agency 1---N Driver N---1 User
Agency 1---N Vehicle
Driver 1---N DriverVehicleAssignment N---1 Vehicle
Agency 1---N Trip N---0..1 PassengerProfile
Trip 1---1 DispatchSearch
Trip 1---N TripOffer N---1 Driver
Driver 1---0..1 DriverLocation
Agency 1---N Zone
Agency 1---N FareVersion 1---N FareRule
Trip 1---N TripEvent
Agency 1---N AuditLog
User 1---N Session
```

PHONE/DISPATCHER puede crear Trip sin PassengerProfile, con `passengerId=null` y contacto operacional en el Trip.

## 12. Constraints

Constraints conceptuales prioritarias:

- User debe tener email o teléfono autenticable;
- `AgencyMembership(userId, agencyId, role)` no se duplica;
- Driver pertenece a una Agency y su User debe estar habilitado;
- Vehicle pertenece a una Agency;
- Trip, Driver, Vehicle, Zone y tarifa deben compartir Agency cuando se relacionan;
- Trip status sólo admite los siete valores cerrados;
- `TripOffer.status` sólo admite `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`;
- una sola oferta `PENDING` por Trip;
- un Driver no recibe otra oferta incompatible `PENDING`;
- sólo el Driver owner puede aceptar/rechazar;
- `expiresAt` requerido para una oferta pendiente, sujeto a configuración;
- no se asigna Trip desde una oferta vencida;
- idempotency key única por scope;
- tokenHash de Session único;
- dinero nunca Float;
- eventos y audit log no se reescriben para ocultar historia.

## 13. Indexes

Índices mínimos justificados:

| Entidad | Índice | Motivo |
|---|---|---|
| Trip | `(agencyId, status, createdAt)` | Panel operativo y búsqueda por estado |
| Trip | `(passengerId, createdAt)` | Historial Passenger |
| Trip | `(driverId, status)` | Trips asignados y derivación BUSY |
| TripOffer | `(tripId, status)` | Historial y oferta activa |
| TripOffer | `(driverId, status)` | Oferta vigente del Driver |
| TripOffer | `(status, expiresAt)` | Worker de timeout |
| Driver | `(agencyId, availabilityStatus, isEnabled)` | Candidatos iniciales |
| DriverLocation | `driverId UNIQUE` | Snapshot latest |
| DriverLocation | `(agencyId, recordedAt)` | Evaluación/limpieza operacional |
| Session | `tokenHash UNIQUE` | Resolución de sesión |
| Session | `(userId, expiresAt)` | Revocación y sesiones activas |
| FareVersion | `(agencyId, effectiveFrom, effectiveTo)` conceptual | Versión vigente |
| FareRule | `(fareVersionId, originZoneId, destinationZoneId)` | Lookup tarifario |
| TripEvent | `(tripId, createdAt)` | Historial de viaje |
| AuditLog | `(agencyId, createdAt)` | Auditoría operativa |
| IdempotencyRecord | `(scope, key) UNIQUE` | Deduplicación |

No agregar índices sólo por simetría. La consulta de cercanía inicial filtra candidatos y calcula distancia en aplicación; no se prescribe PostGIS para el MVP.

## 14. Sessions/auth

### Recomendación

Sesión opaca, hasheada y revocable en DB. El servidor recibe cookie futura HttpOnly y busca `tokenHash`.

Cookies futuras:

- `HttpOnly`;
- `SameSite` apropiado al despliegue;
- `Secure` fuera de desarrollo local;
- expiración alineada con Session;
- revocación explícita en logout o incidente.

### DB session vs JWT

| Criterio | DB session | JWT |
|---|---|---|
| Revocación inmediata | Simple | Requiere denylist/rotación |
| Payload/PII | No viaja en token | Riesgo de exposición/claims stale |
| MVP | Directo | Más piezas de seguridad |
| Multi-instancia | DB compartida | Verificación distribuida |
| Complejidad | Baja | Media |

Se recomienda DB session. JWT no es requisito y se evita hasta que exista una razón concreta de integración.

El hashing de password debe usar un estándar adaptativo moderno; no se fija librería todavía.

## 15. Agency/roles

`User` es global; `AgencyMembership` es el scope de rol. Un mismo User puede tener una membership de Driver en una Agency y otra membership operativa distinta si el negocio lo requiere, siempre con permisos explícitos.

Roles:

- Passenger: identidad de Passenger y ownership propio;
- Driver: oferta propia y Trips asignados;
- Dispatcher: operación de su Agency;
- Admin: administración de su Agency según permisos;
- System: automatismos internos, no sesión humana.

```text
AGENCY_AUTHORITY_SOURCE=MVP server configuration / authorized context
```

Futuro: subdominio, slug o selección autorizada. Nunca `body.agencyId` como autoridad.

Capas de autorización:

1. autenticar Session;
2. resolver User y rol/membership;
3. resolver Agency scope;
4. cargar recurso;
5. verificar ownership/permiso;
6. validar dominio;
7. ejecutar transacción.

## 16. Driver availability

### Estrategias consideradas

- Persistir `availabilityStatus` manual y derivar `BUSY` de Trips/ofertas activas.
- Persistir un estado completo que incluya `BUSY` como valor mutable.

### Selección

```text
DRIVER_AVAILABILITY_STRATEGY=MANUAL_STATUS_PLUS_DERIVED_BUSY
```

Se persiste sólo el estado manual `OFFLINE`, `AVAILABLE` o `UNAVAILABLE`. `BUSY` se deriva de:

- Trip activo incompatible asignado;
- oferta `TripOffer PENDING` incompatible;
- otra condición operativa futura explícita.

Esto evita que un proceso olvide volver de `BUSY` a `AVAILABLE` y permite reconstruir la elegibilidad desde datos de dominio. Un Driver `BUSY` no recibe ofertas. Un Driver con oferta pendiente incompatible no recibe otra.

## 17. Driver location

Para MVP se recomienda latest snapshot:

```text
DRIVER_LOCATION_STRATEGY=LATEST_SNAPSHOT_ONLY
LOCATION_HISTORY=FUTURE
```

Una fila vigente por Driver contiene `driverId`, `agencyId`, `lat`, `lng`, `accuracy`, `recordedAt`, `updatedAt`.

El Driver autenticado publica su propia ubicación. El backend valida rango, Agency y tamaño/frecuencia. `recordedAt` permite aplicar:

```text
now - recordedAt <= LOCATION_FRESHNESS_WINDOW
```

El valor exacto queda configurado más adelante. Una ubicación stale deja de ser elegible, pero no se borra automáticamente. Si después se necesita historial GPS, se agrega un stream/tabla de puntos con retención separada sin cambiar el contrato de latest location.

## 18. Trip

Trip es el agregado que contiene la operación, no el ranking ni el detalle de cada oferta. Conserva el snapshot de tarifa, actor creador, ruta, Agency, Driver/Vehicle aceptados, estado y timestamps.

Las mutaciones deben pasar por casos de uso explícitos:

- create;
- assign/accept;
- en-route;
- arrived;
- start;
- complete;
- cancel;
- reassign/release.

No se expone un `PATCH status=...` genérico. Cada operación recibe un estado esperado, actor, ownership, precondiciones, evento y timestamps.

## 19. DispatchSearch

Se recomienda tabla one-to-one con Trip:

```text
DISPATCH_SEARCH_MODEL=SEPARATE_ONE_TO_ONE
```

Motivo: dispatch tiene ciclo de vida, recovery, attempt count, worker state y `stoppedAt` propios. Meterlo en Trip mezclaría estado funcional con estado de proceso.

Estados:

- `SEARCHING`;
- `WAITING_FOR_RESPONSE`;
- `NO_CANDIDATES`;
- `MANUAL_INTERVENTION`;
- `ASSIGNED`;
- `STOPPED`.

Campos conceptuales:

- `id`;
- `tripId` unique;
- `status`;
- `startedAt`;
- `lastEvaluatedAt`;
- `stoppedAt` nullable;
- `attemptCount`;
- `version`;
- `createdAt`;
- `updatedAt`.

## 20. TripOffer

`TripOffer` persiste cada intento y su resultado:

- `id`;
- `tripId`;
- `agencyId`;
- `driverId`;
- `vehicleId` nullable;
- `rank`;
- `distanceSnapshot`;
- `status`;
- `offeredAt`;
- `expiresAt`;
- `respondedAt` nullable;
- `response` nullable;
- `version`;
- `createdAt`;
- `updatedAt`.

Estados: `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`.

TripOffer guarda el detalle de oferta. TripEvent sólo registra hitos como `DRIVER_ASSIGNED`, `TRIP_CANCELLED` y dispatch iniciado/exhausto.

## 21. Fare/Zone

### Zone

MVP lógico/manual:

- `id`;
- `agencyId`;
- `name`;
- `code`;
- `isActive`.

Trip puede conservar `originZoneId` y `destinationZoneId` nullable. No se diseñan polygons, geofencing ni geocoding.

### FareVersion

Versión inmutable de la política de tarifa:

- `id`;
- `agencyId`;
- `versionLabel`;
- `currency`;
- `effectiveFrom`;
- `effectiveTo` nullable;
- `isActive`;
- timestamps.

### FareRule

Regla simple versionada:

- `fareVersionId`;
- `originZoneId`;
- `destinationZoneId`;
- importe en unidad segura;
- metadata mínima.

Trip copia `fareAmount`, `fareCurrency` y `fareVersionId`. Una nueva versión nunca modifica viajes históricos.

## 22. TripEvent

Append-only funcional:

- `id`;
- `tripId`;
- `agencyId`;
- `eventType`;
- `actorType`;
- `actorUserId` nullable;
- `fromStatus` nullable;
- `toStatus` nullable;
- `metadata` nullable, sanitizada;
- `createdAt`.

Eventos mínimos:

- `TRIP_REQUESTED`;
- `FARE_SNAPSHOT_CREATED`;
- `TRIP_DISPATCH_STARTED`;
- `DRIVER_ASSIGNED`;
- `DRIVER_EN_ROUTE`;
- `DRIVER_ARRIVED`;
- `TRIP_STARTED`;
- `TRIP_COMPLETED`;
- `TRIP_CANCELLED`;
- `TRIP_DISPATCH_EXHAUSTED` opcional.

No se almacena cada punto GPS como TripEvent. Offer history vive en TripOffer.

## 23. AuditLog

AuditLog registra acciones administrativas/sensibles, no cada transición funcional ordinaria.

Campos conceptuales:

- `id`;
- `agencyId` nullable;
- `actorUserId` nullable;
- `actorType`;
- `action`;
- `resourceType`;
- `resourceId`;
- `metadata` sanitizada;
- `createdAt`.

Acciones ejemplo: manual assignment, manual reassignment, fare changes, Driver changes, Vehicle changes, Zone changes, permission changes.

No guardar tokens, passwords, secrets, URLs privadas ni PII innecesaria. Un override de Central puede producir `TripEvent DRIVER_ASSIGNED` y `AuditLog MANUAL_OVERRIDE`.

## 24. Idempotency

`IdempotencyRecord` soporta comandos repetibles:

- `id`;
- `scope`;
- `key`;
- `fingerprint`;
- `status`;
- referencia al resultado;
- `createdAt`;
- `expiresAt` nullable.

Constraint conceptual:

```text
UNIQUE(scope, key)
```

Regla:

- mismo key + mismo fingerprint: devolver resultado existente;
- mismo key + fingerprint distinto: `IDEMPOTENCY_CONFLICT`;
- crear la reserva de idempotencia y el resultado del comando dentro de una operación protegida.

Obligatorio para `CREATE_TRIP`; retry-safe para Accept, Reject, Timeout, Cancel y transiciones. Callbacks externos futuros también deben usarlo.

## 25. Money

```text
MONEY_STORAGE_STRATEGY=INTEGER_MINOR_UNITS_WITH_EXPLICIT_CURRENCY_SCALE
```

No usar Float. `fareAmount` es entero en la unidad menor definida por la política de moneda. Para ARS, si el negocio opera en pesos enteros, `scale=0` y ARS 2500 se conserva como 2500 unidades de negocio; si en el futuro se requieren centavos, la política de escala debe ser explícita y no reinterpretar snapshots históricos.

`fareCurrency` acompaña siempre al importe. FareVersion define la interpretación vigente; Trip conserva snapshot inmutable.

Decimal es una alternativa válida si el negocio necesita fracciones y cálculos complejos, pero no es necesario para el MVP si se usa integer minor units con escala explícita.

## 26. Dispatch worker

```text
DISPATCH_WORKER_STRATEGY=PERIODIC_DATABASE_WORKER_NO_EXTERNAL_QUEUE
```

Se recomienda un proceso periódico que usa PostgreSQL como fuente de verdad, sin Redis/queue externa en el MVP. Puede vivir como proceso separado del API aunque comparta paquete de dominio y DB.

Responsabilidades:

1. detectar `DispatchSearch SEARCHING` sin oferta;
2. calcular/recalcular candidatos;
3. crear sólo la primera oferta elegible;
4. detectar `PENDING` con `expiresAt <= now`;
5. cerrar la oferta como `EXPIRED`;
6. volver a `SEARCHING`;
7. revalidar y crear la siguiente oferta;
8. marcar `NO_CANDIDATES` cuando corresponde;
9. recuperar búsquedas inconsistentes después de una caída.

El worker no depende de timers en memoria. `expiresAt`, estados, locks y constraints viven en DB. El intervalo exacto queda como configuración futura.

Alternativas descartadas para MVP:

- lógica sólo dentro de requests: no garantiza progreso si nadie llama la API;
- queue/Redis: agrega infraestructura antes de demostrar necesidad;
- scheduled external service: puede evaluarse si el despliegue no ofrece worker persistente.

## 27. Concurrency

### Oferta única por Trip

La garantía física principal es un índice único parcial de PostgreSQL:

```text
UNIQUE(tripId) WHERE status='PENDING'
```

La misma regla se recomienda para un Driver:

```text
UNIQUE(driverId) WHERE status='PENDING'
```

si `MAX_ACTIVE_COMPATIBLE_OFFERS_PER_DRIVER=1` se mantiene como regla de MVP.

La DB garantiza que dos transacciones no puedan dejar dos PENDING incompatibles. La transacción garantiza que la búsqueda, cierre y creación siguiente observen estados consistentes. Prisma no expresa directamente todos los índices parciales; se requiere migración SQL controlada.

### Worker

Cada worker toma un `DispatchSearch` o Trip candidato con lock de fila/lease corto, comprueba estado esperado, crea o cierra una oferta y libera/commitea. Dos workers pueden competir, pero sólo uno gana el estado esperado y el índice parcial evita la segunda oferta.

No confiar en lock en memoria.

## 28. Transactions

### CREATE_TRIP

Operación conceptual:

1. resolver Session;
2. resolver Passenger desde sesión;
3. resolver Agency autorizada;
4. validar input;
5. seleccionar FareVersion/FareRule;
6. reservar IdempotencyRecord;
7. crear Trip `REQUESTED`;
8. persistir snapshot de tarifa;
9. crear `TripEvent TRIP_REQUESTED` y `FARE_SNAPSHOT_CREATED`;
10. crear `DispatchSearch SEARCHING`;
11. commit;
12. activar dispatch después del commit.

Notificaciones no participan de la transacción.

### CREATE_TRIP_PHONE / DISPATCHER

Convergen en la misma operación con `requestSource` distinto y `passengerId=null` permitido. El contacto operacional se valida y minimiza.

### ACCEPT_OFFER

1. autenticar Session Driver;
2. bloquear/revalidar Offer;
3. comprobar owner, `PENDING`, no vencida;
4. comprobar Trip `REQUESTED`;
5. comprobar Driver elegible, Agency y Vehicle;
6. Offer -> `ACCEPTED`;
7. Trip -> `ASSIGNED`, Driver/Vehicle y `assignedAt`;
8. DispatchSearch -> `ASSIGNED`;
9. crear `DRIVER_ASSIGNED`;
10. commit;
11. efectos externos.

### REJECT_OFFER

1. bloquear Offer PENDING del Driver;
2. comprobar Trip REQUESTED;
3. Offer -> `REJECTED`, `respondedAt`;
4. DispatchSearch -> `SEARCHING`;
5. commit;
6. worker reevalúa y crea la siguiente oferta bajo el lock/invariante.

No crear la siguiente Offer en una operación insegura ni antes de cerrar la anterior.

### TIMEOUT

1. seleccionar Offer PENDING vencida;
2. competir con ACCEPT mediante lock/estado esperado;
3. si gana timeout: Offer -> `EXPIRED`;
4. DispatchSearch -> `SEARCHING`;
5. Trip sigue REQUESTED;
6. commit;
7. worker busca siguiente.

Si ACCEPT ganó, el worker no puede expirar la Offer.

### MANUAL_OVERRIDE

1. autenticar Dispatcher/Admin;
2. comprobar Agency y Trip REQUESTED;
3. comprobar Driver/Vehicle C válidos;
4. Offer A PENDING -> `CANCELLED`;
5. Trip -> `ASSIGNED`, Driver/Vehicle C;
6. DispatchSearch -> `ASSIGNED`;
7. crear `DRIVER_ASSIGNED`;
8. crear `AuditLog MANUAL_OVERRIDE`;
9. commit.

### PASSENGER_CANCEL

En `REQUESTED`, `ASSIGNED`, `DRIVER_EN_ROUTE` o `ARRIVED`, comprobar Passenger de sesión y estado esperado. Si existe Offer PENDING, cancelarla en la misma operación cuando corresponda. En `IN_PROGRESS`, rechazar antes de mutar.

## 29. API draft

Los siguientes nombres son provisionales y no son endpoints implementados.

### Auth

- `POST /auth/login`;
- `POST /auth/logout`;
- `GET /auth/session`.

### Passenger

- `POST /trips`;
- `GET /trips/active`;
- `GET /trips/:id`;
- `POST /trips/:id/cancel`;
- `GET /trips/history`.

### Driver

- `GET /driver/offers/current`;
- `POST /driver/offers/:id/accept`;
- `POST /driver/offers/:id/reject`;
- `POST /driver/location`;
- `POST /driver/availability`;
- `POST /trips/:id/en-route`;
- `POST /trips/:id/arrived`;
- `POST /trips/:id/start`;
- `POST /trips/:id/complete`.

### Dispatch/Admin

- `GET /dispatch/trips`;
- `POST /dispatch/trips/:id/assign`;
- `POST /dispatch/trips/:id/reassign`;
- `POST /dispatch/trips/:id/release`;
- `GET /admin/drivers`;
- `GET /admin/vehicles`;
- `GET /admin/fares`.

Contrato HTTP de alto nivel:

- request contiene sólo input funcional y key de idempotencia;
- actor, Agency, role, status y ownership se resuelven server-side;
- respuesta de éxito contiene estado actual y datos visibles por rol;
- no se devuelven secretos, metadata interna ni PII ajena;
- no se exponen URLs internas de DB/worker.

## 30. Polling strategy

Fase 1 no requiere WebSocket:

- Passenger consulta Trip activo y estado/versión;
- Driver consulta su oferta actual y Trip asignado;
- Dispatcher consulta lista operativa y `DispatchSearchStatus`.

Intervalos quedan configurables y no se fijan en este documento. El contrato debe soportar:

- `ETag`/`If-None-Match`, o equivalente;
- `updatedAt`/versión;
- cursor para listas;
- respuesta 304 o respuesta vacía cuando no hubo cambios.

Realtime, push y PWA quedan posteriores al flujo persistente.

## 31. Recovery/reconciliation

Un worker periódico de reconciliación debe detectar:

| Inconsistencia | Recuperación conceptual |
|---|---|
| Trip REQUESTED + DispatchSearch SEARCHING sin Offer | Recalcular elegibles y crear primera Offer bajo lock |
| Trip REQUESTED + Offer PENDING vencida | Expirar Offer y volver a SEARCHING |
| Trip REQUESTED + Offer PENDING no vencida | Mantener espera; no crear otra |
| Trip ASSIGNED + Offer PENDING | Cancelar/invalidate Offer inconsistente y conservar asignación |
| DispatchSearch WAITING_FOR_RESPONSE sin Offer | Reparar a SEARCHING y reanudar |
| DispatchSearch NO_CANDIDATES | Mantener hasta intervención o nueva condición elegible |
| Trip CANCELLED + Offer PENDING | Cancelar Offer; STOPPED |
| dos ofertas PENDING detectadas | Fallar cerrado, registrar incidente y resolver con constraint/operación administrativa |

La reconciliación debe ser idempotente y no crear efectos duplicados.

## 32. Security

| Riesgo | Mitigación |
|---|---|
| IDOR de Trip | Cargar recurso y comprobar ownership/Agency en servidor |
| Cross-Agency access | Agency desde sesión/contexto; FK y filtros en cada query |
| Driver spoofing | Driver desde Session; ignorar driverId autoritativo del cliente |
| Passenger spoofing | `passengerId=SESSION_ONLY`; no aceptar body/query como autoridad |
| Offer theft | Offer sólo visible/aceptable por `driverId` owner |
| Late acceptance | Estado PENDING, `expiresAt`, transacción y estado esperado |
| Double assignment | CAS/row lock + partial unique index + transacción |
| Stale location | `recordedAt`, freshness window y exclusión de candidatos stale |
| Brute-force login | rate limit por IP/cuenta y respuestas genéricas |
| Session theft | token opaco, hash DB, cookie HttpOnly/SameSite/Secure y revocación |
| PII en logs | metadata sanitizada; no loggear tokens, password, URLs/DB secrets |
| Race conditions | expected status, version/lock, constraints y operaciones atómicas |
| Manual override race | validar Trip REQUESTED y cerrar Offer PENDING en la misma transacción |
| Oferta paralela | índice parcial `tripId WHERE status=PENDING` |

## 33. Testing strategy

Suites futuras separadas:

- `UNIT`: parsers, money, distance, freshness y errores puros;
- `DOMAIN`: transiciones, elegibilidad, permissions, ranking;
- `API`: auth, status HTTP y response filtering;
- `DB INTEGRATION`: transactions, FK, índices y idempotencia;
- `CONCURRENCY`: accept/timeout, workers, override/cancel;
- `WORKER`: recovery, no candidates, stale offers;
- `SECURITY`: IDOR, cross-Agency, spoofing, offer theft y PII.

Casos mínimos:

- nearest eligible Driver first;
- sólo una Offer activa;
- reject -> siguiente;
- timeout -> siguiente;
- late accept denied;
- manual override race;
- cancel durante Offer;
- double accept;
- dos workers;
- cross Agency;
- Passenger ownership;
- Driver ownership;
- stale location;
- Driver BUSY excluido;
- Create Trip idempotente;
- PHONE sin Passenger account;
- APP sin sesión rechazada.

Tests destructivos de DB sólo contra TEST separada; nunca contra Production.

## 34. Environment variables

Sólo nombres futuros, nunca valores:

| Variable | SECRET | Purpose | Consumer |
|---|---|---|---|
| `DATABASE_URL` | YES | Conexión PostgreSQL | API, worker, migraciones controladas |
| `API_PORT` | NO | Puerto HTTP | API |
| `ENVIRONMENT` | NO | Local/Test/Production | API, worker |
| `CORS_ORIGIN` | NO | Origin del Vite client | API |
| `SESSION_COOKIE_SECURE` | NO | Política cookie por ambiente | API |
| `SESSION_TTL_SECONDS` | NO | Duración sesión | API |
| `OFFER_TIMEOUT_SECONDS` | NO | Timeout configurable de oferta | API/worker |
| `LOCATION_FRESHNESS_WINDOW_SECONDS` | NO | Frescura de ubicación | dispatch worker |
| `DISPATCH_WORKER_INTERVAL_SECONDS` | NO | Intervalo de polling del worker | worker |
| `DISPATCH_MAX_SEARCH_RADIUS` | NO | Límite futuro de candidatos | worker |
| `SESSION_SECRET` | YES, sólo si una integración lo requiere | Secreto auxiliar; no necesario para DB token hash | API |

No se inventan secretos ni valores. `DATABASE_URL` y credenciales equivalentes nunca aparecen en logs o respuestas.

## 35. Deployment compatibility

No se configura Railway. Topología futura compatible:

```text
Railway service: frontend static hosting o hosting existente
Railway service: API Node/Fastify
Railway service: periodic dispatch worker
Railway plugin/service: PostgreSQL
```

Inicialmente API y worker pueden compartir imagen/repository con comandos distintos. Si el costo operativo lo exige, el worker puede correr como proceso de la misma instancia sólo mientras exista una única instancia controlada; la garantía sigue en DB, no en memoria.

Ambientes futuros:

- `LOCAL`;
- `TEST` con DB separada;
- `PRODUCTION` con DB separada y credenciales propias.

Nunca ejecutar tests destructivos contra Production. No se tocan Railway ni Production en esta fase.

## 36. Implementation phases

Orden futuro recomendado:

1. backend skeleton Fastify, configuración y health;
2. PostgreSQL, Prisma y migraciones controladas;
3. User, Session, Agency y AgencyMembership;
4. PassengerProfile, Driver, Vehicle y availability derivada;
5. DriverLocation latest y freshness;
6. Zone, FareVersion, FareRule y money;
7. Trip, TripEvent, transitions e idempotencia;
8. DispatchSearch, TripOffer e índices parciales;
9. worker de dispatch, timeout y recovery;
10. API contracts y authorization filters;
11. integración frontend Vite mediante polling;
12. tests de concurrencia y seguridad;
13. realtime/push sólo si la operación lo justifica.

## 37. Open technical decisions

### BLOCKING_BEFORE_IMPLEMENTATION

1. **Política de migraciones SQL controladas**: confirmar que el proyecto aceptará migrations custom para índices parciales y locks que Prisma no expresa directamente.
2. **Topología inicial del worker**: confirmar si el primer despliegue tendrá un proceso/servicio separado para el worker o un único proceso controlado con responsabilidades separadas.

```text
BLOCKING_TECHNICAL_DECISIONS_COUNT=2
```

Estas decisiones no reabren reglas de negocio. El diseño recomendado ya está definido; sólo requieren confirmación operativa antes de implementar.

### CAN_DEFER

- valor exacto de `OFFER_TIMEOUT_SECONDS`;
- `LOCATION_FRESHNESS_WINDOW_SECONDS`;
- `MAX_SEARCH_RADIUS`;
- provider de mapas/routing;
- GPS history/retención;
- realtime, push y PWA;
- antiabuso;
- pagos, comisión, caja y liquidaciones;
- proveedor de verificación de email/teléfono;
- detalle de cookie y hashing, manteniendo el contrato de sesión revocable.

## 38. Risks

- **Prisma parcial**: si se omite la migration SQL, la regla de una oferta activa queda sólo en aplicación. Mitigación: custom migration y test de constraint.
- **Worker duplicado**: dos workers pueden crear ofertas si no hay lock/estado esperado. Mitigación: row lock/lease, transacción e índice parcial.
- **Stale location**: ranking incorrecto si se usa última ubicación vencida. Mitigación: freshness window y exclusión.
- **Worker caído**: Trip queda REQUESTED con búsqueda detenida. Mitigación: worker periódico y reconciliación al reiniciar.
- **Scope incorrecto**: IDOR/cross-Agency. Mitigación: Agency derivada server-side y filtros de ownership.
- **Session revocada**: acceso posterior a logout. Mitigación: DB-backed Session con `revokedAt`.
- **Exceso de modelo inicial**: complejidad prematura. Mitigación: latest location, polling y sin queue/realtime.
- **PII operacional**: contacto PHONE disperso en logs. Mitigación: minimización y sanitización.
- **Money reinterpretado**: cambios de escala alteran historial. Mitigación: integer units con currency scale y snapshot.
- **Override de Central**: aceptación tardía de oferta cancelada. Mitigación: una transacción que cierra Offer y asigna Trip.

## 39. Recommendation next action

Resolver las dos decisiones técnicas bloqueantes —migrations SQL controladas e instancia/topología inicial del worker— antes de implementar el esqueleto del backend.

## 40. Markers

BACKEND_ARCHITECTURE_DESIGN=PASS
BUSINESS_GATE_FOR_BACKEND=PASS
BACKEND_BLOCKERS_REMAINING=0
FRONTEND_STRATEGY=KEEP_VITE
BACKEND_SERVICE_SEPARATE=YES
DATABASE_RECOMMENDATION=POSTGRESQL
BACKEND_RUNTIME_SELECTED=YES
BACKEND_FRAMEWORK_SELECTED=YES
ORM_SELECTED=YES
DATA_MODEL_DEFINED=YES
SESSION_MODEL_DEFINED=YES
AGENCY_MODEL_DEFINED=YES
DRIVER_MODEL_DEFINED=YES
VEHICLE_MODEL_DEFINED=YES
DRIVER_AVAILABILITY_DEFINED=YES
DRIVER_LOCATION_MODEL_DEFINED=YES
TRIP_MODEL_DEFINED=YES
DISPATCH_SEARCH_MODEL_DEFINED=YES
TRIP_OFFER_MODEL_DEFINED=YES
MAX_ACTIVE_OFFERS_DB_GUARANTEE_DEFINED=YES
FARE_MODEL_DEFINED=YES
ZONE_MODEL_DEFINED=YES
TRIP_EVENT_MODEL_DEFINED=YES
AUDIT_LOG_MODEL_DEFINED=YES
IDEMPOTENCY_MODEL_DEFINED=YES
DISPATCH_WORKER_DEFINED=YES
TIMEOUT_RECOVERY_DEFINED=YES
CONCURRENCY_STRATEGY_DEFINED=YES
TRANSACTION_BOUNDARIES_DEFINED=YES
API_DRAFT_DEFINED=YES
POLLING_STRATEGY_DEFINED=YES
SECURITY_REVIEW_DEFINED=YES
TEST_PLAN_DEFINED=YES
IMPLEMENTATION_PHASES_DEFINED=YES

SOURCE_CODE_TOUCHED=NO
DELIGO_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Resolver las dos decisiones técnicas bloqueantes sobre migrations SQL controladas y topología inicial del worker antes de implementar.
