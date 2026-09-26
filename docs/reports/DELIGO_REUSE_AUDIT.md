# Auditoría técnica read-only de reutilización de DeliGO

## 1. Resultado ejecutivo

La auditoría read-only de DeliGO finalizó correctamente. No se modificó DeliGO, no se modificó el código funcional de Remis y no se tocaron servicios, bases de datos, despliegues ni producción.

DeliGO aporta patrones reutilizables valiosos para Remis en cuatro áreas: contratos de dominio, autorización por actor, consistencia de operaciones y separación entre persistencia, API y UI. No conviene copiar su aplicación completa: Remis parte de un prototipo Vite sin backend, mientras que DeliGO es una plataforma Next/Prisma multirol con una superficie operativa mucho mayor.

La dirección recomendada es evolucionar Remis de forma incremental: conservar Vite como cliente inicial, definir primero el contrato de viaje y sus estados, incorporar después un backend persistente con sesiones y autorización por rol, y dejar realtime/GPS/PWA para cuando el flujo persistido esté estabilizado.

## 2. Alcance y controles de integridad

### DeliGO

- Raíz auditada: `C:\Leo Campos\Trabajo\deligo-main-limpio`.
- Branch: `work/p2-t43-r2`.
- SHA observado: `e1fee008d326b800cb311f5a65a391601c4dc1ab`.
- El worktree ya estaba dirty antes de la auditoría: 4 archivos modificados y aproximadamente 320 entradas sin trackear. Ese estado se registró y no se atribuye a este trabajo.
- Se verificó la existencia de `.env` sin leer ni imprimir valores. La auditoría sólo consideró nombres/configuración estructural; no expuso secretos.
- No se ejecutaron migraciones, `db:push`, `db:reset`, deploys, pushes, instalaciones ni comandos que alteren el repositorio o servicios.

### Remis

- Raíz: `C:\Leo Campos\Trabajo\EL JAGUAR`.
- Branch esperada: `main`.
- HEAD esperado y observado: `311bcefb0f7b6394e5e2e3d7600098858aa46b7e`.
- Baseline funcional: `f4fde2cb4bf3032b2bdde02d3d171426169cd68d`.
- Diff funcional `f4fde2c..HEAD` sobre `src`, configuración y manifest: vacío.
- Preflight: PASS. La auditoría no encontró divergencia funcional posterior al baseline.

## 3. Inventario de DeliGO

### Stack y ejecución

- Next.js 16 con App Router, React 19 y TypeScript estricto.
- Prisma 6 sobre PostgreSQL; cliente generado y esquema en `prisma/schema.prisma`.
- Bun como runtime/comandos observados (`bun.lock`, scripts `bun`, Bun Test); no se encontró una versión Node formalizada en `.nvmrc`/`.node-version`.
- Tailwind 4, Radix UI, shadcn-style components, `lucide-react`, `framer-motion`, TanStack Query, Zustand, React Hook Form, Zod, Sonner y React Leaflet.
- Build standalone de Next; `start` ejecuta `.next/standalone/server.js` con Bun. Caddy actúa como reverse proxy local.
- Servicio separado `mini-services/chat-service` con Socket.IO.

### Tamaño funcional observado

- 242 archivos de route handlers bajo `src/app/api`.
- 52 páginas App Router.
- 195 archivos de componentes.
- 352 módulos bajo `src/lib`.
- 38 archivos relacionados con Prisma.
- 329 archivos de test/spec detectados; 326 usan `bun:test` directamente.

## 4. Arquitectura y patrones reutilizables

### 4.1 Contrato de dominio y estados

El agregado central de DeliGO es `Pedido`, con estado, cliente, negocio, repartidor, método de entrega, importes, idempotencia, eventos, ubicación y revisiones de chat/tracking. Las transiciones se centralizan en `src/lib/order-transitions.ts` y los handlers validan el grafo antes de persistir.

Patrones recomendables para Remis:

1. Definir `Trip` como agregado con estados explícitos (`requested`, `assigned`, `arrived`, `in_progress`, `completed`, `cancelled`) y una única autoridad de transiciones.
2. Modelar cada transición como operación autorizada, no como edición libre de un string de estado.
3. Registrar eventos de viaje y actor que produjo el cambio.
4. Mantener idempotency key/fingerprint para solicitudes de creación o reintentos del cliente.
5. Separar snapshot operativo del historial de eventos; no depender sólo del estado actual para auditoría.

No reutilizar literalmente los nombres `Pedido`, estados gastronómicos, campos de mesa/salón ni reglas de negocio de delivery.

### 4.2 Autenticación, sesiones y autorización

