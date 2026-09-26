# Decisión operativa del MVP: dispatch por cercanía

## 1. Contexto

Este documento define la decisión operativa del MVP para dispatch de viajes de `remis-norte-prototipo`.

La recomendación histórica de asignación directa/manual como flujo principal queda superada para el MVP. La estrategia principal será selección automática por cercanía con oferta estrictamente secuencial a un solo Driver por vez. Central conserva capacidad de intervención manual como fallback y override.

Los documentos históricos no se modifican. Este documento los complementa y reemplaza específicamente en dispatch, selección de candidato, aceptación, cercanía, ofertas, timeout/rechazo e intervención de Central.

## 2. Scope

Incluido:

- selección automática de candidatos;
- ranking por cercanía al origen;
- oferta exclusiva a un Driver por vez;
- aceptación, rechazo, timeout y aceptación tardía;
- elegibilidad, disponibilidad y frescura de ubicación;
- `TripOffer` como concepto separado de `Trip.status`;
- búsqueda secuencial y revalidación;
- intervención manual de Central;
- estados de búsqueda de dispatch;
- visibilidad por actor;
- cancelación durante búsqueda;
- concurrencia y escenarios de aceptación.

No se implementa código, backend, Prisma, DB, migraciones, endpoints, mapas, routing, realtime, push, PWA ni deploy.

## 3. Corrección de decisión previa

La recomendación anterior `POLICY_A_DIRECT_ASSIGNMENT` como flujo principal queda reemplazada para el MVP.

La nueva decisión es:

```text
MVP_DISPATCH_MODE=PROXIMITY_FIRST_STRICT_SEQUENTIAL
AUTOMATED_CANDIDATE_SELECTION=YES
DRIVER_ACCEPTANCE_REQUIRED=YES
SIMULTANEOUS_DRIVER_OFFERS=NO
MAX_ACTIVE_OFFERS_PER_TRIP=1
```

La cercanía selecciona el orden de oferta; no asigna automáticamente el Trip. Sólo la aceptación válida del Driver propietario de la oferta activa consolida:

```text
Trip REQUESTED -> ASSIGNED
```

La asignación manual de Central continúa disponible como `FALLBACK_AND_OVERRIDE`, no como estrategia principal.

## 4. Dispatch mode

`PROXIMITY_FIRST_STRICT_SEQUENTIAL` significa:

1. El Trip se crea en `REQUESTED`.
2. El sistema identifica Drivers elegibles de la misma Agency.
3. Calcula o recibe una distancia comparable entre cada ubicación válida y el origen.
4. Ordena candidatos de menor a mayor distancia.
5. Selecciona sólo el primer candidato elegible.
6. Crea una única `TripOffer` `PENDING` para ese Driver.
7. Sólo ese Driver ve y recibe la oferta.
8. Espera `ACCEPT`, `REJECT` o `TIMEOUT`.
9. Si la oferta se cierra sin aceptación, revalida candidatos y crea la siguiente oferta.
10. Si el Driver acepta válidamente, la oferta pasa a `ACCEPTED` y el Trip pasa a `ASSIGNED`.

Mientras se ofrecen candidatos, `Trip.status` permanece `REQUESTED`. Los conceptos de búsqueda y espera pertenecen al dispatch, no a nuevos estados de Trip.

## 5. Driver eligibility

Un Driver es elegible sólo si todas estas condiciones se cumplen en el momento de la selección y se vuelven a comprobar antes de crear cada oferta:

- pertenece a la misma Agency del Trip;
- cuenta y habilitación activa;
- estado operativo compatible;
- disponibilidad `AVAILABLE`;
- no tiene un Trip activo incompatible;
- tiene ubicación conocida;
- ubicación suficientemente reciente;
- coordenadas válidas;
- se encuentra dentro del alcance operativo permitido, si la política lo define;
- no está suspendido ni bloqueado;
- no rechazó previamente la solicitud actual;
- no tiene otra oferta incompatible activa;
- Driver y vehículo cumplen requisitos operativos de la Agency.

