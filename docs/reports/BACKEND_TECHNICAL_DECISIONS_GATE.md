# Gate de decisiones técnicas del backend

## 1. Contexto

Este documento cierra las dos decisiones técnicas que permanecían bloqueantes antes de implementar el backend mínimo de `remis-norte-prototipo`:

1. política de SQL/migrations custom para invariantes PostgreSQL que Prisma no pueda expresar;
2. topología inicial del dispatch worker.

La tarea es exclusivamente documental. No se crea `server/`, `worker`, `prisma/`, schema, migración, DB, endpoint ni dependencia.

## 2. Scope

Incluido:

- fuente de verdad de migrations;
- uso de Prisma y SQL PostgreSQL controlado;
- índices parciales para ofertas activas;
- restricciones sobre raw SQL de runtime;
- locking y seguridad multi-worker;
- topología API/worker;
- responsabilidades separadas;
- código y DB compartidos;
- recuperación ante fallas;
- compatibilidad futura con Railway;
- gates de implementación.

Excluido:

- ejecutar SQL;
- crear migraciones reales;
- instalar Fastify/Prisma;
- tocar PostgreSQL, Railway o Production;
- resolver nuevas decisiones de negocio;
- implementar la primera fase.

## 3. Previous blockers

La arquitectura anterior dejó exactamente dos bloqueos técnicos:

1. cómo garantizar físicamente constraints PostgreSQL no expresables sólo con Prisma;
2. cómo ejecutar dispatch periódico sin depender de timers del proceso HTTP.

Ambos quedan resueltos en este documento. El cierre no modifica el contrato de dominio, la política de dispatch ni las decisiones finales de negocio.

## 4. Custom SQL migration decision

```text
CUSTOM_SQL_MIGRATIONS_POLICY=ALLOWED_AND_REQUIRED_WHEN_DATABASE_INVARIANT_CANNOT_BE_EXPRESSED_BY_PRISMA
PRISMA_REMAINS_PRIMARY_ORM=YES
RAW_SQL_GENERAL_APPLICATION_LOGIC=DISCOURAGED
AD_HOC_PRODUCTION_SQL=FORBIDDEN
```

Prisma continúa siendo la herramienta principal para:

- modelo ordinario;
- relaciones;
- queries comunes;
- transacciones soportadas;
- migraciones normales.

SQL PostgreSQL custom está permitido y es obligatorio cuando una garantía crítica no puede representarse de forma suficiente con Prisma, por ejemplo:

- índices únicos parciales;
- constraints PostgreSQL específicas;
- índices avanzados;
- locking que requiera una construcción SQL explícita;
- invariantes físicas que no deben depender sólo del código.

La decisión no habilita SQL arbitrario como estilo general de aplicación.

## 5. Prisma migration policy

```text
MIGRATION_SOURCE_OF_TRUTH=VERSION_CONTROLLED_MIGRATION_HISTORY
PRISMA_DB_PUSH_PRODUCTION=FORBIDDEN
```

Prisma genera y gestiona la migration base. Si no expresa una constraint crítica, la migration se ajusta de forma controlada incorporando SQL PostgreSQL explícito.

Toda migration custom futura debe:

1. vivir dentro del historial versionado;
2. formar parte del flujo normal de migrations;
3. ser auditable en Git;
4. tener razón documentada;
5. ser reproducible en LOCAL y TEST;
6. ejecutarse primero fuera de Production;
7. tener validación posterior;
8. contar con rollback o fix-forward cuando aplique;
9. no depender de ejecución manual silenciosa;
10. no contener secretos.

No se usarán scripts SQL sueltos fuera del historial como fuente de verdad. `prisma db push` puede evaluarse sólo para prototipos locales efímeros, pero no será workflow canónico de una DB persistente y nunca será despliegue de schema en Production.

## 6. Partial indexes

### Oferta activa por Trip

La garantía física obligatoria es:

```text
MAX_ACTIVE_OFFERS_PER_TRIP=1
```

La estrategia conceptual PostgreSQL es un índice único parcial equivalente a:

```sql
UNIQUE(tripId) WHERE status = 'PENDING'
```

Esto impide que dos transacciones dejen dos `TripOffer PENDING` para el mismo Trip, aunque ambas hayan pasado un `SELECT` previo.