`src/lib/auth.ts` implementa sesiones DB-backed con token hasheado, cookies separadas por familia de actor, expiración, validación y revocación. `src/proxy.ts` aplica headers de seguridad, validación suave de sesión, protección por prefijo y chequeos de origen para mutaciones. Los handlers vuelven a validar autorización en servidor.

Patrones recomendables:

- sesión opaca almacenada como hash en DB, con expiración y logout revocable;
- cookie HttpOnly/SameSite/Secure según entorno;
- autorización en dos capas: guard de entrada y ownership dentro del handler/query;
- respuestas genéricas para credenciales inválidas y logs sanitizados mediante `safeErrorForLog`;
- rate limit de login y operaciones sensibles;
- no confiar en `userId`, `role` o `businessId` enviados por el cliente.

La separación entre `proxy.ts` y auth centralizado es útil, pero no debe tomarse como autorización suficiente: el propio handler debe resolver el actor y aplicar ownership.

### 4.3 Roles y multi-tenant

Los roles observados son `cliente`, `negocio`, `repartidor`, `admin`, `mozo`, `salon`, `empleado` y `operaciones`. El ancla tenant-like es `Negocio`; numerosos modelos contienen `negocioId`, y `src/lib/access-control.ts` verifica que referencias de productos/opciones pertenezcan al mismo negocio.

Para Remis, el equivalente conceptual sería:

- `Passenger`/cliente;
- `Driver`/chofer;
- `Dispatcher`/operador;
- eventualmente `Agency`/tenant si varias remiserías compartirán plataforma.

Recomendación: decidir temprano si Remis será single-tenant o multi-tenant. Si es single-tenant inicial, no incorporar toda la complejidad de `Negocio`; sí conservar la regla de ownership y diseñar IDs/consultas de forma que la futura separación por tenant sea posible.

### 4.4 Consistencia, concurrencia e idempotencia

DeliGO usa transacciones Prisma, locks de aplicación, actualizaciones condicionales, CAS, rate limits y tests específicos para ownership del lock y carreras de estado. El flujo de pedido combina validación de referencias, límites, idempotencia y efectos secundarios de notificación.

Patrones especialmente transferibles:

- lock lógico por `tripId` para cambios de estado;
- update condicional donde el estado esperado forma parte del `WHERE`;
- transacción para cambiar estado y crear evento juntos;
- idempotencia persistente para creación de viaje y callbacks externos;
- efectos secundarios posteriores y tolerantes a fallas, sin convertir una notificación fallida en un viaje inexistente;
- tests de carrera y reintentos, no sólo tests del camino feliz.

No copiar locks en memoria como solución definitiva si Remis termina con más de una instancia. En ese caso debe usarse una garantía transaccional/DB o un mecanismo distribuido.

### 4.5 API

Los handlers siguen un patrón repetido: parsear request, resolver sesión, validar ownership, cargar entidades mínimas, ejecutar operación y devolver JSON con status explícito y `Cache-Control: no-store` en información privada. El endpoint de ubicación del repartidor agrega límites de payload, validación de coordenadas, rate limit, asociación con negocio, asignación al pedido y elegibilidad del tracking.

Para Remis se recomienda adoptar desde temprano:

- contratos JSON pequeños y estables;
- códigos HTTP coherentes `400/401/403/404/409/429/500`;
- errores de cliente sin stack ni detalles internos;
- `no-store` para sesión, viaje activo, ubicación y panel operativo;
- validación de tamaño y forma antes de tocar DB;
- separación entre endpoint público de búsqueda y endpoint autenticado de operación.

### 4.6 Prisma y modelo de datos

El esquema usa CUID, timestamps, índices, relaciones explícitas y reglas `Cascade`, `SetNull` y `Restrict`. Hay modelos específicos para sesiones, throttle, auditoría, notificaciones, push, eventos de pedido, tracking, chat y cuentas operativas.

Ideas reutilizables:

- `Session`, `LoginThrottle`, `AuditLog`, `Notification`, `PushSubscription` y `TripEvent` como conceptos separados;
- índices compuestos por tenant/estado/fecha;
- relaciones explícitas para ownership y asociaciones chofer-agencia;
- eventos append-only para trazabilidad.

Riesgos que no deben copiarse sin decisión:

- importes monetarios almacenados como `Float`; para Remis conviene usar enteros en centavos o `Decimal`;
- varios blobs JSON serializados como `String`; usar JSON tipado/normalizado donde haya consultas o reglas importantes;
- migrar el esquema completo de DeliGO como si fuera un dominio equivalente.

## 5. PWA, realtime, tracking y mapas

### PWA

DeliGO tiene manifests por rol, `dynamic-manifest.tsx`, registro de service worker, cache network-first, share target, push, deep links y workarounds específicos para iOS standalone/safe areas. Es una solución madura, pero de alto costo de mantenimiento.