`ACCOUNT_STATUS` y `OPERATIONAL_AVAILABILITY` son conceptos separados. Una cuenta activa no implica que el Driver esté disponible para recibir ofertas.

## 6. Driver availability

Estados conceptuales de `DriverAvailability`:

- `OFFLINE`: no participa en dispatch.
- `AVAILABLE`: puede ser candidato si el resto de condiciones se cumple.
- `BUSY`: tiene un Trip activo incompatible y no participa en nuevas ofertas.
- `UNAVAILABLE`: está habilitado como cuenta, pero no acepta ofertas temporalmente.

No se recomienda agregar `OFFERED` como estado persistente del Driver. `TripOffer` ya representa la oferta y su ownership. El Driver puede continuar conceptualmente `AVAILABLE` mientras:

```text
HAS_ACTIVE_OFFER=YES
```

Ese indicador derivado impide que reciba otra oferta incompatible. Para el MVP se recomienda:

```text
MAX_ACTIVE_COMPATIBLE_OFFERS_PER_DRIVER=1
```

Al aceptar, el Driver pasa conceptualmente a `BUSY` o deja de ser elegible. Deja de estar ocupado cuando sus Trips activos terminan en `COMPLETED` o `CANCELLED`, cuando se libera una asignación o cuando se reasigna el Trip a otro Driver.

Rechazar una oferta no suspende, no vuelve `UNAVAILABLE`, no aplica penalidad, no altera rating y no altera comisión. Sólo excluye al Driver de la búsqueda actual.

## 7. Driver location

`DriverLocation` es un concepto separado del estado del Driver y del historial funcional del Trip.

Campos conceptuales mínimos:

- `driverId`;
- `agencyId`;
- `lat`;
- `lng`;
- `accuracy` nullable;
- `recordedAt`.

Reglas:

- el Driver debe estar autenticado;
- `driverId` real proviene de la sesión, no del body del cliente;
- latitud y longitud deben estar dentro de rangos válidos;
- Agency debe coincidir con la Agency operadora;
- la ubicación debe ser suficientemente fresca para dispatch;
- una ubicación inválida o vencida no se usa para ordenar candidatos;
- no se exige GPS real en el prototipo visual.

```text
LOCATION_FRESHNESS_REQUIRED=YES
STALE_LOCATION_ELIGIBLE=NO
EXACT_LOCATION_FRESHNESS_WINDOW=DEFERRED_CONFIG
```

No se fija todavía el tiempo exacto de frescura.

## 8. Distance strategy

El criterio principal del MVP es:

```text
CANDIDATE_ORDER=NEAREST_FIRST
```

La distancia se calcula entre:

- coordenadas del origen del Trip;
- `DriverLocation` válida y fresca.

Interfaz conceptual:

```text
calculateDistance(origin, driverLocation) -> distanceMetric
```

### Fase de prototipo

Puede usar coordenadas y distancias mock para demostrar orden, oferta, rechazo, timeout y aceptación sin GPS real.

### Primera fase real

Puede usar distancia geográfica aproximada como criterio de ranking, sin bloquear el MVP por un proveedor de routing.

No se acopla el dominio a Google Maps, Mapbox, OSRM, Leaflet u otro proveedor.

La evolución futura puede agregar:

- distancia geodésica;
- distancia por ruta;
- ETA;
- tráfico.

La estrategia exacta queda diferida:

```text
DISTANCE_STRATEGY=DEFERRED_CONFIG
```

Opciones futuras: `GEODESIC`, `ROUTE_DISTANCE`, `ETA`.

## 9. Ranking

El ranking primario es exclusivamente:

```text
distance ASC
```

Sólo participan Drivers elegibles. No se usan todavía rating, antigüedad, cantidad de viajes, comisión, preferencias, score comercial, historial ni prioridad económica.

Para empate exacto se recomienda un criterio estable y simple:

```text
tie-break=driverId stable ascending
```