### Oferta activa por Driver

La regla de MVP también exige:

```text
MAX_ACTIVE_PENDING_OFFERS_PER_DRIVER=1
```

Se recomienda un índice único parcial equivalente a:

```sql
UNIQUE(driverId) WHERE status = 'PENDING'
```

Esto impide que un Driver reciba otra oferta incompatible mientras tiene una activa. Si el modelo futuro incorpora compatibilidad por tipo de vehículo, turno o zona, la constraint podrá evolucionar mediante una nueva migration explícita; no se debilita la regla actual.

### Qué garantiza cada capa

- DB: exclusión física de estados `PENDING` duplicados.
- Transacción: cierre/creación y cambio de estado observan una secuencia consistente.
- Estado esperado: evita aplicar un comando sobre una versión lógica vieja.
- Ownership: sólo el Driver owner puede aceptar/rechazar.
- Idempotencia: reintentos no crean segundos efectos.
- Aplicación: valida reglas de negocio previas y traduce conflictos a errores seguros.

La garantía no puede descansar sólo en TypeScript, un `SELECT` previo, un mutex en memoria o la existencia de un único worker.

## 7. Runtime SQL policy

Se distinguen dos usos:

### Migration SQL

Se utiliza para constraints, índices, schema y garantías físicas. Vive versionado, revisado y reproducible.

### Runtime SQL

Sólo se usa cuando Prisma no permite expresar correctamente un mecanismo requerido, por ejemplo `SELECT ... FOR UPDATE`.

Todo runtime SQL futuro debe:

- estar encapsulado en `infrastructure`;
- usar parámetros;
- no concatenar input;
- tener tests de integración;
- no filtrarse al dominio ni a la UI;
- documentar por qué Prisma no alcanza;
- devolver una forma tipada al caso de uso.

No se permite usar raw SQL general para reemplazar el ORM por comodidad ni para omitir authorization/ownership.

## 8. Locking policy

No se define un lock global ni un lock en memoria como garantía primaria.

Patrón preferido:

1. transacción DB;
2. estado esperado;
3. row-level locking o lease corto cuando sea necesario;
4. update condicional;
5. índice único parcial;
6. respuesta idempotente/retry-safe.

El lock protege la secuencia de lectura-modificación; el índice parcial protege la invariante incluso si dos procesos llegan simultáneamente.

## 9. Migration validation

Tests de integración futuros deben demostrar:

- dos transacciones no pueden dejar dos `TripOffer PENDING` para el mismo Trip;
- dos `TripOffer PENDING` incompatibles para el mismo Driver son rechazadas por DB;
- las constraints existen después de reconstruir TEST desde cero;
- LOCAL/TEST reproducen la misma invariante;
- rollback/fix-forward no elimina silenciosamente la protección;
- aplicar migrations versionadas no depende de SQL manual fuera del repositorio.

No se ejecutan SQL ni migrations en esta tarea.

## 10. Worker topology decision

```text
INITIAL_WORKER_TOPOLOGY=SEPARATE_PROCESS_SAME_CODEBASE
```

API y worker viven en el mismo repositorio, comparten dominio, infraestructura, Prisma/client y PostgreSQL, pero tienen entrypoints y responsabilidades separadas.

Layout conceptual futuro:

```text
server/
  src/
    app/
    auth/
    domain/
    application/
    infrastructure/
    http/
    worker/
    api.ts
    worker.ts
```

Los nombres definitivos pueden ajustarse durante implementación, pero API y worker deben conservar responsabilidades separadas.

```text
WORKER_IS_SEPARATE_DOMAIN_SERVICE=NO
WORKER_SHARES_BACKEND_CODEBASE=YES
WORKER_SHARES_DATABASE=YES
WORKER_HAS_SEPARATE_ENTRYPOINT=YES
WORKER_SEPARATE_DEPLOYMENT_PROCESS=YES
```

No se crean dos proyectos independientes ni microservicios separados de dominio.

## 11. API responsibilities

El proceso API será responsable de:

- HTTP;
- autenticación y Session;
- comandos de usuario;
- lecturas por rol;
- `CREATE_TRIP` APP/PHONE/DISPATCHER;
- Accept/Reject de ofertas;
- cancelaciones;
- cambios de estado del Trip;
- comandos Dispatcher/Admin;
- respuestas HTTP seguras.