Reutilizable en Remis, más adelante:

- manifest único para el rol principal;
- registro/actualización de service worker con control de versión;
- instalación y estado standalone encapsulados en hooks/componentes;
- navegación segura desde notificaciones hacia rutas internas.

No reutilizar inicialmente la multiplicidad de manifests y workarounds iOS de DeliGO. Primero validar si la operación de chofer realmente necesita una PWA instalada.

### Realtime y chat

El canal realtime no acepta un join de sala libre: `src/app/api/realtime/authorize/route.ts` emite una capability firmada con pedido, actor, sesión, scopes y TTL. `mini-services/chat-service` valida JWT HMAC, sesión activa, room binding, scopes, expiración, rate limits, deduplicación y publicación interna autenticada.

Este es el patrón más importante para una futura ubicación en Remis: un chofer autenticado debe obtener una capability acotada a su viaje, con TTL y scopes, en lugar de publicar a cualquier canal identificado por el cliente.

Orden recomendado para Remis:

1. persistir viaje y autorización;
2. endpoint autenticado de ubicación con ownership, frecuencia y rango;
3. polling controlado si alcanza para el MVP;
4. WebSocket/SSE sólo cuando la latencia lo justifique.

### GPS y mapas

DeliGO valida latitud/longitud, aplica límites, tracking eligibility, asociación chofer-negocio, snapshots, trayectoria y opcionalmente map matching OSRM. La UI usa React Leaflet para el mapa.

Para Remis, reutilizar la política de validación y autorización, pero no asumir un proveedor cartográfico concreto. Separar:

- captura de posición;
- persistencia/última posición;
- distribución a pasajeros/operadores;
- visualización de mapa;
- geocodificación/ruteo.

## 6. UI, formularios y manejo de errores

DeliGO tiene primitives reutilizables basadas en Radix, `cn`, botones/badges/dialogs/popovers/sheets, React Hook Form y un provider de React Query. Zustand se usa para estado de UI/sesión/notificaciones; Sonner cubre feedback breve; Framer Motion se usa para animaciones.

Para Remis conviene tomar sólo el enfoque:

- componentes de presentación pequeños;
- formularios controlados con validación declarativa;
- estado remoto separado del estado visual;
- mensajes de error y estados loading/empty/error definidos por pantalla;
- navegación y feedback accesibles.

El sistema visual actual de Remis ya tiene CSS propio y `lucide-react`; no hay necesidad de importar toda la capa Radix/Tailwind de DeliGO en esta fase.

La validación de DeliGO es mixta: Zod/React Hook Form donde aplica y validación manual explícita en handlers críticos. Para Remis, usar un esquema compartido por formulario y servidor cuando exista backend, y reservar validaciones manuales para reglas de dominio que no sean sólo de forma.

## 7. Notificaciones

DeliGO combina notificación persistida en DB, centro de notificaciones, Web Push VAPID, navegación por rol y limpieza CAS de subscriptions expiradas. `NotificationType` y los builders separan contenido, destinatario, origen de PII y destino de navegación. `public/sw.js` maneja click y apertura segura de rutas internas.

Patrones reutilizables:

- evento de dominio produce una notificación persistida;
- push es un canal adicional, tolerante a fallas;
- tipo y destino se modelan explícitamente;
- cleanup de endpoint sólo si el proveedor confirma expiración;
- nunca interpolar secrets/PII en logs.

Para Remis, empezar con notificaciones in-app o polling del estado del viaje. Agregar Web Push cuando exista una necesidad operativa clara y un modelo de consentimiento por usuario/dispositivo.

## 8. Despliegue y operación

La evidencia local muestra build standalone, launcher Bun, copia explícita de assets standalone (`scripts/copy-standalone-assets.js`) y Caddy como reverse proxy. También hay un script de subida a `testing` que contiene checkout, build opcional, exclusión de `.env`, commit, rebase y push.

Esto es reutilizable como checklist operativo, no como script para Remis. El script tiene efectos destructivos/externos y no fue ejecutado. Remis no tiene backend, variables de entorno, remote ni configuración de producción según `INITIAL_BASELINE.md`; no hay una ruta de despliegue lista para portar.

## 9. Tests y evidencia de calidad

DeliGO posee 329 archivos de test, mayormente Bun Test, con cobertura de:

- auth, throttle y coexistencia de sesiones;
- ownership/multi-tenant;
- transiciones y concurrencia;
- rutas API;
- push y service worker;
- chat/realtime;
- tracking y mapas;
- contratos estáticos de UI/PWA;
- integraciones condicionadas a una DB de testing.