El desempate no puede alterar la prioridad principal por cercanía ni introducir un score comercial oculto.

## 10. Candidate revalidation

El ranking inicial no garantiza que el candidato siga elegible. Antes de crear cada oferta se debe revalidar:

- cuenta y habilitación;
- disponibilidad;
- Trip incompatible activo;
- ubicación fresca y válida;
- Agency;
- oferta incompatible activa;
- rechazo previo de esta solicitud.

La estrategia elegida para el MVP es recalcular o revalidar candidatos antes de cada nueva oferta. Si el candidato más cercano dejó de ser elegible, se excluye y se elige el siguiente candidato vigente.

No se crean ofertas futuras por anticipado. El siguiente candidato no se materializa hasta que la oferta actual se cierra.

## 11. TripOffer

`TripOffer` es un concepto de dominio separado de `Trip`. No se crea todavía una tabla ni un schema.

Campos conceptuales:

- `id`;
- `tripId`;
- `agencyId`;
- `driverId`;
- `rank`;
- `distanceSnapshot`;
- `status`;
- `offeredAt`;
- `expiresAt` nullable;
- `respondedAt` nullable;
- `response` nullable;
- `createdAt`;
- `updatedAt`.

Estados:

- `PENDING`: oferta visible exclusivamente para ese Driver.
- `ACCEPTED`: el Driver aceptó y consolidó la asignación.
- `REJECTED`: el Driver rechazó explícitamente.
- `EXPIRED`: venció el tiempo sin respuesta.
- `CANCELLED`: la oferta fue invalidada por cancelación, override o cambio operativo.

La distancia almacenada conceptualmente es un snapshot de ranking, no una promesa de ETA ni una medición de ruta.

## 12. Active offer invariant

Una oferta activa es:

```text
ACTIVE_TRIP_OFFER = TripOffer.status=PENDING
```

Invariante obligatoria:

```text
MAX_ACTIVE_OFFERS_PER_TRIP=1
COUNT(PENDING for the same tripId) <= 1
```

Nunca pueden existir simultáneamente:

```text
TripOffer A = PENDING
TripOffer B = PENDING
```

para el mismo Trip.

También queda prohibido:

```text
SIMULTANEOUS_DRIVER_OFFERS=NO
PRECREATED_FUTURE_OFFERS=NO
```

No se crean ofertas B o C para esconderlas mientras A está pendiente.

## 13. Sequential offering

Secuencia válida:

```text
Offer A = PENDING
    |
    +--> ACCEPTED  -> Trip ASSIGNED y detener búsqueda
    +--> REJECTED  -> cerrar A, revalidar y crear B
    +--> EXPIRED   -> cerrar A, revalidar y crear B
    +--> CANCELLED -> detener si fue cancelación/override; si la causa permite continuar, revalidar
```

```text
OFFER_NEXT_DRIVER_ONLY_AFTER_PREVIOUS_CLOSED=YES
```

Mientras espera A:

- Trip permanece `REQUESTED`;
- sólo A ve la solicitud;
- B y C no la ven;
- B y C no reciben notificación;
- B y C no pueden aceptar aunque conozcan el Trip ID;
- no hay ofertas futuras pre-creadas.

### Ejemplo obligatorio

| Driver | Distancia al origen | Orden |
|---|---:|---:|
| Driver A | 400 m | 1 |
| Driver B | 900 m | 2 |
| Driver C | 1,4 km | 3 |

1. El sistema crea sólo `TripOffer A=PENDING`.
2. Driver B y Driver C no ven el viaje.
3. Si A rechaza: `Offer A -> REJECTED`; recién después se crea `Offer B=PENDING`.
4. Mientras B está pendiente, C sigue sin ver el viaje.
5. Si B no responde y vence: `Offer B -> EXPIRED`; recién después se crea `Offer C=PENDING`.
6. Si C acepta: `Offer C -> ACCEPTED`, `Trip REQUESTED -> ASSIGNED`, `driverId=Driver C`.
7. No se crean ofertas posteriores.

