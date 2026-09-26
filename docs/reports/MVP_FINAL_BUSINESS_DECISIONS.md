# Decisiones finales de negocio del MVP

## 1. Contexto

Este documento cierra las dos decisiones de negocio que permanecían bloqueantes para diseñar el backend de `remis-norte-prototipo`:

1. política de cancelación del Passenger;
2. requisito de cuenta para solicitar viajes desde la APP.

La documentación de dominio, casos de uso y dispatch por cercanía se mantiene sin modificaciones. Este documento agrega la decisión final que debe prevalecer al diseñar el backend.

No se implementa backend, frontend, Prisma, DB, migraciones, endpoints, dependencias, deploy ni producción.

## 2. Scope

Incluido:

- cancelación del Passenger;
- cancelación durante búsqueda y oferta activa;
- cancelación desde `ARRIVED`;
- prohibición de cancelación normal desde `IN_PROGRESS`;
- frontera futura de antiabuso;
- requisito de autenticación para `CREATE_TRIP_APP`;
- autoridad de sesión sobre `passengerId`;
- viajes PHONE/DISPATCHER sin cuenta;
- impacto sobre casos de uso;
- flujo MVP consolidado;
- escenarios de aceptación;
- estado final de blockers.

Fuera de alcance:

- penalidades;
- cargos económicos;
- scoring;
- bloqueos automáticos;
- suspensión;
- cantidad máxima de cancelaciones;
- implementación técnica de auth;
- cookies, JWT, DB, Prisma y endpoints.

## 3. Estado previo

Los documentos anteriores dejaban abiertas dos decisiones:

- la política exacta de cancelación, aunque el contrato permitía cancelar antes de `IN_PROGRESS`;
- si `CREATE_TRIP_APP` requería pasajero autenticado o admitía guest.

La decisión de dispatch ya estaba cerrada como:

```text
PROXIMITY_FIRST_STRICT_SEQUENTIAL
DRIVER_ACCEPTANCE_REQUIRED=YES
MAX_ACTIVE_OFFERS_PER_TRIP=1
```

Este documento no altera esa decisión. La complementa con las reglas finales de cancelación y cuenta.

## 4. Passenger cancellation decision

```text
PASSENGER_CANCELLATION_POLICY=ALLOWED_UNTIL_TRIP_START
```

El Passenger puede cancelar su propio Trip mientras el estado sea:

- `REQUESTED`;
- `ASSIGNED`;
- `DRIVER_EN_ROUTE`;
- `ARRIVED`.

La regla incluye todo el período de búsqueda y oferta de chofer. `ARRIVED` sigue siendo cancelable porque el viaje todavía no comenzó.

Desde `IN_PROGRESS` el Passenger no puede cancelar por el flujo normal.

`COMPLETED` y `CANCELLED` son estados terminales y no admiten una nueva cancelación.

La autoridad siempre proviene del Passenger autenticado asociado al Trip; no del `passengerId` enviado por el cliente.

## 5. Cancellation states

| Estado actual | Passenger puede cancelar | Resultado |
|---|---|---|
| `REQUESTED` | YES, si es su propio Trip | `CANCELLED` |
| `ASSIGNED` | YES, si es su propio Trip | `CANCELLED` |
| `DRIVER_EN_ROUTE` | YES, si es su propio Trip | `CANCELLED` |
| `ARRIVED` | YES, si es su propio Trip | `CANCELLED` |
| `IN_PROGRESS` | NO por flujo normal | `INVALID_TRANSITION`; Trip permanece `IN_PROGRESS` |
| `COMPLETED` | NO | `TRIP_ALREADY_COMPLETED` o equivalente |
| `CANCELLED` | No hay nueva mutación | retry idéntico puede devolver resultado final idempotente |

```text
CANCELLATION_ALLOWED_BEFORE_IN_PROGRESS=YES
PASSENGER_CANCELLATION_IN_PROGRESS=NO
```