El API no mantiene timers largos en memoria para avanzar dispatch. Si el worker está caído, el API puede seguir atendiendo operaciones permitidas sin inventar comandos del sistema.

## 12. Worker responsibilities

El proceso worker será responsable de:

- procesar `DispatchSearch SEARCHING`;
- seleccionar candidato `NEAREST_FIRST`;
- crear una única `TripOffer PENDING`;
- detectar `PENDING` vencidas;
- marcar `EXPIRED`;
- continuar al siguiente Driver sólo después de cerrar la oferta previa;
- detectar `NO_CANDIDATES`;
- recovery/reconciliation;
- reparar estados recuperables del dispatch.

No expone HTTP público. Si en el futuro requiere health, será interno y separado del contrato de comandos del usuario.

## 13. Shared code/database

API y worker comparten:

- dominio de Trip y transiciones;
- reglas de elegibilidad;
- política de dispatch;
- repositorios/infraestructura;
- cliente Prisma;
- PostgreSQL;
- invariantes de ofertas;
- configuración validada.

La duplicación de lógica entre API y worker queda prohibida. El worker puede ejecutar operaciones internas autorizadas, pero no aceptar viajes en nombre de Drivers ni cancelar Trips salvo una regla `SYSTEM` explícitamente definida.

PostgreSQL es la fuente de verdad para:

- Trip;
- DispatchSearch;
- TripOffer;
- DriverLocation;
- Driver y disponibilidad;
- Sessions y registros de idempotencia.

## 14. Multi-instance safety

```text
WORKER_SINGLE_INSTANCE_REQUIRED_FOR_CORRECTNESS=NO
```

Inicialmente puede ejecutarse una sola instancia por simplicidad operativa, pero dos workers accidentales deben seguir protegidos mediante:

- row lock o lease;
- expected status;
- transacción;
- índice único parcial;
- idempotencia.

La corrección no depende del número de procesos. Si dos workers intentan crear la siguiente oferta, sólo uno puede ganar el estado esperado y la constraint física impide dos `PENDING`.

## 15. Failure recovery

### Worker cae

El API puede seguir atendiendo funciones no dependientes del avance automático. Los Trips pueden quedar temporalmente en:

- `REQUESTED + SEARCHING`;
- `REQUESTED + PENDING`.

Al reiniciar, el worker reconcilia desde DB; no depende de memoria previa ni pierde la búsqueda.

### API cae

El worker puede continuar operaciones internas de dispatch permitidas, pero no inventa comandos del usuario, no acepta por Drivers y no cancela salvo regla `SYSTEM` futura.

### Estados recuperables

- `REQUESTED + SEARCHING` sin Offer: reanudar selección;
- `REQUESTED + PENDING` vencida: cerrar `EXPIRED` y continuar;
- `REQUESTED + PENDING` válida: mantener espera;
- `ASSIGNED + PENDING`: invalidar oferta inconsistente y conservar asignación;
- `WAITING_FOR_RESPONSE` sin Offer: reparar a `SEARCHING`;
- `NO_CANDIDATES`: mantener hasta nueva condición o intervención;
- `CANCELLED + PENDING`: cerrar Offer como `CANCELLED` y `STOPPED`.

## 16. Local topology

Topología conceptual futura:

```text
Terminal 1: API
Terminal 2: Worker
```

Ambos usan la misma DB local/dev. Comandos futuros podrían ser `dev:api` y `dev:worker`, pero no se fijan scripts ni package manager en esta etapa.

## 17. Future Railway topology

No se toca Railway. El diseño queda compatible con:

```text
Service A: API
Service B: Dispatch Worker
Service C: PostgreSQL
```

API y worker pueden usar el mismo repositorio, build/image y dependencias, con distinto start command. Los fallos de API y worker deben ser observables por separado aunque compartan schema, dominio e invariantes DB.

## 18. Observability

Logs futuros estructurados con:

```text
processRole=api|worker
tripId
dispatchSearchId
offerId
result
duration
reasonCode
```

No incluir:

- passwords;
- tokens o raw session tokens;
- `DATABASE_URL`;
- secretos;
- contacto Passenger innecesario;
- PII que no sea necesaria para diagnosticar.

