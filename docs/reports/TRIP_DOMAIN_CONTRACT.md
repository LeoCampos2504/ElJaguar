# Contrato de dominio del viaje

## 1. Contexto

Este documento define el contrato conceptual del dominio de viajes para `remis-norte-prototipo`. Es una especificación de diseño, no una implementación.

El contrato toma como referencia conceptual la auditoría de DeliGO en `docs/reports/DELIGO_REUSE_AUDIT.md`: máquina de estados explícita, eventos append-only, ownership server-side, idempotencia, CAS/transacciones, audit log y separación entre dominio, API y UI.

No se copian conceptos gastronómicos de DeliGO. En particular, `Trip` es el agregado de transporte y no una adaptación de `Pedido`.

## 2. Scope

Incluido:

- actores y roles operativos;
- Agency como límite conceptual de ownership;
- entidad `Trip` y sus campos semánticos;
- fuente de solicitud;
- estados y transiciones;
- asignación y reasignación;
- cancelaciones operativas;
- snapshot de tarifa;
- zonas;
- eventos funcionales;
- límite de tracking/ubicación;
- autorización e idempotencia;
- concurrencia;
- errores de dominio;
- separación entre `TripEvent` y `AuditLog`.

Excluido:

- tablas SQL definitivas;
- tipos físicos de DB;
- endpoints definitivos;
- backend, frontend y APIs reales;
- Prisma, migraciones y dependencias;
- deploy, realtime, push y PWA.

## 3. Actores

Los siguientes valores son tipos conceptuales de actor. Una sesión futura resolverá el actor real; el cliente nunca será autoridad para elegir su propio actor.

### PASSENGER

Solicita viajes, consulta el estado de sus propios viajes, cancela dentro de las reglas permitidas y consulta su historial. No puede asignarse un chofer, cambiar una tarifa ni operar viajes ajenos.

### DRIVER

Declara disponibilidad, recibe o acepta una asignación según la política que se defina, confirma llegada, inicia y finaliza el viaje, y publica ubicación cuando corresponda. No puede asignarse arbitrariamente un viaje ajeno ni alterar su tarifa.

### DISPATCHER

Crea viajes telefónicos o manuales, asigna y reasigna choferes, consulta la operación y corrige datos operativos permitidos. Su alcance queda limitado a su Agency.

### ADMIN

Configura el sistema y administra choferes, vehículos, zonas y tarifas dentro de su Agency. Tiene acceso operativo completo según permisos futuros y puede ejecutar correcciones administrativas auditadas.

### SYSTEM

Ejecuta automatismos: timeouts, expiraciones, limpieza, reglas internas y futuros eventos automáticos. No representa una persona y debe dejar una causa técnica o regla aplicada en metadata cuando produzca un cambio.

## 4. Agency / Tenancy

`AGENCY_REQUIRED_IN_DOMAIN=YES`.

La Agency es el límite conceptual de operación, configuración y autorización. Inicialmente puede existir una sola Agency, pero el contrato no debe asumir que todos los datos pertenecen globalmente a una única remisería.

### Recursos con pertenencia obligatoria a Agency

Los siguientes recursos operativos son Agency-scoped:

- `Passenger`: la identidad puede ser reutilizable a nivel plataforma en el futuro, pero su relación operativa con viajes e historial queda contextualizada por Agency.
- `Driver`.
- `Vehicle`.
- `Trip`.
- `Zone`.
- `Fare`.
- `FareVersion`.
- `Notification`.
- `TripEvent`.

Un recurso sólo puede ser leído u operado si el actor tiene autorización sobre la misma Agency. El `agencyId` enviado por el cliente es un dato no confiable: la Agency efectiva se obtiene de la sesión, del recurso padre o de una asignación ya autorizada.

### Datos que podrían ser globales

Son candidatos a catálogo global, fuera de los recursos operativos anteriores:

- códigos de moneda;
- tipos de actor y permisos base;
- constantes de estado y error;
- configuraciones técnicas del sistema;
- catálogos geográficos de referencia, si en el futuro se comparten entre Agencys.