## 14. Accept

Un Driver puede aceptar únicamente su propia `TripOffer PENDING`.

Precondiciones:

- Driver autenticado;
- ownership de la oferta;
- oferta `PENDING`;
- Trip `REQUESTED`;
- Driver aún elegible;
- Agency coincidente;
- oferta no vencida;
- ausencia de asignación previa;
- vehículo válido si es requisito operativo.

Operación conceptual atómica:

```text
TripOffer PENDING -> ACCEPTED
Trip REQUESTED -> ASSIGNED
Trip.driverId = Driver de la sesión
Trip.vehicleId = Vehicle válido
TripEvent = DRIVER_ASSIGNED
```

La distancia sólo definió el orden de oferta. La aceptación es el hecho que consolida la asignación.

## 15. Reject

El Driver puede rechazar únicamente su propia oferta `PENDING`.

Resultado:

```text
TripOffer PENDING -> REJECTED
Trip permanece REQUESTED
```

Después de cerrar completamente la oferta:

1. se excluye ese Driver de la búsqueda actual;
2. se revalidan candidatos;
3. se recalcula o confirma el ranking vigente;
4. se selecciona el siguiente Driver elegible;
5. se crea una única nueva `TripOffer PENDING`;
6. se muestra sólo al nuevo Driver.

El rechazo no cancela el Trip, no suspende al Driver, no lo marca `UNAVAILABLE`, no afecta rating y no genera penalidad.

## 16. Timeout

```text
OFFER_TIMEOUT_REQUIRED=YES
EXACT_OFFER_TIMEOUT=DEFERRED_CONFIG
```

Cuando vence `expiresAt` sin una aceptación válida:

```text
TripOffer PENDING -> EXPIRED
Trip permanece REQUESTED
EXPIRED_OFFER_ACCEPTABLE=NO
```

El Driver pierde inmediatamente la capacidad de aceptar esa oferta. Sólo después de cerrar la oferta se revalidan candidatos y se crea la siguiente oferta.

## 17. Late accept

Si Offer A está `EXPIRED` y Offer B está `PENDING`, un intento tardío de A debe ser rechazado con un error conceptual como:

```text
TRIP_OFFER_NOT_ACTIVE
```

El intento tardío no puede:

- cancelar B;
- reasignar el Trip;
- modificar el estado del Trip;
- crear `DRIVER_ASSIGNED`;
- crear una nueva oferta.

La operación debe dejar B intacta y válida.

## 18. Concurrency

Casos que deben quedar protegidos conceptualmente:

- `ACCEPT` compite con `TIMEOUT`: sólo una operación gana; nunca se asigna un Trip con una oferta que terminó `EXPIRED`.
- doble click de `ACCEPT`: el retry devuelve el resultado ya consolidado sin segundo evento/asignación.
- Central asigna manualmente mientras una oferta está `PENDING`: una sola operación consolida la asignación.
- Offer A expira y comienza B mientras llega un `ACCEPT` tardío de A: A pierde; B conserva validez.
- Passenger cancela con oferta activa: Trip se cancela y la oferta pasa a `CANCELLED`; no nace oferta siguiente.
- dos procesos intentan crear la siguiente oferta: el invariante de una única oferta `PENDING` debe mantenerse.

Protección conceptual recomendada:

```text
expectedTripStatus=REQUESTED
expectedOfferStatus=PENDING
offer ownership
transaction
conditional update
unique invariant for active offer
idempotent response
```

No se define SQL, Prisma ni implementación física.

## 19. DispatchSearchStatus

La búsqueda se modela separadamente de `Trip.status`.

Valores conceptuales:

- `SEARCHING`: el sistema está calculando/revalidando candidatos.
- `WAITING_FOR_RESPONSE`: existe exactamente una oferta `PENDING`.
- `NO_CANDIDATES`: no quedan candidatos elegibles.
- `MANUAL_INTERVENTION`: Central debe decidir o está aplicando override.
- `ASSIGNED`: una aceptación o asignación manual consolidó el Trip.
- `STOPPED`: búsqueda detenida por cancelación u otra regla terminal.