API tendrá health HTTP normal. Worker puede tener heartbeat persistente, log o health interno más adelante:

```text
WORKER_HEARTBEAT=CAN_DEFER
```

El heartbeat no es blocker del gate.

## 19. Gates

### SQL migration gate

```text
SQL_MIGRATION_POLICY_BLOCKER=RESOLVED
CUSTOM_SQL_MIGRATIONS_POLICY=ALLOWED_AND_REQUIRED_WHEN_NEEDED
PRISMA_REMAINS_PRIMARY_ORM=YES
PARTIAL_UNIQUE_INDEXES_APPROVED=YES
TRIP_PENDING_OFFER_DB_CONSTRAINT_REQUIRED=YES
DRIVER_PENDING_OFFER_DB_CONSTRAINT_REQUIRED=YES
```

El literal abreviado `ALLOWED_AND_REQUIRED_WHEN_NEEDED` en los markers significa la política completa: permitido y requerido cuando la invariante no pueda expresarse con Prisma.

### Worker gate

```text
WORKER_TOPOLOGY_BLOCKER=RESOLVED
INITIAL_WORKER_TOPOLOGY=SEPARATE_PROCESS_SAME_CODEBASE
```

El worker comparte código y DB, tiene entrypoint separado, puede tener proceso/deploy separado y no depende de una única instancia para su corrección.

### Implementation gate

```text
BUSINESS_GATE_FOR_BACKEND=PASS
BACKEND_ARCHITECTURE_GATE=PASS
TECHNICAL_DECISIONS_GATE=PASS
BLOCKING_TECHNICAL_DECISIONS_COUNT=0
IMPLEMENTATION_GATE=READY
```

`READY` habilita únicamente la próxima tarea controlada. No autoriza implementar dentro de esta tarea.

## 20. Next implementation phase

La próxima fase futura será `PHASE_1_BACKEND_SKELETON`:

- `server/` mínimo;
- Node + TypeScript;
- Fastify;
- configuración validada;
- health endpoint;
- test básico;
- scripts mínimos;
- ningún dominio Trip todavía;
- ninguna mutación DB todavía;
- ningún deploy.

Esta fase debe comenzar con preflight, mantenerse pequeña y auditable, y no anticipar schema, migrations, auth completa, worker ni dominio operativo.

## 21. Markers

BACKEND_TECHNICAL_DECISIONS=PASS
CUSTOM_SQL_MIGRATIONS_POLICY=ALLOWED_AND_REQUIRED_WHEN_NEEDED
PRISMA_REMAINS_PRIMARY_ORM=YES
MIGRATION_SOURCE_OF_TRUTH=VERSION_CONTROLLED_MIGRATION_HISTORY
PRISMA_DB_PUSH_PRODUCTION=FORBIDDEN
PARTIAL_UNIQUE_INDEXES_APPROVED=YES
TRIP_PENDING_OFFER_DB_CONSTRAINT_REQUIRED=YES
DRIVER_PENDING_OFFER_DB_CONSTRAINT_REQUIRED=YES
RUNTIME_RAW_SQL_RESTRICTED=YES
IN_MEMORY_LOCK_PRIMARY_GUARANTEE=NO
SQL_MIGRATION_POLICY_BLOCKER=RESOLVED
INITIAL_WORKER_TOPOLOGY=SEPARATE_PROCESS_SAME_CODEBASE
WORKER_SHARES_BACKEND_CODEBASE=YES
WORKER_SHARES_DATABASE=YES
WORKER_HAS_SEPARATE_ENTRYPOINT=YES
WORKER_SEPARATE_DEPLOYMENT_PROCESS=YES
WORKER_SINGLE_INSTANCE_REQUIRED_FOR_CORRECTNESS=NO
WORKER_TOPOLOGY_BLOCKER=RESOLVED
BUSINESS_GATE_FOR_BACKEND=PASS
BACKEND_ARCHITECTURE_GATE=PASS
TECHNICAL_DECISIONS_GATE=PASS
BLOCKING_TECHNICAL_DECISIONS_COUNT=0
IMPLEMENTATION_GATE=READY

SOURCE_CODE_TOUCHED=NO
DELIGO_TOUCHED=NO
DATABASE_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Implementar únicamente PHASE_1_BACKEND_SKELETON con preflight y sin DB/domain/deploy.