Aunque exista un catálogo global, cualquier uso que afecte a un viaje debe quedar contextualizado por la Agency del `Trip`.

No se implementa multi-tenancy en esta etapa; sólo se fija el ownership conceptual.

## 5. Trip

`Trip` es el agregado funcional que representa una solicitud de traslado desde su creación hasta su finalización o cancelación. Su estado actual es una vista operativa; la historia completa se conserva mediante `TripEvent`.

### Campos conceptuales mínimos

| Campo | Semántica |
|---|---|
| `id` | Identidad estable del viaje. No se redefine durante reasignaciones. |
| `agencyId` | Agency operadora y autoridad de ownership del viaje. |
| `passengerId` | Pasajero asociado; puede ser null para solicitudes telefónicas/manuales sin cuenta. |
| `createdByActorType` | Tipo de actor que creó el viaje: PASSENGER, DISPATCHER, ADMIN o SYSTEM. |
| `createdByActorId` | Identidad del actor creador; puede ser null para una creación SYSTEM sin sesión humana. |
| `driverId` | Chofer actualmente asignado; null mientras no haya asignación activa. |
| `vehicleId` | Vehículo asociado a la operación; puede ser null hasta la asignación o si no se conoce todavía. |
| `origin` | Descripción operativa del punto de origen, tal como debe verla dispatch/chofer/pasajero. |
| `destination` | Descripción operativa del destino. |
| `originLat` / `originLng` | Coordenadas opcionales del origen, si fueron confirmadas. |
| `destinationLat` / `destinationLng` | Coordenadas opcionales del destino, si fueron confirmadas. |
| `status` | Estado actual dentro de la máquina de estados definida en este documento. |
| `fareAmount` | Snapshot inmutable del importe acordado, expresado en unidades menores seguras según `FareVersion`. |
| `fareCurrency` | Moneda del snapshot; para el alcance actual, `ARS`. |
| `fareVersionId` | Referencia conceptual a la versión de tarifa usada; puede ser null si el precio fue cargado manualmente bajo una regla futura explícita. |
| `requestSource` | Origen de la solicitud: APP, PHONE, DISPATCHER u OTHER. |
| `notes` | Observaciones operativas; opcionales y sujetas a minimización de PII. |
| `requestedAt` | Momento en que la solicitud entró al dominio. |
| `assignedAt` | Primer momento de asignación activa; null si aún no fue asignado. |
| `arrivedAt` | Momento en que el chofer confirmó llegada. |
| `startedAt` | Momento en que el viaje comenzó. |
| `completedAt` | Momento de finalización exitosa. |
| `cancelledAt` | Momento de cancelación. |
| `createdAt` | Momento de creación técnica del registro. |
| `updatedAt` | Momento de última modificación válida del agregado. |
| `idempotencyKey` | Clave opcional de deduplicación de la operación de creación. |

Los timestamps de ciclo de vida deben ser monotónicos respecto de la transición que los produce. Una reasignación no reinicia `requestedAt`, `assignedAt` puede conservar el primer momento y los detalles de cada asignación quedan en eventos.

No se fijan tipos de DB, nombres de tablas ni endpoints definitivos.

## 6. RequestSource

Valores conceptuales:

- `APP`: solicitud iniciada por una aplicación de pasajero autenticado o invitado.
- `PHONE`: solicitud tomada por central vía llamada telefónica.
- `DISPATCHER`: solicitud creada manualmente por un operador desde una herramienta interna.
- `OTHER`: integración o canal futuro explícitamente identificado.

`PHONE` y `DISPATCHER` permiten `passengerId=null`: la persona puede no tener cuenta. En ese caso, los datos mínimos de contacto o referencia deben vivir en un campo operacional controlado y no convertir una identidad informal en un actor autenticado implícito.

El actor creador se registra por separado de `requestSource`: una solicitud `PHONE` normalmente tiene `createdByActorType=DISPATCHER`, mientras que una solicitud `APP` puede tener `createdByActorType=PASSENGER`.

## 7. Estados

La máquina mínima es:

- `REQUESTED`: viaje solicitado y aún sin asignación activa.
- `ASSIGNED`: existe un chofer asignado, pero todavía no se confirmó que esté en camino.
- `DRIVER_EN_ROUTE`: el chofer asignado confirmó que se dirige al origen.
- `ARRIVED`: el chofer confirmó llegada al origen y espera el inicio.
- `IN_PROGRESS`: el traslado comenzó.
- `COMPLETED`: el traslado terminó correctamente; es terminal.
- `CANCELLED`: el viaje fue cancelado; es terminal.

`DRIVER_EN_ROUTE` se conserva como estado separado porque representa una diferencia operativa verificable respecto de `ASSIGNED`: permite distinguir una asignación pendiente de un chofer que ya tomó el tramo hacia el origen, habilita mensajes y timeouts distintos, y evita inferir actividad a partir de una simple asignación.

No se agregan estados de pago, espera, no-show, disputa o emergencia en el contrato base. Esas situaciones requieren decisiones de negocio y no deben ocultarse como estados ambiguos.

## 8. Máquina de estados

Flujo normal:

```text
REQUESTED -> ASSIGNED -> DRIVER_EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED
     |          |              |                 |
     +----------+--------------+-----------------+----> CANCELLED
```

Reglas generales:

- una transición sólo es válida desde el estado indicado;
- el actor debe estar autorizado para esa transición;
- las precondiciones se vuelven a comprobar en la operación que persiste el cambio;
- el evento y el cambio de estado deben ser atómicos conceptualmente;
- `COMPLETED` y `CANCELLED` no tienen transiciones normales salientes;
- un retry idéntico no debe producir un segundo efecto funcional.

## 9. Transiciones

| FROM | TO | ACTOR_ALLOWED | PRECONDITIONS | EVENT | TIMESTAMP_UPDATED |
|---|---|---|---|---|---|
| `REQUESTED` | `ASSIGNED` | DISPATCHER, ADMIN, SYSTEM; DRIVER sólo si una futura política de aceptación lo autoriza | Trip activo; chofer activo, disponible y perteneciente a la Agency; sin asignación incompatible; vehículo válido si es obligatorio | `DRIVER_ASSIGNED` | `assignedAt`, `updatedAt` |
| `ASSIGNED` | `DRIVER_EN_ROUTE` | DRIVER; DISPATCHER/ADMIN/SYSTEM sólo como corrección o automatismo explícito | El actor DRIVER coincide con el chofer asignado; Trip no cancelado; asignación vigente | `DRIVER_EN_ROUTE` | `updatedAt` |
| `DRIVER_EN_ROUTE` | `ARRIVED` | DRIVER; DISPATCHER/ADMIN como corrección auditada | El actor DRIVER coincide con el asignado; ubicación/confirmación operativa válida según política futura | `DRIVER_ARRIVED` | `arrivedAt`, `updatedAt` |
| `ARRIVED` | `IN_PROGRESS` | DRIVER; DISPATCHER/ADMIN como corrección auditada | Chofer asignado; llegada confirmada; Trip no cancelado | `TRIP_STARTED` | `startedAt`, `updatedAt` |
| `IN_PROGRESS` | `COMPLETED` | DRIVER; DISPATCHER/ADMIN sólo mediante corrección excepcional auditada | Viaje iniciado; actor autorizado; no completado previamente | `TRIP_COMPLETED` | `completedAt`, `updatedAt` |
| `REQUESTED` | `CANCELLED` | PASSENGER, DISPATCHER, ADMIN, SYSTEM | Trip no terminal; motivo válido según canal | `TRIP_CANCELLED` | `cancelledAt`, `updatedAt` |
| `ASSIGNED` | `CANCELLED` | PASSENGER, DISPATCHER, ADMIN, SYSTEM | Trip no terminal; asignación y motivo registrados | `TRIP_CANCELLED` | `cancelledAt`, `updatedAt` |
| `DRIVER_EN_ROUTE` | `CANCELLED` | PASSENGER, DISPATCHER, ADMIN, SYSTEM | Trip no iniciado; motivo registrado; cualquier consecuencia operativa futura queda fuera de este contrato | `TRIP_CANCELLED` | `cancelledAt`, `updatedAt` |
| `ARRIVED` | `CANCELLED` | PASSENGER, DISPATCHER, ADMIN, SYSTEM | Trip aún no iniciado; motivo obligatorio; no se definen penalidades | `TRIP_CANCELLED` | `cancelledAt`, `updatedAt` |