Ejemplo válido:

```text
Trip.status=REQUESTED
DispatchSearchStatus=WAITING_FOR_RESPONSE
TripOffer.status=PENDING
```

No se agregan `SEARCHING_DRIVER`, `OFFERED` ni `WAITING_ACCEPTANCE` a `Trip.status`.

## 20. No candidates

Si no existen Drivers elegibles, todos rechazaron, todos expiraron, todos quedaron `BUSY` o no hay ubicaciones frescas:

```text
Trip.status=REQUESTED
DispatchSearchStatus=NO_CANDIDATES
```

El Trip no se cancela automáticamente. Central puede intervenir. La experiencia del pasajero puede mostrar “Buscando un móvil…” o un mensaje equivalente, sin exponer la lista ni el motivo interno de cada candidato.

No se define todavía una cancelación automática por falta de candidatos.

## 21. Central override

Central puede observar:

- Trips `REQUESTED`;
- `DispatchSearchStatus`;
- Driver ofertado actualmente;
- snapshot de distancia;
- `offeredAt` y `expiresAt`;
- historial de ofertas `REJECTED` y `EXPIRED`;
- cantidad de candidatos intentados;
- `NO_CANDIDATES`.

Puede ejecutar:

- `MANUAL_ASSIGN_DRIVER`;
- `REASSIGN_DRIVER`;
- `RELEASE_DRIVER_ASSIGNMENT`;
- `CANCEL_TRIP`.

### Manual assignment con oferta activa

Si Central asigna manualmente Driver C mientras Driver A tiene una oferta `PENDING`, la operación conceptual es atómica:

```text
Offer A PENDING -> CANCELLED
Trip REQUESTED -> ASSIGNED
Trip.driverId = Driver C
DispatchSearchStatus = ASSIGNED
reasonCode = MANUAL_OVERRIDE
```

Driver A ya no puede aceptar. La causa se registra como `MANUAL_OVERRIDE`. La asignación manual es `FALLBACK_AND_OVERRIDE`, no flujo principal.

## 22. Passenger visibility

Cuando crea un viaje, Passenger ve `REQUESTED` y una experiencia equivalente a:

```text
“Buscando un móvil cercano…”
```

No ve:

- Driver ofertado actualmente;
- ranking;
- lista de Drivers;
- Drivers que rechazaron;
- Drivers que expiraron;
- ubicación de Drivers no asignados;
- distancia individual de candidatos;
- estado interno de la búsqueda;
- causa técnica de exclusión.

Cuando un Driver acepta válidamente, Passenger puede ver los datos permitidos del Driver, vehículo, patente, estado y ubicación autorizada. ETA queda para una decisión posterior.

## 23. Driver visibility

Sólo el Driver propietario de la `TripOffer PENDING` ve la solicitud.

Puede recibir:

- origen;
- destino;
- tarifa snapshot;
- distancia aproximada al origen;
- datos operativos mínimos;
- botón `ACCEPT`;
- botón `REJECT`;
- tiempo restante si se configura timeout.

No recibe:

- ranking completo;
- posición frente a otros Drivers;
- lista de otros Drivers;
- datos internos de Agency;
- PII innecesaria del pasajero;
- ofertas ajenas.

Para cualquier Driver que no sea owner de la oferta:

```text
OTHER_DRIVERS_CAN_VIEW_ACTIVE_OFFER=NO
OTHER_DRIVERS_CAN_DISCOVER_TRIP=NO
OTHER_DRIVERS_CAN_ACCEPT_TRIP=NO
```

Conocer un Trip ID no habilita lectura ni aceptación.

## 24. Driver busy/availability implications

Al aceptar una oferta:

```text
Trip -> ASSIGNED
Driver -> BUSY conceptualmente
```

