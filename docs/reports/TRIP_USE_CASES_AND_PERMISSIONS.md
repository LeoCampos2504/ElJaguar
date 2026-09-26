# Especificación de casos de uso y permisos del dominio de viajes

## 1. Contexto

Este documento especifica los casos de uso del MVP operativo de `remis-norte-prototipo` sobre el contrato definido en `docs/reports/TRIP_DOMAIN_CONTRACT.md`.

La especificación permanece en diseño. No define tablas, endpoints, payloads HTTP, sesiones concretas ni implementación de backend/frontend.

## 2. Scope

Incluye los 18 casos obligatorios UC-01 a UC-18, permisos, ownership, autoridad servidor/cliente, idempotencia, concurrencia, efectos secundarios, visibilidad de datos y errores de dominio.

El contrato base conserva estos actores: `PASSENGER`, `DRIVER`, `DISPATCHER`, `ADMIN`, `SYSTEM`.

El contrato base conserva estos estados: `REQUESTED`, `ASSIGNED`, `DRIVER_EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

`AGENCY_REQUIRED_IN_DOMAIN=YES` y `REALTIME_NOT_REQUIRED_FOR_PHASE_1=YES` permanecen vigentes.

## 3. Convenciones

- `ALLOW`: la acción forma parte del permiso normal del actor.
- `DENY`: el actor no puede ejecutar la acción.
- `CONDITIONAL`: sólo puede ejecutarla si se cumplen las condiciones indicadas.
- `N/A`: no corresponde al caso o no cambia el agregado.
- Los actores y recursos efectivos se resuelven server-side.
- `idempotencyKey` y `fingerprint` son conceptos lógicos; no se diseña su almacenamiento físico.
- Todo cambio válido del Trip y su evento funcional debe tratarse como una operación atómica.
- Las notificaciones y demás efectos externos ocurren después del commit conceptual.

## 4. Casos de uso

Cada caso mantiene exactamente el contrato de campos solicitado.

### UC-01 CREATE_TRIP_APP

USE_CASE_ID=UC-01
NAME=CREATE_TRIP_APP
PURPOSE=Crear un viaje desde la aplicación de pasajero y dejarlo en REQUESTED.
PRIMARY_ACTOR=PASSENGER
SECONDARY_ACTORS=SYSTEM; DISPATCHER sólo si la política de soporte transforma la solicitud en operación interna
AGENCY_SCOPE=La Agency se obtiene del contexto de servicio o selección autorizada; nunca del agencyId enviado por el cliente
AUTH_REQUIRED=CONDITIONAL; soporta pasajero autenticado o invitado según la decisión de cuenta de pasajero
IDEMPOTENCY_REQUIRED=REQUIRED
ALLOWED_INITIAL_STATES=No aplica; creación de un Trip nuevo
RESULTING_STATE=REQUESTED
PRECONDITIONS=Canal APP habilitado; origen y destino presentes; Agency operativa; si el pasajero está autenticado, sesión válida; si es invitado, política guest habilitada
INPUTS=origin; destination; originLat/lng opcionales; destinationLat/lng opcionales; notes opcional; idempotencyKey
SERVER_RESOLVED_FIELDS=agencyId; actor real; passengerId si existe; createdByActorType=PASSENGER o SYSTEM según el caso; createdByActorId; status=REQUESTED; requestSource=APP; fareAmount; fareCurrency; fareVersionId; timestamps
VALIDATIONS=Forma y longitud de textos; coordenadas por rango si existen; notas minimizadas; key válida; tarifa aplicable disponible; no aceptar status, driverId, vehicleId ni importe arbitrario como autoridad
AUTHORIZATION=El pasajero autenticado sólo crea para sí; el invitado sólo puede crear si la política pública lo permite; el servidor determina la Agency y limita el uso anónimo
DOMAIN_OPERATION=CREATE_TRIP con source APP
EVENTS_CREATED=TRIP_REQUESTED; FARE_SNAPSHOT_CREATED
TIMESTAMPS_UPDATED=requestedAt; createdAt; updatedAt
SIDE_EFFECTS=Después del commit: notificación opcional a dispatch; no push, realtime, SMS o WhatsApp en esta fase
ERRORS=TRIP_FORBIDDEN; INVALID_FARE; IDEMPOTENCY_CONFLICT; INVALID_LOCATION
SUCCESS_RESULT=Referencia del Trip creado, estado REQUESTED y snapshot de tarifa; no expone autoridad interna innecesaria
RETRY_BEHAVIOR=Misma key y mismo fingerprint devuelve el resultado existente; misma key con fingerprint distinto produce IDEMPOTENCY_CONFLICT
AUDIT_REQUIREMENTS=TripEvent TRIP_REQUESTED y FARE_SNAPSHOT_CREATED; no registrar secretos ni PII innecesaria; creación guest debe dejar metadata operacional mínima
OUT_OF_SCOPE=Pago; geocoding; routing; penalidades; cuenta guest definitiva; realtime; endpoints reales

### UC-02 CREATE_TRIP_PHONE

USE_CASE_ID=UC-02
NAME=CREATE_TRIP_PHONE
PURPOSE=Crear un viaje ingresado por llamada telefónica sin exigir una cuenta de pasajero.
PRIMARY_ACTOR=DISPATCHER
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Agency del Dispatcher autenticado
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=REQUIRED
ALLOWED_INITIAL_STATES=No aplica; creación de un Trip nuevo
RESULTING_STATE=REQUESTED
PRECONDITIONS=Dispatcher activo y autorizado; canal PHONE disponible; Agency operativa; información mínima de origen y destino
INPUTS=origin; destination; coordenadas opcionales; passengerId opcional; passengerDisplayName opcional; contactPhone opcional; referenceNotes opcional; notes opcional; idempotencyKey
SERVER_RESOLVED_FIELDS=agencyId; createdByActorType=DISPATCHER; createdByActorId; requestSource=PHONE; status=REQUESTED; fare snapshot; timestamps; ownership del passengerId si se usa
VALIDATIONS=Origen/destino; formato y minimización de OPERATIONAL_CONTACT_DATA; no crear automáticamente una cuenta; contactPhone sólo si es necesario para la operación; referencias pertenecientes a la Agency
AUTHORIZATION=El Dispatcher sólo crea viajes para su Agency; passengerId, si se provee, se verifica server-side y no puede apuntar a un pasajero ajeno
DOMAIN_OPERATION=CREATE_TRIP con source PHONE y contacto operacional opcional
EVENTS_CREATED=TRIP_REQUESTED; FARE_SNAPSHOT_CREATED
TIMESTAMPS_UPDATED=requestedAt; createdAt; updatedAt
SIDE_EFFECTS=Después del commit: aviso interno opcional a dispatch o cola operativa; ningún canal externo obligatorio
ERRORS=TRIP_FORBIDDEN; INVALID_FARE; IDEMPOTENCY_CONFLICT; INVALID_LOCATION
SUCCESS_RESULT=Trip REQUESTED con passengerId nullable y contacto operacional mínimo, si fue necesario
RETRY_BEHAVIOR=Misma key y fingerprint devuelve el Trip existente; diferente fingerprint produce IDEMPOTENCY_CONFLICT
AUDIT_REQUIREMENTS=TripEvent de creación; registrar actor Dispatcher y source PHONE; auditar acceso a OPERATIONAL_CONTACT_DATA sin copiar el teléfono a metadata innecesaria
OUT_OF_SCOPE=Alta de cuenta; SMS; grabación de llamadas; pagos; penalidades; endpoints reales

### UC-03 CREATE_TRIP_DISPATCHER

USE_CASE_ID=UC-03
NAME=CREATE_TRIP_DISPATCHER
PURPOSE=Crear manualmente un viaje desde una herramienta interna sin implicar que provenga de una llamada.
PRIMARY_ACTOR=DISPATCHER o ADMIN
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Agency del actor autenticado
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=REQUIRED
ALLOWED_INITIAL_STATES=No aplica; creación de un Trip nuevo
RESULTING_STATE=REQUESTED
PRECONDITIONS=Actor operativo autorizado; Agency válida; origen y destino informados; datos de pasajero opcionales según política
INPUTS=origin; destination; coordenadas opcionales; passengerId opcional; notes opcional; referencia operacional opcional; idempotencyKey
SERVER_RESOLVED_FIELDS=agencyId; createdByActorType; createdByActorId; requestSource=DISPATCHER; status=REQUESTED; fare snapshot; timestamps
VALIDATIONS=Ownership de referencias; datos mínimos de ruta; texto acotado; no aceptar status, actor o tarifa como autoridad desde la UI
AUTHORIZATION=DISPATCHER y ADMIN sólo crean dentro de su Agency y con permisos de alta manual
DOMAIN_OPERATION=CREATE_TRIP con source DISPATCHER; converge con CREATE_TRIP_PHONE en una única operación de dominio
EVENTS_CREATED=TRIP_REQUESTED; FARE_SNAPSHOT_CREATED
TIMESTAMPS_UPDATED=requestedAt; createdAt; updatedAt
SIDE_EFFECTS=Después del commit: actualización del panel operativo; notificación interna opcional
ERRORS=TRIP_FORBIDDEN; INVALID_FARE; IDEMPOTENCY_CONFLICT; INVALID_LOCATION
SUCCESS_RESULT=Trip REQUESTED con actor creador y source DISPATCHER registrados
RETRY_BEHAVIOR=Misma key y fingerprint devuelve resultado existente; conflicto si cambia la intención
AUDIT_REQUIREMENTS=TripEvent de creación; si ADMIN crea/corrige para otro actor, AuditLog de acción administrativa
OUT_OF_SCOPE=Definir diferencias de negocio entre alta manual y llamada más allá de metadata; pagos; dispatch automático

### UC-04 ASSIGN_DRIVER

USE_CASE_ID=UC-04
NAME=ASSIGN_DRIVER
PURPOSE=Asignar un chofer y vehículo válidos a un Trip REQUESTED.
PRIMARY_ACTOR=DISPATCHER o ADMIN
SECONDARY_ACTORS=SYSTEM; DRIVER sólo si se aprueba una política futura de autoaceptación/autoselección
AGENCY_SCOPE=Trip, Driver y Vehicle deben pertenecer a la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=EVALUATE; la operación debe ser retry-safe aunque la key no sea obligatoria en MVP
ALLOWED_INITIAL_STATES=REQUESTED
RESULTING_STATE=ASSIGNED
PRECONDITIONS=Trip REQUESTED; Driver activo y disponible; Driver sin viaje incompatible; Vehicle válido y habilitado si la política lo exige; misma Agency
INPUTS=Candidato driverId y vehicleId sólo como intención operativa, más Trip identificado; nunca son autoridad sin validación server-side
SERVER_RESOLVED_FIELDS=actor real; agencyId; driverId y vehicleId aceptados; assignment identity; assignedAt; status; ownership; versión/estado esperado
VALIDATIONS=Estado REQUESTED; disponibilidad; asociación con Agency; consistencia Driver-Vehicle; no asignación activa incompatible; permisos del actor
AUTHORIZATION=DISPATCHER, ADMIN o automatismo SYSTEM autorizado; DRIVER queda DENY salvo decisión futura
DOMAIN_OPERATION=Asignación condicional de Trip, Driver y Vehicle en una operación atómica
EVENTS_CREATED=DRIVER_ASSIGNED
TIMESTAMPS_UPDATED=assignedAt si corresponde por primera asignación; updatedAt
SIDE_EFFECTS=Después del commit: notificar al chofer y al pasajero si se aprueba; nunca hacer depender el cambio del éxito externo
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; DRIVER_NOT_AVAILABLE; DRIVER_ALREADY_ASSIGNED; TRIP_ALREADY_ASSIGNED
SUCCESS_RESULT=Trip ASSIGNED con asignación vigente y referencia al evento de asignación
RETRY_BEHAVIOR=Si la asignación ya coincide con la intención y el estado sigue válido, devolver resultado idempotente; si existe otra asignación, conflicto
AUDIT_REQUIREMENTS=TripEvent DRIVER_ASSIGNED; AuditLog para asignación manual ADMIN o cambios sensibles
OUT_OF_SCOPE=Algoritmo de cercanía; ranking; aceptación del chofer; lock distribuido; endpoints reales

### UC-05 ACCEPT_OR_START_ASSIGNMENT

USE_CASE_ID=UC-05
NAME=ACCEPT_OR_START_ASSIGNMENT
PURPOSE=Dejar explícita la decisión entre asignación directa y aceptación explícita del chofer sin fijar todavía una política de negocio.
PRIMARY_ACTOR=DRIVER
SECONDARY_ACTORS=DISPATCHER; ADMIN; SYSTEM
AGENCY_SCOPE=Trip y Driver de la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=ASSIGNED bajo POLICY_B; bajo POLICY_A el caso no genera una operación adicional
RESULTING_STATE=ASSIGNED si DRIVER acepta bajo POLICY_B; sin cambio bajo POLICY_A; rechazo deriva al flujo de RELEASE/REASSIGN
PRECONDITIONS=Trip asignado al Driver efectivo; asignación vigente; estado no terminal; la Agency y permisos son válidos
INPUTS=Trip identificado; decisión accept/reject sólo como comando de la sesión DRIVER; no driverId confiado del cliente
SERVER_RESOLVED_FIELDS=actor real; driverId de sesión; assignment version; policy activa; Agency; resultado de aceptación
VALIDATIONS=El Driver coincide con el asignado; la asignación no expiró; no hubo cancelación ni reasignación concurrente
AUTHORIZATION=Sólo el DRIVER asignado puede aceptar/rechazar bajo POLICY_B; DISPATCHER/ADMIN pueden corregir o liberar según permisos; SYSTEM sólo aplica timeout definido
DOMAIN_OPERATION=POLICY_A_DIRECT_ASSIGNMENT: no-op tras ASSIGN_DRIVER; POLICY_B_DRIVER_ACCEPTANCE: aceptar o rechazar una asignación vigente
EVENTS_CREATED=POLICY_A: ninguno adicional; POLICY_B aceptación puede generar un evento de aceptación futuro; rechazo debe generar DRIVER_REASSIGNED o release explícito, no borrar historia
TIMESTAMPS_UPDATED=updatedAt; un futuro acceptedAt sólo si la decisión de negocio lo aprueba
SIDE_EFFECTS=Después del commit: notificar aceptación/rechazo y actualizar operación; no depender de push o realtime
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_ALREADY_ASSIGNED; TRIP_CANCELLED
SUCCESS_RESULT=Confirmación de la política aplicada y estado vigente; nunca presentar aceptación si está activa POLICY_A
RETRY_BEHAVIOR=Repetir aceptación ya aplicada devuelve el mismo resultado; repetir rechazo después de reasignación devuelve estado actual o conflicto seguro
AUDIT_REQUIREMENTS=Registrar policy aplicada y actor; si hay rechazo o timeout, conservar motivo operacional mínimo
OUT_OF_SCOPE=Resolver la decisión de negocio; UX definitiva; autoaceptación; ranking; penalidades

POLICY_A_DIRECT_ASSIGNMENT

- Estado: `ASSIGNED` inmediatamente después de `ASSIGN_DRIVER`.
- Evento: `DRIVER_ASSIGNED`; no requiere una aceptación adicional.
- Timeout: se aplica a la falta de progreso (`DRIVER_EN_ROUTE`) y no a una aceptación inexistente.
- Permisos: sólo dispatch/admin/system asignan; el DRIVER puede continuar el flujo si la asignación es válida.
- UX: más simple para un MVP con central controlando la operación.
- Concurrencia: una asignación válida basta; la carrera principal es la asignación inicial.

POLICY_B_DRIVER_ACCEPTANCE

- Estado: permanece `ASSIGNED` hasta aceptar; rechazo no puede borrar el historial.
- Evento: requiere un evento de aceptación/rechazo que debe incorporarse al catálogo si se elige.
- Timeout: requiere expiración explícita de la asignación y decisión de liberar/reasignar.
- Permisos: sólo el DRIVER asignado acepta o rechaza; dispatch/admin/system resuelven timeout.
- UX: más clara para disponibilidad real del chofer, pero agrega estados y casos de error.
- Concurrencia: debe proteger aceptación, rechazo, timeout y reasignación contra carreras.

RECOMMENDATION=POLICY_A_DIRECT_ASSIGNMENT para el MVP por menor superficie de estados y operaciones.
BUSINESS_DECISION_REQUIRED=YES

### UC-06 DRIVER_EN_ROUTE

USE_CASE_ID=UC-06
NAME=DRIVER_EN_ROUTE
PURPOSE=Confirmar que el chofer asignado comenzó el desplazamiento hacia el origen.
PRIMARY_ACTOR=DRIVER
SECONDARY_ACTORS=DISPATCHER; ADMIN como corrección auditada; SYSTEM sólo si una regla explícita lo permite
AGENCY_SCOPE=Trip y Driver asignado en la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=ASSIGNED
RESULTING_STATE=DRIVER_EN_ROUTE
PRECONDITIONS=Trip ASSIGNED; sesión DRIVER válida; actor coincide con el Driver asignado; Trip no cancelado
INPUTS=Trip identificado; confirmación explícita; ubicación opcional y no requerida en fase 1
SERVER_RESOLVED_FIELDS=driverId desde sesión; agencyId; expectedStatus=ASSIGNED; actor; timestamp; status
VALIDATIONS=Ownership del Driver; transición válida; request repetible; no confiar en driverId del body
AUTHORIZATION=Sólo el DRIVER asignado en operación normal; dispatch/admin sólo con corrección explícita y auditada
DOMAIN_OPERATION=Avance condicional ASSIGNED -> DRIVER_EN_ROUTE
EVENTS_CREATED=DRIVER_EN_ROUTE
TIMESTAMPS_UPDATED=updatedAt
SIDE_EFFECTS=Después del commit: notificar cambio de estado; realtime/push quedan opcionales y posteriores
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_CANCELLED
SUCCESS_RESULT=Trip DRIVER_EN_ROUTE y evento funcional confirmado
RETRY_BEHAVIOR=Si ya está DRIVER_EN_ROUTE y el mismo Driver repite, devolver estado actual sin duplicar evento; si cambió el estado, aplicar regla actual
AUDIT_REQUIREMENTS=TripEvent con actor Driver; correcciones de dispatch/admin requieren AuditLog
OUT_OF_SCOPE=GPS obligatorio; routing; prueba de proximidad; WebSocket

### UC-07 DRIVER_ARRIVED

USE_CASE_ID=UC-07
NAME=DRIVER_ARRIVED
PURPOSE=Confirmar llegada del chofer al origen.
PRIMARY_ACTOR=DRIVER
SECONDARY_ACTORS=DISPATCHER; ADMIN como corrección auditada
AGENCY_SCOPE=Trip y Driver asignado en la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=DRIVER_EN_ROUTE
RESULTING_STATE=ARRIVED
PRECONDITIONS=Trip DRIVER_EN_ROUTE; Driver efectivo coincide con el asignado; Trip no cancelado; confirmación explícita del chofer
INPUTS=Trip identificado; confirmación; ubicación opcional, no requerida
SERVER_RESOLVED_FIELDS=driverId; actor; agencyId; arrivedAt; expectedStatus=DRIVER_EN_ROUTE
VALIDATIONS=Ownership; transición; no GPS real obligatorio; no confiar en driverId enviado
AUTHORIZATION=Sólo Driver asignado en operación normal; corrección de dispatch/admin debe quedar auditada
DOMAIN_OPERATION=Avance condicional DRIVER_EN_ROUTE -> ARRIVED
EVENTS_CREATED=DRIVER_ARRIVED
TIMESTAMPS_UPDATED=arrivedAt; updatedAt
SIDE_EFFECTS=Después del commit: aviso al pasajero/dispatch si se habilita; no dependencia externa
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_CANCELLED
SUCCESS_RESULT=Trip ARRIVED con arrivedAt registrado
RETRY_BEHAVIOR=Si ya está ARRIVED y el mismo Driver repite, devolver éxito idempotente sin reemplazar arrivedAt ni duplicar evento
AUDIT_REQUIREMENTS=TripEvent de llegada; correcciones administrativas con AuditLog y motivo
OUT_OF_SCOPE=Geofencing; mapa; GPS obligatorio; penalidad por espera

### UC-08 START_TRIP

USE_CASE_ID=UC-08
NAME=START_TRIP
PURPOSE=Indicar que el traslado comenzó.
PRIMARY_ACTOR=DRIVER
SECONDARY_ACTORS=DISPATCHER; ADMIN como corrección auditada
AGENCY_SCOPE=Trip y Driver asignado en la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=ARRIVED
RESULTING_STATE=IN_PROGRESS
PRECONDITIONS=Trip ARRIVED; asignación vigente; Driver efectivo coincide; no cancelado; llegada confirmada
INPUTS=Trip identificado; confirmación explícita; ubicación opcional
SERVER_RESOLVED_FIELDS=driverId; actor; agencyId; startedAt; expectedStatus=ARRIVED
VALIDATIONS=Estado esperado; ownership; transición; no aceptar status enviado
AUTHORIZATION=Sólo Driver asignado en operación normal; dispatch/admin sólo como corrección auditada
DOMAIN_OPERATION=Avance condicional ARRIVED -> IN_PROGRESS
EVENTS_CREATED=TRIP_STARTED
TIMESTAMPS_UPDATED=startedAt; updatedAt
SIDE_EFFECTS=Después del commit: notificación opcional de viaje iniciado; ningún pago o caja
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_CANCELLED
SUCCESS_RESULT=Trip IN_PROGRESS con startedAt
RETRY_BEHAVIOR=Repetir cuando ya está IN_PROGRESS devuelve estado actual sin duplicar TRIP_STARTED; si está terminal, error correspondiente
AUDIT_REQUIREMENTS=TripEvent TRIP_STARTED; corrección de dispatch/admin auditada
OUT_OF_SCOPE=GPS; cobro; medición de distancia; realtime

### UC-09 COMPLETE_TRIP

USE_CASE_ID=UC-09
NAME=COMPLETE_TRIP
PURPOSE=Finalizar un traslado que se encuentra en curso.
PRIMARY_ACTOR=DRIVER
SECONDARY_ACTORS=DISPATCHER; ADMIN sólo mediante corrección auditada
AGENCY_SCOPE=Trip y Driver asignado en la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=IN_PROGRESS
RESULTING_STATE=COMPLETED
PRECONDITIONS=Trip IN_PROGRESS; Driver asignado y autorizado; no finalizado previamente
INPUTS=Trip identificado; confirmación; notas operativas opcionales y acotadas
SERVER_RESOLVED_FIELDS=driverId; vehicleId; completedAt; fare snapshot existente; actor; agencyId; expectedStatus=IN_PROGRESS
VALIDATIONS=Ownership; transición; snapshot de tarifa existente; no cambiar tarifa desde este caso; no aceptar completedAt o actor como autoridad
AUTHORIZATION=Driver asignado; Dispatcher/Admin sólo para corrección excepcional y auditada
DOMAIN_OPERATION=Avance condicional IN_PROGRESS -> COMPLETED
EVENTS_CREATED=TRIP_COMPLETED
TIMESTAMPS_UPDATED=completedAt; updatedAt
SIDE_EFFECTS=Después del commit: historial; notificación de finalización opcional; no pago, comisión, liquidación ni caja
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_ALREADY_COMPLETED; TRIP_CANCELLED
SUCCESS_RESULT=Trip COMPLETED con completedAt, driverId, vehicleId y snapshot de tarifa existente
RETRY_BEHAVIOR=Repetir después de completar devuelve el resultado final sin duplicar evento; si la nueva solicitud contradice datos, conflicto seguro
AUDIT_REQUIREMENTS=TripEvent TRIP_COMPLETED; corrección administrativa con AuditLog, actor y motivo
OUT_OF_SCOPE=Pago; comisión; liquidación; caja; rating; facturación

### UC-10 REASSIGN_DRIVER

USE_CASE_ID=UC-10
NAME=REASSIGN_DRIVER
PURPOSE=Reemplazar el chofer actual por otro o iniciar la liberación sin borrar historial.
PRIMARY_ACTOR=DISPATCHER o ADMIN
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Trip, chofer anterior y nuevo chofer dentro de la misma Agency
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=ASSIGNED; DRIVER_EN_ROUTE; ARRIVED
RESULTING_STATE=El estado operativo se conserva con reemplazo directo; REQUESTED si no hay reemplazo
PRECONDITIONS=Trip no iniciado ni terminal; asignación actual identificable; nuevo Driver disponible y válido si se reemplaza; motivo requerido
INPUTS=newDriverId opcional; newVehicleId opcional; reasonCode; reasonText opcional; Trip identificado
SERVER_RESOLVED_FIELDS=actor; agencyId; previousDriverId; nuevo Driver/Vehicle válidos; status resultante; timestamps; versión esperada
VALIDATIONS=Ownership; disponibilidad; misma Agency; no self-spoofing; ausencia de carreras; motivo controlado
AUTHORIZATION=DISPATCHER, ADMIN o SYSTEM por timeout/regla explícita; DRIVER DENY
DOMAIN_OPERATION=Reasignación atómica directa o liberación delegada a RELEASE_DRIVER_ASSIGNMENT
EVENTS_CREATED=DRIVER_REASSIGNED con previousDriverId, newDriverId nullable y reasonCode
TIMESTAMPS_UPDATED=updatedAt; assignedAt no se reinicia por defecto; timestamp de nueva asignación sólo si una política futura lo requiere
SIDE_EFFECTS=Después del commit: notificar a actores afectados; no depender de canales externos
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; DRIVER_NOT_AVAILABLE; DRIVER_ALREADY_ASSIGNED; TRIP_ALREADY_ASSIGNED; TRIP_CANCELLED
SUCCESS_RESULT=Trip con nuevo Driver o en REQUESTED sin asignación, historial conservado y causa registrada
RETRY_BEHAVIOR=Repetir la misma reasignación con la misma intención devuelve estado actual; intención distinta requiere nueva operación o conflicto
AUDIT_REQUIREMENTS=TripEvent DRIVER_REASSIGNED; AuditLog obligatorio para reasignación manual ADMIN y recomendable para DISPATCHER
OUT_OF_SCOPE=Autoasignación por cercanía; ranking; compensación; PII innecesaria

### UC-11 RELEASE_DRIVER_ASSIGNMENT

USE_CASE_ID=UC-11
NAME=RELEASE_DRIVER_ASSIGNMENT
PURPOSE=Liberar una asignación sin tratarla como PATCH status=REQUESTED ni perder el historial del chofer.
PRIMARY_ACTOR=DISPATCHER o ADMIN
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Trip y asignación pertenecientes a la Agency del actor
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=ASSIGNED; DRIVER_EN_ROUTE; ARRIVED
RESULTING_STATE=REQUESTED
PRECONDITIONS=Trip no iniciado; asignación vigente; razón de liberación; no estado terminal
INPUTS=Trip identificado; reasonCode; reasonText opcional; expectedStatus
SERVER_RESOLVED_FIELDS=actor; agencyId; previousDriverId; driverId=null; vehicleId=null recomendado; status=REQUESTED; timestamps
VALIDATIONS=Ownership; estado esperado; motivo; no liberar IN_PROGRESS; no aceptar actor o driverId del cliente
AUTHORIZATION=DISPATCHER, ADMIN o SYSTEM por timeout/regla documentada; DRIVER no puede liberar unilateralmente
DOMAIN_OPERATION=RELEASE_ASSIGNMENT atómico que invalida asignación y devuelve a REQUESTED
EVENTS_CREATED=DRIVER_REASSIGNED con newDriverId=null y reasonCode; no se borra DRIVER_ASSIGNED anterior
TIMESTAMPS_UPDATED=updatedAt; assignedAt histórico no se elimina; no se crea un nuevo assignedAt
SIDE_EFFECTS=Después del commit: aviso a dispatch y al chofer; el Trip queda disponible para nueva asignación
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_CANCELLED; TRIP_ALREADY_COMPLETED
SUCCESS_RESULT=Trip REQUESTED, driverId=null, vehicleId=null y evento de liberación/reasignación trazable
RETRY_BEHAVIOR=Repetir cuando ya está REQUESTED sin asignación devuelve estado actual si la razón es compatible; no duplica evento
AUDIT_REQUIREMENTS=TripEvent DRIVER_REASSIGNED; AuditLog para operación manual sensible con actor y motivo
OUT_OF_SCOPE=Usar PATCH genérico de status; decidir penalidades; asignar automáticamente otro Driver

Se recomienda `vehicleId=null` tras liberar: el vehículo pertenece a la asignación actual y conservarlo en el agregado produciría una falsa asociación. El vehículo anterior queda en metadata mínima del evento si hace falta trazabilidad.

### UC-12 CANCEL_TRIP_PASSENGER

USE_CASE_ID=UC-12
NAME=CANCEL_TRIP_PASSENGER
PURPOSE=Permitir que el pasajero cancele su propio viaje antes del inicio.
PRIMARY_ACTOR=PASSENGER
SECONDARY_ACTORS=SYSTEM sólo para validar expiración o estado concurrente
AGENCY_SCOPE=Trip del pasajero; Agency se toma del Trip
AUTH_REQUIRED=REQUIRED para el contrato base; guest cancellation requiere decisión separada
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=REQUESTED; ASSIGNED; DRIVER_EN_ROUTE; ARRIVED
RESULTING_STATE=CANCELLED
PRECONDITIONS=Trip propio; no iniciado; motivo válido; no completado ni cancelado
INPUTS=Trip identificado; cancelReasonCode; cancelReasonText opcional
SERVER_RESOLVED_FIELDS=passengerId desde sesión; cancelledByActorType=PASSENGER; cancelledByActorId; cancelledAt; fromStatus; agencyId
VALIDATIONS=Ownership; estado cancelable; motivo; no penalidades económicas; no aceptar passengerId o status del cliente
AUTHORIZATION=Sólo el pasajero propietario; no puede cancelar viajes ajenos
DOMAIN_OPERATION=Cancelación condicional al estado actual
EVENTS_CREATED=TRIP_CANCELLED
TIMESTAMPS_UPDATED=cancelledAt; updatedAt
SIDE_EFFECTS=Después del commit: notificación opcional a Driver/dispatch; no pago, penalidad ni SMS obligatorio
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_ALREADY_COMPLETED; TRIP_CANCELLED
SUCCESS_RESULT=Trip CANCELLED con actor y motivo registrados
RETRY_BEHAVIOR=Repetir la misma cancelación cuando ya está CANCELLED devuelve resultado final sin duplicar evento; otra razón puede ser conflicto de estado
AUDIT_REQUIREMENTS=TripEvent con fromStatus, motivo y actor; no almacenar PII innecesaria en reasonText
OUT_OF_SCOPE=Cancelación guest definitiva; penalidades; reintegros; cancelación normal IN_PROGRESS

### UC-13 CANCEL_TRIP_DISPATCHER

USE_CASE_ID=UC-13
NAME=CANCEL_TRIP_DISPATCHER
PURPOSE=Cancelar operativamente un viaje de la Agency del Dispatcher.
PRIMARY_ACTOR=DISPATCHER
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Agency del Dispatcher y del Trip
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=REQUESTED; ASSIGNED; DRIVER_EN_ROUTE; ARRIVED
RESULTING_STATE=CANCELLED
PRECONDITIONS=Dispatcher autorizado; Trip dentro de su Agency; viaje no iniciado; razón operativa
INPUTS=Trip identificado; cancelReasonCode; cancelReasonText opcional
SERVER_RESOLVED_FIELDS=agencyId; actor; cancelledByActorType=DISPATCHER; cancelledByActorId; fromStatus; cancelledAt
VALIDATIONS=Ownership por Agency; estado cancelable; motivo; no aceptar agencyId o role del cliente
AUTHORIZATION=Sólo Dispatcher de la misma Agency y con permiso de cancelación
DOMAIN_OPERATION=Cancelación condicional al estado actual
EVENTS_CREATED=TRIP_CANCELLED
TIMESTAMPS_UPDATED=cancelledAt; updatedAt
SIDE_EFFECTS=Después del commit: actualización de panel y avisos opcionales; externos no bloquean el dominio
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_ALREADY_COMPLETED; TRIP_CANCELLED
SUCCESS_RESULT=Trip CANCELLED con actor DISPATCHER y motivo
RETRY_BEHAVIOR=Retry sobre cancelación ya aplicada devuelve estado actual sin duplicar evento; estado diferente produce respuesta segura
AUDIT_REQUIREMENTS=TripEvent; AuditLog por acción operativa manual cuando la política de auditoría lo requiera
OUT_OF_SCOPE=Cancelación IN_PROGRESS; penalidades; pagos; caja

### UC-14 CANCEL_TRIP_ADMIN

USE_CASE_ID=UC-14
NAME=CANCEL_TRIP_ADMIN
PURPOSE=Cancelar o corregir operativamente un viaje desde un permiso administrativo de la Agency.
PRIMARY_ACTOR=ADMIN
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Agency del Admin y del Trip
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=RETRY_SAFE
ALLOWED_INITIAL_STATES=REQUESTED; ASSIGNED; DRIVER_EN_ROUTE; ARRIVED
RESULTING_STATE=CANCELLED
PRECONDITIONS=Admin autorizado; Trip dentro de su Agency; estado no iniciado; motivo obligatorio
INPUTS=Trip identificado; cancelReasonCode; cancelReasonText opcional
SERVER_RESOLVED_FIELDS=agencyId; actor; cancelledByActorType=ADMIN; cancelledByActorId; fromStatus; cancelledAt
VALIDATIONS=Permiso administrativo; ownership Agency; estado cancelable; motivo; no aceptar status/actor/Agency del cliente
AUTHORIZATION=ADMIN de la misma Agency con permiso explícito de cancelación/corrección
DOMAIN_OPERATION=Cancelación condicional y auditada
EVENTS_CREATED=TRIP_CANCELLED
TIMESTAMPS_UPDATED=cancelledAt; updatedAt
SIDE_EFFECTS=Después del commit: avisos opcionales y actualización de operación; no consecuencias económicas
ERRORS=TRIP_NOT_FOUND; TRIP_FORBIDDEN; INVALID_TRANSITION; TRIP_ALREADY_COMPLETED; TRIP_CANCELLED
SUCCESS_RESULT=Trip CANCELLED con motivo, actor y estado anterior
RETRY_BEHAVIOR=Retry idéntico devuelve resultado final sin duplicar evento; divergencia de motivo requiere nueva decisión y puede producir conflicto
AUDIT_REQUIREMENTS=TripEvent y AuditLog obligatorios por acción administrativa sensible
OUT_OF_SCOPE=Cancelar IN_PROGRESS; borrar historial; penalizar; reembolsar

### UC-15 VIEW_ACTIVE_TRIP_PASSENGER

USE_CASE_ID=UC-15
NAME=VIEW_ACTIVE_TRIP_PASSENGER
PURPOSE=Permitir al pasajero consultar el estado operativo de sus viajes activos sin exponer datos internos.
PRIMARY_ACTOR=PASSENGER
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Sólo Trips propios; Agency derivada del Trip
AUTH_REQUIRED=REQUIRED en el contrato base
IDEMPOTENCY_REQUIRED=N/A
ALLOWED_INITIAL_STATES=REQUESTED; ASSIGNED; DRIVER_EN_ROUTE; ARRIVED; IN_PROGRESS
RESULTING_STATE=Sin cambio de estado
PRECONDITIONS=Sesión válida; existe al menos un Trip propio activo
INPUTS=Filtro/paginación conceptual; no passengerId confiado
SERVER_RESOLVED_FIELDS=passengerId desde sesión; Agency; datos visibles por rol; asignación y estado actuales
VALIDATIONS=Ownership; estado activo; minimización de campos; no auditoría interna
AUTHORIZATION=PASSENGER sólo ve sus propios viajes
DOMAIN_OPERATION=Lectura de vista materializada conceptualmente; no mutación
EVENTS_CREATED=Ninguno
TIMESTAMPS_UPDATED=Ninguno
SIDE_EFFECTS=Ninguno; cualquier refresh es lectura
ERRORS=TRIP_FORBIDDEN; TRIP_NOT_FOUND
SUCCESS_RESULT=Estado, ruta, tarifa snapshot y datos mínimos de chofer/vehículo permitidos
RETRY_BEHAVIOR=Lectura repetible; devolver versión actual sin crear efectos
AUDIT_REQUIREMENTS=No registrar cada lectura normal; acceso administrativo o anómalo puede auditarse según política futura
OUT_OF_SCOPE=GPS histórico completo; auditoría; datos internos; edición; chat; pagos

### UC-16 VIEW_ASSIGNED_TRIP_DRIVER

USE_CASE_ID=UC-16
NAME=VIEW_ASSIGNED_TRIP_DRIVER
PURPOSE=Permitir al chofer ver sólo los viajes que tiene asignados y los datos mínimos para operar.
PRIMARY_ACTOR=DRIVER
SECONDARY_ACTORS=SYSTEM
AGENCY_SCOPE=Trips asignados al Driver efectivo; Agency derivada del ownership
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=N/A
ALLOWED_INITIAL_STATES=ASSIGNED; DRIVER_EN_ROUTE; ARRIVED; IN_PROGRESS
RESULTING_STATE=Sin cambio de estado
PRECONDITIONS=Sesión DRIVER válida; asignación vigente
INPUTS=Filtro/paginación conceptual; no driverId confiado
SERVER_RESOLVED_FIELDS=driverId desde sesión; Agency; Trips asignados; campos minimizados del pasajero
VALIDATIONS=Asignación actual; estado operativo; minimización de teléfono/PII; no datos administrativos
AUTHORIZATION=DRIVER sólo ve viajes asignados a él
DOMAIN_OPERATION=Lectura autorizada
EVENTS_CREATED=Ninguno
TIMESTAMPS_UPDATED=Ninguno
SIDE_EFFECTS=Ninguno
ERRORS=TRIP_FORBIDDEN; TRIP_NOT_FOUND
SUCCESS_RESULT=Origen, destino, estado, datos mínimos del pasajero, vehículo y timestamps necesarios
RETRY_BEHAVIOR=Lectura repetible sin efectos
AUDIT_REQUIREMENTS=No auditar cada lectura normal; accesos excepcionales futuros pueden registrarse
OUT_OF_SCOPE=Viajes de otros choferes; datos administrativos; historial GPS completo; edición de Trip

### UC-17 VIEW_OPERATION_DISPATCHER

USE_CASE_ID=UC-17
NAME=VIEW_OPERATION_DISPATCHER
PURPOSE=Permitir a dispatch consultar la operación de viajes de su Agency.
PRIMARY_ACTOR=DISPATCHER
SECONDARY_ACTORS=ADMIN; SYSTEM
AGENCY_SCOPE=Todos los Trips permitidos de la Agency del Dispatcher; ADMIN ve los de su Agency según permisos
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=N/A
ALLOWED_INITIAL_STATES=REQUESTED; ASSIGNED; DRIVER_EN_ROUTE; ARRIVED; IN_PROGRESS; COMPLETED; CANCELLED según filtro operativo
RESULTING_STATE=Sin cambio de estado
PRECONDITIONS=Sesión operativa válida; permiso de consulta; Agency resuelta server-side
INPUTS=Filtros de estado, fecha, zona o actor como criterios no autoritativos
SERVER_RESOLVED_FIELDS=agencyId; actor; scope; ownership; datos operativos visibles; relaciones Driver/Vehicle
VALIDATIONS=Filtros acotados; límites de paginación; no cruzar Agency; no aceptar agencyId de la UI como scope
AUTHORIZATION=DISPATCHER sólo su Agency; ADMIN sólo su Agency y permisos; SYSTEM para procesos internos
DOMAIN_OPERATION=Lectura operativa autorizada
EVENTS_CREATED=Ninguno
TIMESTAMPS_UPDATED=Ninguno
SIDE_EFFECTS=Ninguno
ERRORS=TRIP_FORBIDDEN; TRIP_NOT_FOUND
SUCCESS_RESULT=Listado/detalle con estado, chofer, vehículo, origen/destino, tarifa y timestamps operativos
RETRY_BEHAVIOR=Lectura repetible sin mutación
AUDIT_REQUIREMENTS=No auditar cada consulta normal; exportaciones o accesos sensibles pueden requerir AuditLog futuro
OUT_OF_SCOPE=Editar; reasignar; configurar tarifas; ver secretos; cross-Agency

### UC-18 VIEW_TRIP_HISTORY

USE_CASE_ID=UC-18
NAME=VIEW_TRIP_HISTORY
PURPOSE=Consultar viajes pasados respetando el alcance del actor y la minimización de datos.
PRIMARY_ACTOR=PASSENGER, DRIVER o DISPATCHER
SECONDARY_ACTORS=ADMIN; SYSTEM
AGENCY_SCOPE=PASSENGER: propios; DRIVER: propios/asignados según retención; DISPATCHER/ADMIN: Agency propia
AUTH_REQUIRED=REQUIRED
IDEMPOTENCY_REQUIRED=N/A
ALLOWED_INITIAL_STATES=COMPLETED; CANCELLED; también estados activos si la vista histórica admite continuidad
RESULTING_STATE=Sin cambio de estado
PRECONDITIONS=Sesión válida; scope de historial permitido; política de retención vigente
INPUTS=Rango temporal y filtros como criterios no autoritativos
SERVER_RESOLVED_FIELDS=actor; Agency; ownership; campos visibles; retención y límites
VALIDATIONS=Ownership; rango y paginación; minimización de PII; no auditoría completa para pasajeros/choferes
AUTHORIZATION=PASSENGER sólo propios; DRIVER sólo viajes asignados a él; DISPATCHER/ADMIN sólo Agency propia
DOMAIN_OPERATION=Lectura autorizada del historial funcional
EVENTS_CREATED=Ninguno
TIMESTAMPS_UPDATED=Ninguno
SIDE_EFFECTS=Ninguno
ERRORS=TRIP_FORBIDDEN; TRIP_NOT_FOUND
SUCCESS_RESULT=Historial resumido con estados, timestamps, ruta y tarifa según visibilidad del actor
RETRY_BEHAVIOR=Lectura repetible sin efectos
AUDIT_REQUIREMENTS=AuditLog no visible para pasajeros/choferes; acceso administrativo extraordinario puede auditarse
OUT_OF_SCOPE=Edición de historial; borrado; GPS histórico completo; exportación fiscal; métricas

## 5. Crear Trip: convergencia de canales

`CREATE_TRIP_APP`, `CREATE_TRIP_PHONE` y `CREATE_TRIP_DISPATCHER` son entradas distintas que deben converger en una única operación de dominio `CREATE_TRIP`.

La diferencia está en `requestSource`, el actor creador y la posibilidad de contacto operacional. No deben existir tres implementaciones independientes de tarifa, estado inicial, idempotencia o creación de eventos.

| Caso | requestSource | passengerId | Actor creador | Estado |
|---|---|---|---|---|
| UC-01 | APP | requerido si autenticado; opcional si guest | PASSENGER o SYSTEM | REQUESTED |
| UC-02 | PHONE | nullable | DISPATCHER | REQUESTED |
| UC-03 | DISPATCHER | nullable | DISPATCHER o ADMIN | REQUESTED |

## 6. Asignación

`ASSIGN_DRIVER` sólo acepta una asignación si el Trip está en `REQUESTED`, el Driver está disponible y todos los recursos pertenecen a la misma Agency. La resolución debe ser condicional: si dos operadores intentan asignar simultáneamente, sólo una operación puede ganar el estado esperado; la otra recibe el estado actual o un conflicto seguro, sin sobrescribir la primera.

La asignación directa (`POLICY_A_DIRECT_ASSIGNMENT`) es la recomendación para el MVP. La aceptación explícita (`POLICY_B_DRIVER_ACCEPTANCE`) queda como `BUSINESS_DECISION_REQUIRED` porque agrega expiración, rechazo, UX y carreras nuevas.

## 7. Chofer en camino

Sólo el Driver asignado puede producir `ASSIGNED -> DRIVER_EN_ROUTE` en el flujo normal. La identidad se extrae de la sesión. Un `driverId` recibido desde el cliente sólo puede ser tratado como dato no confiable y nunca como fuente de autorización.

## 8. Llegada

La llegada es una confirmación explícita en fase 1. No requiere GPS real ni geocerca. Si el Trip ya está `ARRIVED` y la confirmación proviene del mismo Driver, el retry es seguro y no modifica el timestamp original.

## 9. Inicio

`START_TRIP` avanza sólo de `ARRIVED` a `IN_PROGRESS`. Requiere asignación vigente, Driver correcto y llegada confirmada. No se permite iniciar desde `ASSIGNED` ni saltar estados para simplificar la UI.

## 10. Finalización

`COMPLETE_TRIP` avanza sólo de `IN_PROGRESS` a `COMPLETED`. El snapshot final mínimo es `completedAt`, `driverId`, `vehicleId` y el snapshot de tarifa ya existente. No incluye pagos, comisiones, liquidación, caja ni facturación.

## 11. Reasignación

La reasignación conserva `Trip.id` y todos los eventos anteriores.

- Reemplazo directo: `previousDriverId -> newDriverId`, estado operativo conservado, evento `DRIVER_REASSIGNED`.
- Sin reemplazo: `previousDriverId -> null`, delegación a `RELEASE_DRIVER_ASSIGNMENT`, estado `REQUESTED`.

Metadata mínima: `previousDriverId`, `newDriverId` nullable, `reasonCode` y `reasonText` opcional. No incluir PII innecesaria.

## 12. Liberación

`RELEASE_DRIVER_ASSIGNMENT` es una operación de dominio distinta de `PATCH status=REQUESTED`.

La opción recomendada es dejar `driverId=null` y `vehicleId=null` en el agregado. La asociación anterior sólo queda en `TripEvent` para evitar que el Trip parezca todavía asignado a un vehículo que ya no participa.

## 13. Cancelación

Las cancelaciones se separan por actor porque cambian la autoridad, el audit log y el mensaje operativo:

- `CANCEL_TRIP_PASSENGER`: sólo el propietario del Trip.
- `CANCEL_TRIP_DISPATCHER`: sólo un Dispatcher de la Agency.
- `CANCEL_TRIP_ADMIN`: sólo un Admin de la Agency, con audit log obligatorio.

Las tres comparten el grafo permitido: `REQUESTED`, `ASSIGNED`, `DRIVER_EN_ROUTE`, `ARRIVED` -> `CANCELLED`. No se permite cancelación normal desde `IN_PROGRESS`, `COMPLETED` ni `CANCELLED`. No se definen penalidades económicas.

## 14. Casos de lectura

Las lecturas nunca reciben un actor/tenant confiable desde query o body. El servidor calcula el scope desde la sesión:

- pasajero: sus propios viajes;
- chofer: viajes asignados a él;
- dispatcher: viajes de su Agency;
- admin: recursos de su Agency según permiso.

El historial no equivale al audit log. Un pasajero puede ver el resumen de sus viajes, pero nunca eventos administrativos internos ni datos de otros actores.

## 15. Matriz de permisos

| Acción | PASSENGER | DRIVER | DISPATCHER | ADMIN | SYSTEM |
|---|---|---|---|---|---|
| CREATE_APP_TRIP | ALLOW | DENY | CONDITIONAL | CONDITIONAL | CONDITIONAL |
| CREATE_PHONE_TRIP | DENY | DENY | ALLOW | CONDITIONAL | DENY |
| CREATE_MANUAL_TRIP | DENY | DENY | ALLOW | ALLOW | CONDITIONAL |
| ASSIGN_DRIVER | DENY | CONDITIONAL | ALLOW | ALLOW | CONDITIONAL |
| REASSIGN_DRIVER | DENY | DENY | ALLOW | ALLOW | CONDITIONAL |
| RELEASE_ASSIGNMENT | DENY | DENY | ALLOW | ALLOW | CONDITIONAL |
| MARK_EN_ROUTE | DENY | CONDITIONAL | CONDITIONAL | CONDITIONAL | CONDITIONAL |
| MARK_ARRIVED | DENY | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENY |
| START_TRIP | DENY | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENY |
| COMPLETE_TRIP | DENY | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENY |
| CANCEL_REQUESTED | CONDITIONAL | DENY | ALLOW | ALLOW | CONDITIONAL |
| CANCEL_ASSIGNED | CONDITIONAL | DENY | ALLOW | ALLOW | CONDITIONAL |
| CANCEL_EN_ROUTE | CONDITIONAL | DENY | ALLOW | ALLOW | CONDITIONAL |
| CANCEL_ARRIVED | CONDITIONAL | DENY | ALLOW | ALLOW | CONDITIONAL |
| VIEW_OWN_TRIP | ALLOW | DENY | CONDITIONAL | CONDITIONAL | CONDITIONAL |
| VIEW_ASSIGNED_TRIP | DENY | ALLOW | CONDITIONAL | CONDITIONAL | CONDITIONAL |
| VIEW_AGENCY_TRIPS | DENY | DENY | ALLOW | ALLOW | CONDITIONAL |
| EDIT_FARE | DENY | DENY | CONDITIONAL | ALLOW | CONDITIONAL |
| EDIT_ZONE | DENY | DENY | CONDITIONAL | ALLOW | DENY |
| EDIT_DRIVER | DENY | DENY | CONDITIONAL | ALLOW | DENY |
| EDIT_VEHICLE | DENY | DENY | CONDITIONAL | ALLOW | DENY |

### Significado de CONDITIONAL

- `PASSENGER CREATE_APP_TRIP`: depende de sesión o política guest.
- `ADMIN CREATE_APP_TRIP`: sólo si una herramienta administrativa simula una solicitud APP; el caso normal de Admin es alta manual.
- `SYSTEM CREATE_APP_TRIP`: sólo integraciones o automatismos aprobados.
- `DRIVER ASSIGN_DRIVER`: sólo si se adopta autoaceptación/autoselección futura; DENY en MVP recomendado.
- `DISPATCHER/ADMIN/SYSTEM MARK_*`: sólo corrección o automatismo explícito y auditado; el flujo normal lo ejecuta DRIVER.
- `DRIVER START_TRIP/COMPLETE_TRIP`: sólo si es el Driver asignado y el estado esperado coincide.
- `DISPATCHER/ADMIN COMPLETE_TRIP`: corrección excepcional, nunca finalización silenciosa de un Trip ajeno.
- `PASSENGER CANCEL_*`: sólo su propio Trip y mientras el estado sea cancelable.
- `SYSTEM CANCEL_*`: sólo timeout/regla definida; no inventa penalidades.
- `VIEW_*` condicional: requiere scope de Agency/relación con Trip y minimización de datos.
- `EDIT_FARE`: Dispatcher sólo si se aprueba permiso específico; cualquier cambio futuro debe crear una nueva versión o corrección auditada, nunca mutar un snapshot histórico.
- `EDIT_ZONE`, `EDIT_DRIVER`, `EDIT_VEHICLE`: Dispatcher sólo con permisos específicos de configuración/operación.

## 16. Campos cliente vs servidor

| Campo | Cliente puede enviar | Servidor resuelve | Motivo |
|---|---|---|---|
| `agencyId` | Puede aparecer como candidato en una UI interna; no es autoridad | Sí | Evitar cross-Agency y spoofing de tenant |
| `passengerId` | Sólo como referencia candidata en PHONE/DISPATCHER | Sí | La sesión o relación autorizada decide el pasajero |
| `driverId` | Puede proponer candidato en asignación interna | Sí | La sesión y ownership deciden actor/asignación |
| `vehicleId` | Puede proponer candidato en operación interna | Sí | Debe pertenecer a Agency y ser válido |
| `role` | No | Sí | El rol proviene de sesión/permisos |
| `status` | No | Sí | La máquina de estados es autoridad del dominio |
| `fareAmount` | No como autoridad; una UI interna sólo puede proponer un valor para validación futura | Sí | Proteger el snapshot y evitar manipulación económica |
| `fareCurrency` | No como autoridad | Sí | La tarifa vigente define moneda |
| `fareVersionId` | No como autoridad | Sí | El servidor selecciona la versión aplicable |
| `createdByActorType` | No | Sí | El servidor identifica al creador real |
| `createdByActorId` | No | Sí | Se deriva de sesión o proceso SYSTEM |
| `requestSource` | Puede indicar canal en una operación interna controlada | Sí, canoniza | Evitar falsificar APP/PHONE/DISPATCHER |
| `origin` | Sí | Sí, normaliza y valida | Es dato funcional del usuario, no de autorización |
| `destination` | Sí | Sí, normaliza y valida | Es dato funcional del usuario, no de autorización |
| `notes` | Sí | Sí, limita y minimiza | Evitar PII/HTML/secretos innecesarios |
| `idempotencyKey` | Sí | Sí, valida y scopea | El cliente aporta intención; el servidor decide deduplicación |

## 17. Idempotencia por caso

| Caso | Idempotencia requerida | Key scope | Fingerprint |
|---|---|---|---|
| `CREATE_TRIP_APP` | YES | Actor/guest scope + Agency + operación de creación | Ruta, notas relevantes, pasajero contextual y source |
| `CREATE_TRIP_PHONE` | YES | Dispatcher + Agency + operación de creación | Ruta, pasajero/contacto operacional y source PHONE |
| `CREATE_TRIP_DISPATCHER` | YES | Actor operativo + Agency + operación de creación | Ruta, pasajero y source DISPATCHER |
| `ASSIGN_DRIVER` | EVALUATE; siempre retry-safe | Agency + Trip + intención de asignación | Driver, Vehicle y versión de estado |
| `ACCEPT_OR_START_ASSIGNMENT` | RETRY-SAFE | Trip + Driver + assignment version | Acción accept/reject y versión |
| `DRIVER_EN_ROUTE` | RETRY-SAFE | Trip + Driver + transición | Acción y estado esperado |
| `DRIVER_ARRIVED` | RETRY-SAFE | Trip + Driver + transición | Acción y estado esperado |
| `START_TRIP` | RETRY-SAFE | Trip + Driver + transición | Acción y estado esperado |
| `COMPLETE_TRIP` | RETRY-SAFE | Trip + Driver + transición | Acción y estado esperado |
| `REASSIGN_DRIVER` | RETRY-SAFE | Trip + actor + versión de asignación | Previous/new Driver, Vehicle y reasonCode |
| `RELEASE_DRIVER_ASSIGNMENT` | RETRY-SAFE | Trip + actor + versión de asignación | Previous Driver y reasonCode |
| `CANCEL_*` | RETRY-SAFE | Trip + actor + operación | Estado previo y reasonCode |
| `VIEW_*` | N/A | N/A | N/A |

Mismo key y mismo fingerprint deben devolver el resultado ya aceptado. Mismo key y fingerprint distinto deben producir `IDEMPOTENCY_CONFLICT`.

## 18. Concurrencia por caso

| Operación | Riesgo | Protección conceptual |
|---|---|---|
| `CREATE_TRIP_*` | Retry duplica viajes | Idempotency key + fingerprint + operación atómica |
| `ASSIGN_DRIVER` | Dos operadores asignan distintos choferes | `expectedStatus=REQUESTED`; update condicional/transacción; una sola asignación gana |
| `ACCEPT_OR_START_ASSIGNMENT` | Aceptación, rechazo y timeout compiten | Assignment version; transición condicional; release/reassign atómico |
| `DRIVER_EN_ROUTE` | Doble confirmación o actor incorrecto | Sesión del Driver + `expectedStatus=ASSIGNED`; retry-safe |
| `DRIVER_ARRIVED` | Dos confirmaciones cambian timestamp | `expectedStatus=DRIVER_EN_ROUTE`; conservar primer resultado válido |
| `START_TRIP` | Iniciar cancelado o dos veces | `expectedStatus=ARRIVED`; transacción con evento |
| `COMPLETE_TRIP` | Doble finalización | `expectedStatus=IN_PROGRESS`; snapshot final único; evento único |
| `CANCEL` vs `START` | Carrera entre cancelación e inicio | Ambos exigen estado esperado y sólo una transición puede ganar |
| `REASSIGN_DRIVER` | Se pierde el chofer anterior o se pisa una asignación | Versión de asignación; registrar evento anterior/nuevo; operación atómica |
| `RELEASE_DRIVER_ASSIGNMENT` | Release pisa una nueva asignación | Validar versión/chofer esperado; si cambió, conflicto |
| `VIEW_*` | Lectura de estado transitorio | Lectura consistente; no produce mutación |

No se prescribe un lock distribuido en esta etapa. La garantía de dominio debe descansar primero en estado esperado, transacción, restricciones y eventos.

## 19. Side effects

Regla explícita:

```text
DOMAIN_COMMIT_FIRST
SIDE_EFFECTS_AFTER_COMMIT
```

El cambio válido de Trip y su `TripEvent` no depende del éxito de una notificación externa. Después del commit podrían existir:

- notificación al pasajero;
- notificación al chofer;
- push;
- realtime;
- SMS;
- WhatsApp.

Cada efecto debe poder reintentarse o fallar de forma aislada, sin crear un segundo Trip ni revertir silenciosamente una transición válida. Push, realtime, SMS y WhatsApp permanecen fuera de implementación.

## 20. Visibilidad de datos

`VISIBLE` significa que el actor puede recibir el campo en el contexto autorizado. `LIMITED` significa que requiere estado, relación, propósito o minimización adicional. `HIDDEN` no forma parte de la vista. `FUTURE_DECISION` necesita una política antes de exponerse.

| Campo | Passenger view | Driver view | Dispatcher view | Admin view |
|---|---|---|---|---|
| `tripId` | VISIBLE propio | VISIBLE asignado | VISIBLE Agency | VISIBLE Agency |
| passenger name | VISIBLE propio | LIMITED mínimo operativo | VISIBLE operativo | VISIBLE con permiso |
| passenger phone | LIMITED propio/operativo | LIMITED sólo si necesario | LIMITED operativo | LIMITED con permiso |
| driver name | LIMITED si asignado | VISIBLE propio | VISIBLE operativo | VISIBLE con permiso |
| vehicle | VISIBLE si asignado | VISIBLE asignado | VISIBLE operativo | VISIBLE con permiso |
| plate | LIMITED según necesidad | VISIBLE asignado | VISIBLE operativo | VISIBLE con permiso |
| origin | VISIBLE propio | VISIBLE asignado | VISIBLE Agency | VISIBLE Agency |
| destination | VISIBLE propio | VISIBLE asignado | VISIBLE Agency | VISIBLE Agency |
| fare | VISIBLE snapshot propio | LIMITED operativo | VISIBLE operativo | VISIBLE con permiso |
| status | VISIBLE propio | VISIBLE asignado | VISIBLE Agency | VISIBLE Agency |
| timestamps | LIMITED relevantes | LIMITED relevantes | VISIBLE operativos | VISIBLE operativos |
| agency internal data | HIDDEN | HIDDEN | LIMITED según permiso | VISIBLE según permiso |
| audit events | HIDDEN | HIDDEN | LIMITED resumen si autorizado | VISIBLE según permiso |
| cancel reason | LIMITED propio | LIMITED si afecta operación | VISIBLE operativo | VISIBLE auditado |
| notes | LIMITED propias/operativas | LIMITED mínimo necesario | VISIBLE operativo | VISIBLE con permiso |
| GPS history | FUTURE_DECISION | FUTURE_DECISION | FUTURE_DECISION | FUTURE_DECISION |

La minimización prevalece: conocer un Trip no habilita a conocer todos los datos de sus actores.

## 21. Errores

| Error | Casos aplicables | Semántica |
|---|---|---|
| `TRIP_NOT_FOUND` | UC-04 a UC-18 | El Trip no existe o no es visible dentro del scope del actor |
| `TRIP_FORBIDDEN` | UC-01 a UC-18 | El actor no posee la relación, Agency o permiso necesario |
| `INVALID_TRANSITION` | UC-04 a UC-14 | El estado actual no permite la operación o falta una precondición |
| `DRIVER_NOT_AVAILABLE` | UC-04, UC-10 | El Driver no está disponible o no cumple condiciones |
| `DRIVER_ALREADY_ASSIGNED` | UC-04, UC-10 | El Driver tiene una asignación incompatible |
| `TRIP_ALREADY_ASSIGNED` | UC-04 | El Trip ya tiene asignación activa no reemplazada por la operación correcta |
| `TRIP_ALREADY_COMPLETED` | UC-09, UC-11, UC-12, UC-13, UC-14 | El Trip está terminal completado |
| `TRIP_CANCELLED` | UC-04 a UC-09, UC-11 | El Trip fue cancelado y no admite esa operación |
| `INVALID_LOCATION` | UC-01, UC-02, UC-03, UC-06, UC-07, futuro tracking | Coordenadas ausentes, inválidas, fuera de rango o no autorizadas |
| `INVALID_FARE` | UC-01, UC-02, UC-03, UC-16, UC-17 | Falta snapshot aplicable o el valor no cumple la política |
| `IDEMPOTENCY_CONFLICT` | UC-01 a UC-14 según operación | Key repetida con fingerprint distinto |

Las respuestas futuras deben ser genéricas, sin stack, secretos, SQL, tokens ni PII innecesaria. La tabla no fija todavía códigos HTTP ni payloads definitivos.

## 22. Decisiones abiertas

Se mantienen las 8 decisiones de `TRIP_DOMAIN_CONTRACT.md`; no se inventa una respuesta de negocio.

| Decisión | Impacto directo | Clasificación |
|---|---|---|
| Dispatch automático vs manual | UC-04, UC-10, UC-11, UC-17 | BLOCKING_BEFORE_BACKEND |
| Aceptación del chofer | UC-04, UC-05, UC-06, UC-10, UC-11 | BLOCKING_BEFORE_BACKEND |
| Autoasignación por cercanía | UC-04, UC-10 | CAN_DEFER |
| Reglas exactas de cancelación | UC-12, UC-13, UC-14 y mensajes/ventanas | BLOCKING_BEFORE_BACKEND |
| Zonas reales | UC-01, UC-02, UC-03, UC-04, UC-17 | CAN_DEFER con selección manual inicial |
| Pricing | UC-01, UC-02, UC-03, UC-09, UC-17 | CAN_DEFER con FareVersion configurada |
| Cuenta de pasajero | UC-01, UC-12, UC-15, UC-18 | BLOCKING_BEFORE_BACKEND para cerrar APP guest/auth |
| Retención de GPS | UC-06, UC-07, UC-15, UC-16, UC-18 | CAN_DEFER mientras no haya tracking real |

### USE_CASE_BLOCKING_DECISIONS

#### BLOCKING_BEFORE_BACKEND

1. Si el dispatch del MVP será manual o si habrá asignación automática.
2. Si el Driver debe aceptar/rechazar o la asignación será directa; la recomendación documental es `POLICY_A_DIRECT_ASSIGNMENT` para simplificar el MVP.
3. Qué ventana y condiciones operativas exactas tiene la cancelación, sin definir aún penalidades económicas.
4. Si `CREATE_TRIP_APP` requiere cuenta o admite pasajero invitado.

`BLOCKING_DECISIONS_COUNT=4`.

#### CAN_DEFER

1. Autoasignación por cercanía.
2. Zonas geométricas; el MVP puede seleccionar zonas manualmente.
3. Pricing detallado; el backend puede comenzar con una `FareVersion` explícita y snapshot estable.
4. Retención/frecuencia del GPS; realtime no es requisito de fase 1.

## 23. Fuera de alcance

No se diseñan todavía:

- URLs de endpoints;
- payloads HTTP definitivos;
- Prisma schema;
- migraciones;
- SQL;
- implementación de auth;
- nombres de cookies;
- JWTs;
- WebSockets;
- mapas;
- geocoding;
- push;
- PWA;
- pagos;
- caja;
- comisión;
- liquidaciones.

## 24. Recomendación siguiente fase

Resolver las cuatro decisiones clasificadas como `BLOCKING_BEFORE_BACKEND` y convertir los casos UC-01, UC-04, UC-06, UC-07, UC-08, UC-09, UC-11 y UC-12 en escenarios de aceptación, sin implementar todavía endpoints.

## 25. Markers

TRIP_USE_CASES_SPEC=PASS
CREATE_TRIP_DEFINED=YES
ASSIGNMENT_DEFINED=YES
DRIVER_FLOW_DEFINED=YES
COMPLETION_DEFINED=YES
REASSIGNMENT_USE_CASE_DEFINED=YES
RELEASE_ASSIGNMENT_DEFINED=YES
CANCELLATION_USE_CASES_DEFINED=YES
READ_USE_CASES_DEFINED=YES
PERMISSION_MATRIX_CREATED=YES
SERVER_RESOLVED_FIELDS_DEFINED=YES
IDEMPOTENCY_BY_USE_CASE_DEFINED=YES
CONCURRENCY_BY_USE_CASE_DEFINED=YES
SIDE_EFFECT_POLICY_DEFINED=YES
DATA_VISIBILITY_MATRIX_CREATED=YES
ERROR_MAPPING_CREATED=YES
OPEN_DECISIONS_CLASSIFIED=YES

SOURCE_CODE_TOUCHED=NO
DELIGO_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Resolver las cuatro decisiones BLOCKING_BEFORE_BACKEND y convertir los casos críticos en escenarios de aceptación.