### `ASSIGNED -> REQUESTED`

No se expone como una transición normal de UI ni como un cambio silencioso. Si la asignación se pierde antes de iniciar el viaje, DISPATCHER, ADMIN o SYSTEM ejecutan una operación de liberación/reasignación que:

1. invalida la asignación actual;
2. conserva al chofer anterior en `TripEvent`;
3. deja `driverId=null`;
4. devuelve el agregado a `REQUESTED` sólo si sigue siendo operativo;
5. registra `DRIVER_REASSIGNED` con causa, actor y chofer anterior.

Esto evita que el historial parezca que el viaje nunca tuvo asignación. El retorno es una operación de reasignación explícita, no un rollback arbitrario del estado.

No se define cancelación normal desde `IN_PROGRESS` en esta versión. Una emergencia o interrupción posterior requiere una decisión de negocio específica y no debe simularse con `CANCELLED` sin política.

## 10. Reasignación

`DRIVER_REASSIGN_ALLOWED=YES`.

DISPATCHER, ADMIN y SYSTEM pueden reasignar. SYSTEM sólo puede hacerlo cuando una regla automática definida lo habilite, por ejemplo un timeout o una pérdida de disponibilidad.

El DRIVER no puede asignarse unilateralmente un viaje ajeno. Puede rechazar o reportar imposibilidad sólo si esa capacidad se aprueba como decisión de negocio; la consecuencia operativa la ejecutará el flujo autorizado de dispatch.

La reasignación debe:

- conservar el `Trip.id`;
- registrar el chofer anterior y el nuevo en `DRIVER_REASSIGNED`;
- no borrar eventos históricos;
- evitar dos asignaciones activas simultáneas;
- comprobar disponibilidad y pertenencia a la misma Agency;
- usar una operación condicional/transaccional para resolver carreras.

Si el viaje no tiene nuevo chofer, vuelve a `REQUESTED` mediante la operación explícita descrita arriba.

## 11. Cancelación

### Quién puede cancelar

- `PASSENGER`: su propio viaje, mientras esté en `REQUESTED`, `ASSIGNED`, `DRIVER_EN_ROUTE` o `ARRIVED`, sujeto a la política final de negocio.
- `DRIVER`: no cancela el Trip unilateralmente en el contrato base; informa imposibilidad y dispatch decide si reasigna o cancela.
- `DISPATCHER`: viajes de su Agency antes de `IN_PROGRESS`.
- `ADMIN`: viajes de su Agency antes de `IN_PROGRESS`, y correcciones excepcionales auditadas.
- `SYSTEM`: sólo por automatismos documentados, con causa técnica y sin inventar penalidades.

### Datos obligatorios

Toda cancelación registra conceptualmente:

- `cancelReasonCode`: código estable para reporting y reglas futuras;
- `cancelReasonText`: explicación opcional, minimizada y no usada como autoridad;
- `cancelledByActorType`;
- `cancelledByActorId`, nullable sólo para SYSTEM;
- estado previo y momento de cancelación en `TripEvent`.

No se definen penalidades, cobros, comisiones ni reglas económicas. La cancelación durante `IN_PROGRESS` queda fuera del contrato base hasta decidir el tratamiento de emergencias/interrupciones.

## 12. Tarifa

`fareAmount` debe representarse como un entero en la unidad menor segura definida por la política de la moneda, nunca como `Float`.

Para el alcance actual:

- `fareCurrency=ARS`;
- el modelo debe poder expresar explícitamente la escala de la unidad monetaria;
- si el negocio opera sólo en pesos enteros, una tarifa de ARS 2500 se representa como 2500 unidades de negocio, sin inventar centavos;
- una futura política de centavos o precisión distinta debe cambiar la versión de tarifa, no reinterpretar viajes históricos.