Lo más reutilizable no es copiar tests sino copiar la estrategia: tests puros para políticas, tests de handler con dependencias controladas, static-contract tests para invariantes de configuración y una suite de integración separada que exige explícitamente la DB de testing.

No se ejecutaron tests de DeliGO ni se levantaron servicios, porque la auditoría solicitada era read-only y el proyecto contiene suites que pueden requerir DB o servicios externos.

## 10. Matriz de reutilización para Remis

| Área | Decisión | Aplicación sugerida |
|---|---|---|
| Estados de viaje | Reutilizar concepto | Máquina de estados única y eventos de transición |
| Sesiones | Reutilizar patrón | Sesión revocable, token hasheado, cookie segura |
| Ownership | Reutilizar | Actor autenticado decide el tenant/recurso, no el body |
| Idempotencia | Reutilizar | Crear viaje y callbacks con clave persistente |
| Concurrencia | Reutilizar adaptado | CAS/transacción; lock distribuido si escala |
| Audit log | Reutilizar concepto | Actor, acción, recurso, timestamp y metadata sanitizada |
| UI primitives | Reutilizar selectivamente | Mantener CSS actual; extraer sólo patrones necesarios |
| React Query/Zustand | Evaluar | Útiles cuando aparezca backend y estado remoto real |
| Web Push/PWA | Fase posterior | Sólo para chofer/operador si el caso operativo lo exige |
| Socket.IO/capabilities | Fase posterior | Adoptar el modelo de capability por viaje, no el servicio completo |
| Prisma/schema DeliGO | No copiar | Crear modelo Remis propio |
| Estados gastronómicos/mesas | No copiar | No tienen equivalencia en transporte |
| Multirol operativo completo | No copiar de entrada | Introducir sólo pasajero, chofer y operador |
| Float/JSON-string de DeliGO | No copiar sin revisión | Dinero y datos consultables requieren mejor modelado |
| Script de deploy/testing | No ejecutar ni portar literal | Convertir requisitos en un runbook seguro |

## 11. Backlog de dirección recomendado

1. Definir el contrato de `Trip`, actores, estados, eventos y errores; congelarlo como documento/API contract.
2. Elegir single-tenant o multi-tenant y documentar ownership.
3. Diseñar backend mínimo persistente para pasajeros, choferes, viajes y sesiones.
4. Implementar transición de viaje con idempotencia, CAS/transacción y audit log.
5. Conectar el frontend Vite actual a lectura/escritura real con estados de loading/error.
6. Agregar ubicación autenticada y polling; medir necesidad real de realtime.
7. Evaluar PWA/push/mapas como capacidades posteriores y separables.

## 12. Limitaciones

- La auditoría es estática y read-only; no certifica comportamiento productivo de DeliGO.
- No se inspeccionaron valores de `.env`, credenciales, URLs privadas ni secretos.
- No se ejecutaron suites, migraciones, builds de DeliGO ni servicios externos.
- El worktree dirty de DeliGO impide afirmar limpieza global del repositorio; sí permite afirmar que la auditoría no agregó cambios.
- Las recomendaciones son de arquitectura y reutilización; no constituyen autorización para implementar todavía.

## 13. Marcadores finales

DELIGO_AUDIT=PASS
DELIGO_ROOT_CONFIRMED=YES
DELIGO_BRANCH=work/p2-t43-r2
DELIGO_SHA=e1fee008d326b800cb311f5a65a391601c4dc1ab
DELIGO_WORKTREE_UNCHANGED=YES

REMIS_FUNCTIONAL_BASELINE_SHA=f4fde2cb4bf3032b2bdde02d3d171426169cd68d
REMIS_EXPECTED_AUDIT_HEAD=311bcefb0f7b6394e5e2e3d7600098858aa46b7e
REMIS_HEAD_MATCHED=YES
REMIS_FUNCTIONAL_DIFF_AFTER_BASELINE=NO
REMIS_BASELINE_VALID=YES

STACK_INVENTORIED=YES
AUTH_AUDITED=YES
ROLES_AUDITED=YES
PWA_AUDITED=YES
REALTIME_AUDITED=YES
API_AUDITED=YES
PRISMA_AUDITED=YES
MULTITENANCY_AUDITED=YES
UI_PATTERNS_AUDITED=YES
VALIDATION_AUDITED=YES
NOTIFICATIONS_AUDITED=YES
MAPS_AUDITED=YES
DEPLOY_AUDITED=YES
TESTS_AUDITED=YES
REUSE_MATRIX_CREATED=YES

DELIGO_TOUCHED=NO
REMIS_CODE_TOUCHED=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES

NEXT_ACTION=Definir el contrato de Trip, actores, estados y ownership antes de implementar backend o realtime.