El Driver no recibe otra oferta incompatible mientras tenga un Trip activo. La condición `BUSY` termina conceptualmente en `COMPLETED`, `CANCELLED`, `RELEASE_DRIVER_ASSIGNMENT` o cuando el Trip es reasignado a otro Driver.

Mientras un Driver tiene una oferta `PENDING`, se recomienda no ofrecerle otra oferta compatible adicional. Esto evita atención dividida, reduce carreras y mantiene predecible el MVP.

`OFFERED` no se persiste como estado principal del Driver; la oferta pertenece a `TripOffer`.

## 25. Cancellation during search

Si Passenger, Dispatcher o Admin cancela válidamente mientras existe una oferta `PENDING`:

```text
Trip REQUESTED -> CANCELLED
TripOffer PENDING -> CANCELLED
DispatchSearchStatus -> STOPPED
```

No se crea la siguiente oferta. El Driver deja de ver la solicitud. Una respuesta tardía de ese Driver se rechaza y no produce `DRIVER_ASSIGNED`.

La cancelación normal no se permite desde `IN_PROGRESS`, `COMPLETED` ni `CANCELLED`.

## 26. Events

`TripOffer` conserva el detalle de ofertas y respuestas. `TripEvent` conserva hitos funcionales relevantes.

Eventos conceptuales del dispatch:

- `TRIP_DISPATCH_STARTED`;
- `DRIVER_ASSIGNED` cuando una aceptación válida o override consolida la asignación;
- `TRIP_DISPATCH_EXHAUSTED` opcional cuando se recorrieron candidatos sin asignación y se llega a `NO_CANDIDATES`.

Los siguientes hechos pertenecen preferentemente al historial de `TripOffer`, no a una saturación de `TripEvent`:

- oferta creada para un Driver;
- oferta rechazada;
- oferta expirada;
- oferta cancelada;
- aceptación tardía rechazada.

La causa de `MANUAL_OVERRIDE` se registra en la operación y en el audit log correspondiente; no se borra el historial de ofertas.

## 27. Prototype behavior

### Cliente

```text
Crear viaje
  -> REQUESTED
  -> “Buscando un móvil cercano”
  -> espera sin ver candidatos
  -> Driver acepta
  -> Driver asignado
```

### Driver

```text
AVAILABLE
  -> recibe UNA solicitud si es candidato actual
  -> ACCEPT / REJECT
```

Si rechaza, vuelve a disponibilidad normal. Si acepta, el Trip se asigna y el Driver pasa conceptualmente a `BUSY`.

### Central

```text
Trip REQUESTED
  -> búsqueda automática
  -> Driver A ofertado
  -> rechazo/timeout
  -> Driver B ofertado
  -> aceptación
  -> ASSIGNED
```

El prototipo puede simular coordenadas, distancias, timeout, disponibilidad, aceptación y rechazo sin GPS real.

## 28. Acceptance scenarios

### SCENARIO 1 — CLOSEST DRIVER ONLY

GIVEN: Driver A está a 400 m, B a 900 m y C a 1,4 km; todos son elegibles.

WHEN: comienza dispatch.

THEN: sólo A recibe `TripOffer PENDING`; B y C no ven el Trip.

EXPECTED_TRIP_STATE=REQUESTED

### SCENARIO 2 — CLOSEST REJECTS

GIVEN: A tiene la única oferta `PENDING`.

WHEN: A rechaza.

THEN: A pasa a `REJECTED`; sólo después se crea B `PENDING`; C no ve el Trip.

### SCENARIO 3 — CLOSEST TIMES OUT

GIVEN: A tiene una oferta `PENDING`.

WHEN: vence `expiresAt`.

THEN: A pasa a `EXPIRED`, ya no puede aceptar y sólo después se crea B.

### SCENARIO 4 — SECOND DRIVER ACCEPTS

GIVEN: A fue rechazado y B está `PENDING`.

WHEN: B acepta.

THEN: B pasa a `ACCEPTED`; Trip `REQUESTED -> ASSIGNED`; `driverId=B`; no se crea C.