`FareVersion` identifica la regla vigente cuando se creó el viaje. `Trip` conserva el snapshot de importe y moneda. Una actualización futura de tarifas no modifica ningún `Trip` existente.

El contrato no define todavía cálculo, descuentos, redondeos, cobros, penalidades ni proveedor de pago.

## 13. Zonas

`Zone` representa una unidad lógica de operación o tarifa dentro de una Agency. En el MVP puede seleccionarse manualmente desde origen/destino o mediante reglas simples de dispatch.

La relación futura puede incluir:

- `origin` perteneciente a una Zone;
- `destination` perteneciente a una Zone;
- `FareVersion` aplicable a una combinación o ruta de zonas.

Se deja abierta una evolución hacia:

- `polygon` para límites geográficos;
- `radius` para áreas circulares;
- geocoding para convertir texto en coordenadas;
- validación de cobertura.

No se implementa geofencing, geocoding ni routing en esta etapa.

## 14. TripEvent

`TripEvent` es el historial funcional append-only del viaje. Describe qué ocurrió, quién lo produjo y cómo cambió el estado. No es un log técnico genérico y no se edita para reescribir la historia.

### Campos conceptuales

| Campo | Semántica |
|---|---|
| `id` | Identidad estable del evento. |
| `tripId` | Viaje al que pertenece. |
| `agencyId` | Agency contextual del viaje. |
| `eventType` | Tipo de evento de dominio. |
| `actorType` | PASSENGER, DRIVER, DISPATCHER, ADMIN o SYSTEM. |
| `actorId` | Actor que causó el evento; nullable para SYSTEM. |
| `fromStatus` | Estado anterior, si aplica. |
| `toStatus` | Estado nuevo, si aplica. |
| `metadata` | Datos operativos mínimos, sanitizados y versionables. |
| `createdAt` | Momento en que el dominio aceptó el evento. |

### Eventos mínimos

- `TRIP_REQUESTED`.
- `DRIVER_ASSIGNED`.
- `DRIVER_REASSIGNED`.
- `DRIVER_EN_ROUTE`.
- `DRIVER_ARRIVED`.
- `TRIP_STARTED`.
- `TRIP_COMPLETED`.
- `TRIP_CANCELLED`.
- `FARE_SNAPSHOT_CREATED`.

### Ubicación

`LOCATION_UPDATED` no debe registrarse en `TripEvent` por cada punto GPS: produciría volumen y mezclaría telemetría con historia funcional. La ubicación se separa en un límite de tracking propio, con retención y frecuencia que se decidirán después. Un evento de dominio puede registrar sólo hitos relevantes, como tracking habilitado o deshabilitado, si fueran necesarios.

## 15. Tracking / ubicación

El tracking es una capacidad separada de `Trip` y `TripEvent`.

`DriverLocation` es el contrato conceptual mínimo:

- `driverId`;
- `tripId` nullable;
- `lat`;
- `lng`;
- `accuracy` nullable;
- `recordedAt`.

Reglas:

- el DRIVER debe estar autenticado;
- el driver efectivo se obtiene de la sesión, nunca de un `driverId` confiado del cliente;
- si existe `tripId`, el DRIVER debe estar autorizado para ese viaje;
- latitud y longitud se validan por rango y forma;
- se aplica rate limit y límite de payload;
- el viaje y la Agency se verifican antes de aceptar una publicación asociada;
- una publicación inválida no cambia el estado del viaje;
- la precisión/retención no se fijan aún.

`REALTIME_NOT_REQUIRED_FOR_PHASE_1=YES`.

Polling controlado es una alternativa válida para la primera fase. WebSocket/SSE sólo se evalúa después de que la persistencia, autorización y límites de ubicación estén funcionando.

## 16. Ownership y autorización

Las reglas de ownership se resuelven server-side en una implementación futura:

- `PASSENGER` sólo lee sus propios viajes, o los viajes donde una relación explícita de pasajero lo autorice.
- `DRIVER` lee y opera viajes asignados a él; cualquier vista adicional de dispatch debe ser una capacidad explícita, no una consecuencia de conocer un ID.
- `DISPATCHER` opera viajes y recursos de su Agency.
- `ADMIN` administra recursos de su Agency según permisos.
- `SYSTEM` sólo ejecuta reglas internas explícitamente habilitadas.

Nunca son fuente de autoridad los siguientes valores recibidos del cliente:

- `agencyId`;
- `driverId`;
- `passengerId`;
- `role`;
- cualquier actor o tenant indicado en un body, query o ruta.

Una futura sesión debe resolver actor, tipo, Agency y permisos. El handler debe volver a comprobar ownership al consultar o modificar el recurso, incluso si existe un guard de entrada.

## 17. Idempotencia

La idempotencia es necesaria como mínimo en `CREATE_TRIP`, porque el cliente puede reintentar por timeout sin saber si la primera solicitud fue aceptada.

También será necesaria, si aparecen integraciones:

- `PAYMENT_CALLBACK`;
- `EXTERNAL_PROVIDER_CALLBACK`.

Contrato conceptual:

- `idempotencyKey` identifica la intención del caller dentro del alcance apropiado;
- `fingerprint` representa los datos relevantes de la solicitud;
- mismo key + mismo fingerprint: devolver el resultado existente sin crear otro Trip;
- mismo key + distinto fingerprint: `IDEMPOTENCY_CONFLICT`;
- key ausente: la política futura decide si se rechaza o se permite sólo en canales internos controlados.

La reserva de idempotencia y la creación del Trip deben resolverse como una única operación lógica protegida contra carreras.

## 18. Concurrencia

El contrato debe evitar conceptualmente:

- dos choferes asignados simultáneamente;
- iniciar un viaje cancelado;
- completar un viaje dos veces;
- reasignaciones concurrentes que pierdan historial;
- doble creación ante retry.

La implementación futura debe combinar, según el caso:

- `expectedStatus` para expresar la versión lógica esperada;
- actualización condicional que sólo avance desde el estado correcto;
- transacción para cambio de estado y `TripEvent`;
- restricciones únicas para invariantes como una asignación activa;
- idempotencia para operaciones repetibles.

No se implementa ni se prescribe todavía un lock distribuido. Un lock en memoria sólo sería válido como ayuda local y no como garantía final si existen varias instancias.

## 19. Errores de dominio

| Código | Meaning | HTTP recomendado |
|---|---|---:|
| `TRIP_NOT_FOUND` | El Trip no existe o no es visible en el scope del actor. | 404 |
| `TRIP_FORBIDDEN` | El actor existe pero no tiene ownership/capacidad sobre el Trip. | 403 |
| `INVALID_TRANSITION` | El cambio solicitado no pertenece al grafo o no cumple precondiciones. | 409 |
| `DRIVER_NOT_AVAILABLE` | El chofer no está disponible para asignación. | 409 |
| `DRIVER_ALREADY_ASSIGNED` | El chofer ya tiene una asignación incompatible. | 409 |
| `TRIP_ALREADY_ASSIGNED` | El Trip ya tiene una asignación activa. | 409 |
| `TRIP_ALREADY_COMPLETED` | Se intenta modificar un Trip terminal completado. | 409 |
| `TRIP_CANCELLED` | Se intenta operar un Trip cancelado. | 409 |
| `INVALID_LOCATION` | Coordenadas ausentes, fuera de rango o no autorizadas. | 422 |
| `INVALID_FARE` | Importe, moneda o versión de tarifa inválidos. | 422 |
| `IDEMPOTENCY_CONFLICT` | El key ya existe con fingerprint diferente. | 409 |

Los mensajes públicos futuros no deben incluir stack, secretos, SQL, credenciales ni PII innecesaria. Los logs deben conservar sólo señales operativas sanitizadas.

## 20. AuditLog

`TripEvent` y `AuditLog` tienen propósitos distintos.

### TripEvent

Historia funcional del viaje: solicitud, asignación, llegada, inicio, finalización, cancelación y cambios de tarifa asociados al viaje.