Dispatcher y Admin conservan la regla previa: pueden cancelar Trips de su Agency antes de `IN_PROGRESS`. Driver no cancela directamente el Trip. System sólo cancela mediante una regla futura explícita.

## 6. Cancellation during dispatch

Passenger puede cancelar mientras:

- `Trip.status=REQUESTED`;
- `DispatchSearchStatus=SEARCHING`;
- `DispatchSearchStatus=WAITING_FOR_RESPONSE`;
- `DispatchSearchStatus=NO_CANDIDATES`;
- `DispatchSearchStatus=MANUAL_INTERVENTION`.

Si existe una oferta activa:

```text
Trip REQUESTED -> CANCELLED
TripOffer PENDING -> CANCELLED
DispatchSearchStatus -> STOPPED
```

No se crea la siguiente oferta. La búsqueda activa debe detenerse completamente. Un worker que intente continuar después de la cancelación debe perder la carrera por el estado esperado y no crear `REJECTED`, `EXPIRED` ni una oferta para el siguiente Driver.

No debe ocurrir:

```text
Trip CANCELLED
Offer cerrada
-> siguiente Driver
```

## 7. ARRIVED cancellation

`ARRIVED` es cancelable por Passenger en el MVP.

Esto significa:

- el Driver ya llegó al origen;
- el viaje todavía no está `IN_PROGRESS`;
- Passenger puede cancelar su propio Trip;
- se registra `TRIP_CANCELLED` con actor y motivo;
- no se define penalidad económica;
- no se define compensación;
- no se define bloqueo ni suspensión.

Estas consecuencias pueden revisarse en una futura fase económica o de antiabuso, pero no forman parte del MVP actual.

## 8. IN_PROGRESS restriction

Escenario normativo:

```text
GIVEN Trip.status=IN_PROGRESS
WHEN Passenger intenta cancelar
THEN DENY
```

Resultado obligatorio:

- Trip permanece `IN_PROGRESS`;
- no se crea `TRIP_CANCELLED`;
- no se modifican timestamps;
- se devuelve `INVALID_TRANSITION` o el error vigente equivalente;
- no se ejecutan efectos secundarios de cancelación.

La restricción evita mezclar la cancelación normal con una interrupción de viaje, emergencia, disputa o tratamiento económico todavía no definido.

## 9. Future anti-abuse boundary

```text
ANTI_ABUSE_CANCELLATION_POLICY=FUTURE
```

En el futuro podrán existir medidas para detectar cancelaciones reiteradas o uso indebido. Esta capacidad será separada de la transición de dominio y no se implementa ahora.

Queda explícitamente fuera de esta decisión:

- penalidades;
- bloqueos automáticos;
- scoring;
- suspensión;
- cargos económicos;
- cantidad máxima de cancelaciones;
- límites temporales por Passenger;
- cambios de rating;
- cambios de comisión.

Una cancelación válida del MVP no altera la disponibilidad del Driver, no penaliza al Passenger y no genera una sanción implícita.

## 10. Cancel reasons

Se conserva el contrato conceptual:

- `cancelReasonCode`;
- `cancelReasonText` opcional;
- `cancelledByActorType`;
- `cancelledByActorId`;
- `cancelledAt`.

Catálogo simple conceptual para Passenger:

- `PASSENGER_CHANGED_MIND`;
- `PASSENGER_NO_LONGER_NEEDS_TRIP`;
- `WRONG_ORIGIN`;
- `WRONG_DESTINATION`;
- `OTHER`.

`OTHER` requiere `cancelReasonText=YES`.

No se agregan motivos económicos ni se usa `cancelReasonText` como fuente de reglas. El texto debe minimizar PII y no contener secretos.

## 11. Passenger account decision

```text
APP_PASSENGER_ACCOUNT_POLICY=AUTHENTICATED_ACCOUNT_REQUIRED
APP_GUEST_MODE=DISABLED
CREATE_TRIP_APP_AUTH_REQUIRED=YES
PASSENGER_ID_SOURCE=SESSION_ONLY
```