### SCENARIO 5 — LATE ACCEPT

GIVEN: A está `EXPIRED` y B está `PENDING`.

WHEN: A intenta aceptar.

THEN: se rechaza; Trip no cambia; B sigue válida.

### SCENARIO 6 — WRONG DRIVER ACCESS

GIVEN: la oferta activa pertenece a A.

WHEN: B intenta leer o aceptar.

THEN: `DENY`; B no obtiene información de la oferta ni modifica el Trip.

### SCENARIO 7 — NO DRIVERS

GIVEN: no hay Drivers elegibles.

WHEN: inicia dispatch.

THEN: Trip sigue `REQUESTED`; `DispatchSearchStatus=NO_CANDIDATES`; Central puede intervenir.

### SCENARIO 8 — STALE LOCATION

GIVEN: A es más cercano pero su ubicación está vencida; B tiene ubicación válida.

WHEN: se calculan candidatos.

THEN: A queda excluido y B recibe la única oferta.

### SCENARIO 9 — OTHER AGENCY

GIVEN: A es físicamente más cercano pero pertenece a otra Agency; B pertenece a la correcta.

WHEN: se calculan candidatos.

THEN: A nunca entra en la lista; B recibe la oferta.

### SCENARIO 10 — BUSY DRIVER

GIVEN: A es más cercano pero `BUSY`; B está `AVAILABLE`.

WHEN: se calculan candidatos.

THEN: A queda excluido; B recibe la única oferta.

### SCENARIO 11 — MANUAL OVERRIDE

GIVEN: A tiene oferta `PENDING`.

WHEN: Dispatcher asigna manualmente C.

THEN: A pasa a `CANCELLED`; Trip pasa a `ASSIGNED` con C; A ya no puede aceptar; causa `MANUAL_OVERRIDE`.

### SCENARIO 12 — PASSENGER CANCELS DURING OFFER

GIVEN: Trip `REQUESTED` y A `PENDING`.

WHEN: Passenger cancela válidamente.

THEN: Trip `CANCELLED`; oferta A `CANCELLED`; no se crea la siguiente oferta.

### SCENARIO 13 — ACCEPT VS TIMEOUT RACE

GIVEN: A está por vencer.

WHEN: `ACCEPT` y `TIMEOUT` compiten.

THEN: sólo una operación gana; nunca queda Trip asignado con oferta `EXPIRED`.

### SCENARIO 14 — DOUBLE ACCEPT RETRY

GIVEN: A aceptó correctamente.

WHEN: el cliente reintenta por timeout de red.

THEN: se devuelve resultado idempotente sin segundo evento ni segunda asignación.

### SCENARIO 15 — TWO NEXT-OFFER WORKERS

GIVEN: la oferta A acaba de cerrarse.

WHEN: dos procesos intentan generar la siguiente.

THEN: sólo una nueva oferta queda `PENDING`; `MAX_ACTIVE_OFFERS_PER_TRIP=1` se mantiene.

## 29. Decisions resolved

```text
DISPATCH_MODE_DECISION=RESOLVED
DISPATCH_MODE=PROXIMITY_FIRST_STRICT_SEQUENTIAL

DRIVER_ACCEPTANCE_DECISION=RESOLVED
DRIVER_ACCEPTANCE=REQUIRED

AUTO_CANDIDATE_SELECTION_DECISION=RESOLVED
AUTO_CANDIDATE_SELECTION=YES
CANDIDATE_ORDER=NEAREST_FIRST

SIMULTANEOUS_OFFER_DECISION=RESOLVED
SIMULTANEOUS_DRIVER_OFFERS=DISABLED
MAX_ACTIVE_OFFERS_PER_TRIP=1
PRECREATED_FUTURE_OFFERS=NO

MANUAL_DISPATCH_ROLE_DECISION=RESOLVED
MANUAL_DISPATCH_ROLE=FALLBACK_AND_OVERRIDE

BATCH_OFFERING=NOT_MVP
```