### AuditLog

Registro de acciones administrativas o sensibles, incluso cuando no cambian el estado de un Trip. Ejemplos:

- tarifa modificada;
- chofer creado o desactivado;
- vehículo editado;
- viaje reasignado manualmente;
- zona modificada;
- permisos operativos cambiados.

El audit log debe conservar actor, Agency, acción, recurso, momento y metadata mínima. No debe guardar secretos, tokens, credenciales ni PII innecesaria. Una acción de administración sobre un Trip puede generar ambos registros: `TripEvent` por el hecho funcional y `AuditLog` por la acción sensible.

## 21. Diagrama textual

```text
Passenger / Dispatcher
          |
          v
     Trip REQUESTED
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
          v
      IN_PROGRESS
          |
          v
       COMPLETED

REQUESTED -----------> CANCELLED
ASSIGNED -------------> CANCELLED
DRIVER_EN_ROUTE ------> CANCELLED
ARRIVED --------------> CANCELLED

ASSIGNED --release/reassign--> REQUESTED
          (evento DRIVER_REASSIGNED; no rollback silencioso)
```

## 22. OPEN_DECISIONS

Estas decisiones no bloquean el contrato base, pero requieren definición de negocio antes de implementar los flujos concretos:

1. `dispatch automático vs manual`: si toda asignación la hace DISPATCHER o si el sistema podrá sugerir/asignar.
2. `aceptación del chofer`: si DRIVER debe aceptar/rechazar una asignación o si la asignación es directa.
3. `autoasignación por cercanía`: si se incorporará proximidad, disponibilidad y ranking de choferes.
4. `reglas exactas de cancelación`: copy, ventanas operativas y diferencias por actor, sin definir todavía penalidades.
5. `zonas reales`: si el MVP usa selección manual o si se habilitan polygon/radius/geocoding.
6. `pricing`: cómo se calcula FareVersion y qué precisión monetaria opera realmente la Agency.
7. `cuenta del pasajero`: si los viajes APP requieren cuenta y qué datos mínimos acepta PHONE/DISPATCHER.
8. `retención de GPS`: frecuencia, duración, visibilidad histórica y borrado de ubicaciones.

`OPEN_DECISIONS_COUNT=8`.

## 23. Out of scope

Quedan explícitamente fuera de este contrato:

- pagos;
- liquidaciones;
- caja;
- comisión Agency/DRIVER;
- Mercado Pago;
- facturación;
- penalidades económicas;
- mapas reales;
- routing;
- realtime;
- push;
- PWA;
- métricas;
- promociones;
- rating avanzado.

## 24. Recomendación de siguiente fase

Definir una especificación de casos de uso y permisos sobre este contrato, empezando por `CREATE_TRIP`, asignación, reasignación, cancelación y finalización, sin implementar todavía el backend.

La siguiente implementación, cuando sea autorizada, debería comenzar por el agregado persistente de Trip, su máquina de estados, idempotencia y eventos; tracking, realtime, mapas y PWA deben permanecer posteriores.

## 25. Markers

TRIP_DOMAIN_CONTRACT=PASS
ACTORS_DEFINED=YES
AGENCY_OWNERSHIP_DEFINED=YES
TRIP_DEFINED=YES
REQUEST_SOURCE_DEFINED=YES
STATES_DEFINED=YES
TRANSITIONS_DEFINED=YES
REASSIGNMENT_DEFINED=YES
CANCELLATION_DEFINED=YES
FARE_SNAPSHOT_DEFINED=YES
TRIP_EVENTS_DEFINED=YES
TRACKING_BOUNDARY_DEFINED=YES
OWNERSHIP_DEFINED=YES
IDEMPOTENCY_DEFINED=YES
CONCURRENCY_DEFINED=YES
DOMAIN_ERRORS_DEFINED=YES
AUDIT_LOG_DEFINED=YES

SOURCE_CODE_TOUCHED=NO
DELIGO_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Definir casos de uso y permisos sobre CREATE_TRIP, asignación, reasignación, cancelación y finalización.