Para solicitar un viaje desde la APP, Passenger debe:

1. tener una cuenta;
2. iniciar sesión;
3. contar con una sesión válida;
4. crear el Trip para sí mismo.

No existe modo guest en el MVP para `CREATE_TRIP_APP`.

`passengerId` efectivo se obtiene exclusivamente de la sesión autenticada. No son fuentes de autoridad:

- body;
- query;
- route;
- local storage;
- cualquier valor enviado por el cliente.

`body.passengerId` debe ignorarse o rechazarse como dato no autoritativo. Un Passenger A autenticado nunca puede crear un Trip para Passenger B mediante spoofing.

## 12. Session authority

La futura sesión resolverá el actor real y su `passengerId`. Los casos que requieren cuenta y sesión son:

- `CREATE_TRIP_APP`;
- `VIEW_ACTIVE_TRIP_PASSENGER`;
- `VIEW_TRIP_HISTORY`;
- `CANCEL_TRIP_PASSENGER`.

El servidor debe volver a comprobar ownership en cada operación. Un guard de entrada no reemplaza la comprobación de que el Trip pertenece al Passenger de la sesión.

La política no decide todavía cookies, tokens, JWT, duración de sesión ni implementación de auth.

## 13. Phone/manual passengers

La cuenta obligatoria aplica sólo a la APP del Passenger. No invalida los canales internos:

- `CREATE_TRIP_PHONE`;
- `CREATE_TRIP_DISPATCHER`.

Central puede crear viajes para personas sin cuenta y mantener:

- `passengerId=null`;
- `passengerDisplayName` nullable;
- `contactPhone` nullable;
- `referenceNotes` nullable.

Estos datos son `OPERATIONAL_CONTACT_DATA`:

- no crean una cuenta automáticamente;
- no crean un User automáticamente;
- no representan un actor autenticado;
- deben minimizar PII;
- pertenecen al contexto operativo del Trip;
- no son autoridad para ownership de una sesión.

## 14. Affected use cases

### UC-01 CREATE_TRIP_APP

```text
AUTH_REQUIRED=YES
GUEST_ALLOWED=NO
PRIMARY_ACTOR=AUTHENTICATED_PASSENGER
PASSENGER_ID_SOURCE=SESSION_ONLY
AGENCY=SERVER_RESOLVED
INITIAL_STATE=REQUESTED
IDEMPOTENCY=REQUIRED
```

El Passenger crea sólo para sí. La sesión determina `passengerId`; la Agency, estado, tarifa e identidad creadora son resueltos por el servidor.

### UC-12 CANCEL_TRIP_PASSENGER

```text
AUTH_REQUIRED=YES
OWNERSHIP=SESSION_PASSENGER_ONLY
ALLOWED_STATES=REQUESTED,ASSIGNED,DRIVER_EN_ROUTE,ARRIVED
DENY_STATES=IN_PROGRESS,COMPLETED
RETRY=CANCELLED final idempotente
```

Durante una oferta activa, la cancelación cierra la oferta y detiene dispatch. Desde `ARRIVED` sigue permitida. No hay penalidad.

### UC-02 y UC-03

`CREATE_TRIP_PHONE` y `CREATE_TRIP_DISPATCHER` permanecen disponibles para Dispatcher/Admin con scope de Agency y pueden usar `passengerId=null`. No heredan el requisito de cuenta de la APP.

### Lecturas

Las vistas de Passenger requieren cuenta y sesión. Passenger sólo ve sus propios Trips y datos permitidos; no ve auditoría, ranking, candidatos ni ubicaciones de Drivers no asignados.

## 15. Consolidated MVP flow