## 30. Deferred decisions

Estas decisiones quedan abiertas sin bloquear el prototipo visual ni la regla principal de oferta exclusiva:

- `EXACT_OFFER_TIMEOUT`;
- `EXACT_LOCATION_FRESHNESS_WINDOW`;
- `MAX_SEARCH_RADIUS`;
- `DISTANCE_STRATEGY`;
- `REAL_MAP_PROVIDER`;
- `ROUTING_PROVIDER`;
- `GPS_RETENTION`;
- `BATCH_OFFERING`, explícitamente `NOT_MVP`.

Ninguna permite ofertas simultáneas ni altera la obligación de comenzar por el Driver elegible más cercano.

## 31. Supersedes

Este documento reemplaza específicamente cualquier recomendación anterior que indique:

- dispatch manual como estrategia principal;
- `POLICY_A_DIRECT_ASSIGNMENT` como flujo principal;
- aceptación del Driver no requerida;
- proximidad/auto-selection diferible para el MVP;
- ofertas simultáneas a múltiples Drivers;
- ofertas futuras pre-creadas y ocultas.

No invalida:

- estados base de Trip;
- Agency y ownership;
- idempotencia;
- cancelación;
- `TripEvent`;
- `AuditLog`;
- reglas de lectura;
- separación entre dominio, API y UI;
- realtime posterior al flujo persistente.

## 32. Recommendation next phase

Diseñar el backend mínimo persistente incorporando `Trip`, `TripOffer`, disponibilidad, ubicación y dispatch secuencial por cercanía, sin implementar todavía.

La primera implementación futura debe proteger como invariantes: una única oferta activa por Trip, aceptación sólo del Driver owner, revalidación antes de cada oferta, cierre completo antes del siguiente candidato y override atómico de Central.

## 33. Markers

MVP_PROXIMITY_DISPATCH=PASS
DISPATCH_MODE=PROXIMITY_FIRST_STRICT_SEQUENTIAL
AUTOMATED_CANDIDATE_SELECTION=YES
CANDIDATE_ORDER=NEAREST_FIRST
OFFER_STRATEGY=STRICT_SEQUENTIAL_SINGLE_DRIVER
MAX_ACTIVE_OFFERS_PER_TRIP=1
SIMULTANEOUS_DRIVER_OFFERS=NO
PRECREATED_FUTURE_OFFERS=NO
OFFER_NEXT_DRIVER_ONLY_AFTER_PREVIOUS_CLOSED=YES
DRIVER_ACCEPTANCE_REQUIRED=YES
DIRECT_ASSIGNMENT_PRIMARY=NO
EXPIRED_OFFER_ACCEPTABLE=NO
REJECTED_OFFER_ACCEPTABLE=NO
OTHER_DRIVERS_CAN_VIEW_ACTIVE_OFFER=NO
OTHER_DRIVERS_CAN_ACCEPT_ACTIVE_TRIP=NO
LOCATION_FRESHNESS_REQUIRED=YES
STALE_LOCATION_ELIGIBLE=NO
MANUAL_DISPATCH_AVAILABLE=YES
MANUAL_DISPATCH_ROLE=FALLBACK_AND_OVERRIDE
TRIP_OFFER_DEFINED=YES
DRIVER_ELIGIBILITY_DEFINED=YES
DRIVER_AVAILABILITY_DEFINED=YES
DISPATCH_SEARCH_STATUS_DEFINED=YES
CONCURRENCY_POLICY_DEFINED=YES
NO_CANDIDATES_FLOW_DEFINED=YES
CANCELLATION_DURING_SEARCH_DEFINED=YES
PROTOTYPE_FLOW_DEFINED=YES
ACCEPTANCE_SCENARIOS_DEFINED=YES

SOURCE_CODE_TOUCHED=NO
DELIGO_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Diseñar backend mínimo persistente incorporando Trip, TripOffer, disponibilidad, ubicación y dispatch secuencial por cercanía, sin implementar todavía.