```text
Passenger
   |
   v
Login
   |
   v
Sesión válida
   |
   v
CREATE_TRIP_APP
   |
   v
REQUESTED
   |
   v
Dispatch proximity-first strict sequential
   |
   +--> Passenger cancela hasta ARRIVED -> CANCELLED
   |
   v
Driver acepta oferta exclusiva
   |
   v
ASSIGNED
   |
   v
DRIVER_EN_ROUTE
   |
   v
ARRIVED
   |
   +--> Passenger puede cancelar -> CANCELLED
   |
   v
IN_PROGRESS
   |
   v
COMPLETED
```

Regla de cancelación del flujo:

```text
REQUESTED       -> Passenger ALLOW
ASSIGNED        -> Passenger ALLOW
DRIVER_EN_ROUTE -> Passenger ALLOW
ARRIVED         -> Passenger ALLOW
IN_PROGRESS     -> Passenger DENY
COMPLETED       -> Passenger DENY
CANCELLED       -> estado terminal; retry final seguro
```

## 16. Acceptance scenarios

### SCENARIO 1 — APP WITHOUT LOGIN

GIVEN: Passenger no tiene sesión.

WHEN: intenta `CREATE_TRIP_APP`.

THEN: se rechaza; no se crea Trip.

### SCENARIO 2 — AUTHENTICATED APP REQUEST

GIVEN: Passenger tiene sesión válida.

WHEN: crea un Trip válido.

THEN: Trip `REQUESTED` asociado al `passengerId` de la sesión.

### SCENARIO 3 — SPOOF PASSENGER ID

GIVEN: Passenger A está autenticado.

WHEN: envía `passengerId=B`.

THEN: el valor no es autoridad; el Trip sólo puede pertenecer a A.

### SCENARIO 4 — PHONE TRIP WITHOUT ACCOUNT

GIVEN: Dispatcher autenticado.

WHEN: crea un viaje PHONE para una persona sin cuenta.

THEN: el Trip es válido con `passengerId=null` y contacto operacional mínimo.

### SCENARIO 5 — CANCEL DURING SEARCH

GIVEN: Trip `REQUESTED`, dispatch `WAITING_FOR_RESPONSE`, Offer A `PENDING`.

WHEN: Passenger propietario cancela.

THEN: Trip `CANCELLED`, Offer A `CANCELLED`, dispatch `STOPPED`; no hay siguiente Driver.

### SCENARIO 6 — CANCEL ASSIGNED

GIVEN: Trip `ASSIGNED`.

WHEN: Passenger propietario cancela.

THEN: Trip `CANCELLED`; el Driver deja de operar ese Trip.

### SCENARIO 7 — CANCEL DRIVER_EN_ROUTE

GIVEN: Trip `DRIVER_EN_ROUTE`.

WHEN: Passenger propietario cancela.

THEN: Trip `CANCELLED`.

### SCENARIO 8 — CANCEL ARRIVED

GIVEN: Trip `ARRIVED`.

WHEN: Passenger propietario cancela.

THEN: Trip `CANCELLED`; no hay penalidad económica en el MVP.

### SCENARIO 9 — CANCEL IN_PROGRESS

GIVEN: Trip `IN_PROGRESS`.

WHEN: Passenger intenta cancelar.

THEN: `DENY`; Trip sigue `IN_PROGRESS`; no se crea `TRIP_CANCELLED`.

### SCENARIO 10 — CANCEL OTHER PASSENGER TRIP

GIVEN: Passenger A autenticado y Trip de Passenger B.

WHEN: A intenta cancelar.

THEN: `DENY` por ownership.

### SCENARIO 11 — CANCEL COMPLETED

GIVEN: Trip `COMPLETED`.

WHEN: Passenger intenta cancelar.

THEN: `DENY`; el estado terminal no cambia.

### SCENARIO 12 — CANCEL ALREADY CANCELLED

GIVEN: Trip `CANCELLED` por el mismo Passenger.

WHEN: repite la misma operación.

THEN: devuelve resultado final idempotente y no duplica el evento.

## 17. Decisions resolved

```text
CANCELLATION_POLICY_DECISION=RESOLVED
CANCELLATION_POLICY=PASSENGER_ALLOWED_UNTIL_IN_PROGRESS
PASSENGER_CANCELLABLE_STATES=REQUESTED,ASSIGNED,DRIVER_EN_ROUTE,ARRIVED
PASSENGER_CANCELLATION_IN_PROGRESS=NO
ANTI_ABUSE_POLICY=FUTURE

PASSENGER_ACCOUNT_DECISION=RESOLVED
APP_PASSENGER_ACCOUNT_POLICY=AUTHENTICATED_ACCOUNT_REQUIRED
APP_GUEST_MODE=DISABLED
CREATE_TRIP_APP_AUTH_REQUIRED=YES
PASSENGER_ID_SOURCE=SESSION_ONLY
PHONE_TRIP_WITHOUT_ACCOUNT=YES
```

## 18. Backend blockers

Con estas decisiones no quedan blockers de negocio para diseñar el backend mínimo:

```text
DISPATCH_BLOCKER_RESOLVED=YES
DRIVER_ACCEPTANCE_BLOCKER_RESOLVED=YES
CANCELLATION_BLOCKER_RESOLVED=YES
PASSENGER_ACCOUNT_BLOCKER_RESOLVED=YES
BACKEND_BLOCKERS_REMAINING=0
```

Esto no autoriza todavía a implementar. Sólo indica que la especificación de negocio necesaria para diseñar `Trip`, `TripOffer`, disponibilidad, ubicación, sesiones y dispatch ya está suficientemente cerrada.

## 19. Recommendation next phase

Diseñar el backend mínimo persistente y el contrato de datos incorporando `Trip`, `TripOffer`, `DriverAvailability`, `DriverLocation`, sesiones y dispatch secuencial por cercanía, sin implementar todavía.

La futura implementación debe conservar:

- cuenta autenticada obligatoria para `CREATE_TRIP_APP`;
- `passengerId` sólo desde sesión;
- cancelación Passenger hasta `ARRIVED`;
- rechazo desde `IN_PROGRESS`;
- cierre de oferta activa durante cancelación;
- antiabuso separado y diferido;
- PHONE/DISPATCHER con `passengerId=null` permitido.

## 20. Markers

MVP_FINAL_BUSINESS_DECISIONS=PASS
CANCELLATION_POLICY_DECISION=RESOLVED
PASSENGER_CANCELLATION_ALLOWED_UNTIL_IN_PROGRESS=YES
PASSENGER_CANCELLATION_REQUESTED=YES
PASSENGER_CANCELLATION_ASSIGNED=YES
PASSENGER_CANCELLATION_DRIVER_EN_ROUTE=YES
PASSENGER_CANCELLATION_ARRIVED=YES
PASSENGER_CANCELLATION_IN_PROGRESS=NO
ANTI_ABUSE_CANCELLATION_POLICY=FUTURE
PASSENGER_ACCOUNT_DECISION=RESOLVED
APP_PASSENGER_ACCOUNT_POLICY=AUTHENTICATED_ACCOUNT_REQUIRED
APP_GUEST_MODE=DISABLED
CREATE_TRIP_APP_AUTH_REQUIRED=YES
PASSENGER_ID_SOURCE=SESSION_ONLY
PHONE_TRIP_WITHOUT_ACCOUNT=YES
DISPATCH_BLOCKER_RESOLVED=YES
DRIVER_ACCEPTANCE_BLOCKER_RESOLVED=YES
CANCELLATION_BLOCKER_RESOLVED=YES
PASSENGER_ACCOUNT_BLOCKER_RESOLVED=YES
BACKEND_BLOCKERS_REMAINING=0
ACCEPTANCE_SCENARIOS_DEFINED=YES

SOURCE_CODE_TOUCHED=NO
DELIGO_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Diseñar backend mínimo persistente y contrato de datos incorporando Trip, TripOffer, DriverAvailability, DriverLocation, sesiones y dispatch secuencial por cercanía, sin implementar todavía.
