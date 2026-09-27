# Bloque 1 — estado demo compartido y dispatch secuencial/exclusivo

## Baseline

- Proyecto: `remis-norte-prototipo`
- Rama: `testing`
- `PRE_BLOCK1_HEAD`: `78ff6a95d9816f6b3ba96a5195e1fd3fb3469560`
- `origin/testing` antes del cambio: igual al HEAD
- Árbol de trabajo antes del cambio: limpio

## Arquitectura demo

Se creó `src/demo/` como capa de prototipo independiente del backend. `DemoProvider` monta un reducer en memoria alrededor del router existente; `useDemo()` expone el estado y acciones tipadas para los siguientes bloques. No se agregó persistencia. El reducer es puro y determinístico: no usa reloj, aleatoriedad, red, geolocalización ni backend.

El estado único contiene pasajero, choferes, vehículos, zonas, tarifas, origen/destino seleccionados, un solo viaje activo, oferta actual, historial de ofertas, historial demo, cursor de candidatos y secuencias de IDs determinísticas. `requestTrip` exige origen, destino y una tarifa zonal existente, crea como máximo un viaje activo y arranca la búsqueda sin asignar al chofer. Si no existe tarifa, devuelve una cotización explícita `NO_FARE` y no crea el viaje.

## Tipos y fixtures

`src/demo/types.ts` define pasajero, chofer, vehículo, zona, tarifa, viaje, oferta, disponibilidad, estado de dispatch y acciones. Los estados usan los valores canónicos en mayúsculas solicitados.

`src/demo/fixtures.ts` reutiliza pasajero, chofer, tarifas e historial de `src/mock-data.ts` y añade cuatro choferes con cuatro vehículos y ubicaciones demo locales. Hay **3 disponibles** y 1 no disponible. El chofer C está a 300 m pero no es elegible; el orden inicial válido es A (450 m), B (900 m), D (1.400 m). Las tarifas conservan los importes zonales existentes.

## Dispatch e invariantes

`src/demo/dispatch.ts` ordena elegibles por distancia ascendente y, en empate, `driver.id` ascendente. La cola elegible se captura al iniciar búsqueda y cada oferta se crea sólo cuando la anterior se resuelve. `REJECT` marca la oferta como `REJECTED`; `TIMEOUT` como `EXPIRED`; ambas avanzan entonces al próximo candidato. `ACCEPT` cierra la búsqueda, asigna chofer/vehículo y marca el chofer `BUSY`. Agotados los candidatos, dispatch queda `NO_CANDIDATES` y el viaje sigue `REQUESTED` y sin chofer.

El reducer comprueba en runtime que nunca haya más de una oferta `PENDING`, que la oferta pendiente sea exactamente `currentOffer` y que sólo pertenezca al viaje `REQUESTED` actual. La secuencia del viaje sólo permite `ASSIGNED → DRIVER_EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED`; transiciones inválidas son no-op controlado. Cancelar está permitido sólo hasta `ARRIVED`, cancela la oferta pendiente o libera al chofer asignado, y queda bloqueado desde `IN_PROGRESS`.

## Acciones y selectores

El contexto expone reset, selección de origen/destino, cotización, solicitud/inicio de dispatch, aceptar/rechazar/expirar, progresión del chofer/viaje, cancelación y disponibilidad. Los selectores incluyen chofer/vehículo actual, oferta pendiente, tarifa, candidatos ordenados y permisos de aceptar/rechazar/cancelar.

## Tests y quality gates

- `npm test`: **PASS**, 14 pruebas focales. Cubren elegibilidad/orden, exclusividad e invariante runtime, rechazo, timeout, aceptación, cola agotada, cancelación, transiciones válidas e inválidas, duplicado de solicitud, reset y tarifa inexistente.
- Typecheck: **PASS**, `node_modules/.bin/tsc -b --pretty false`.
- Build: **PASS**, `npm run build` (`tsc -b` + Vite).
- Lint: **NOT_AVAILABLE**, no hay script de lint en `package.json`.
- Smoke local: **PASS**, `/cliente` carga y renderiza el shell actual con `DemoProvider` montado; no requiere backend. El recorrido actual de la UI sigue con fixtures propios; conectarlo es Bloque 2.

## Fileset

- Añadidos: `src/demo/types.ts`, `src/demo/fixtures.ts`, `src/demo/dispatch.ts`, `src/demo/demo-context.ts`, `src/demo/demo-state.tsx`, `src/demo/use-demo.ts`, `tests/demo-dispatch.test.mjs`, este reporte.
- Modificados: `src/App.tsx` (envolver router con `DemoProvider`), `package.json` (script de test acotado al test del frontend).
- Sin cambios en CSS ni en `src/components.tsx`/`src/mock-data.ts`.

## Gates negativos

- `BACKEND_CHANGED=NO`
- `PRISMA_CHANGED=NO`
- `MIGRATION_CHANGED=NO`
- `DATABASE_CONNECTED=NO`; `DATABASE_MUTATED=NO`
- `RAILWAY_TOUCHED=NO`; `PRODUCTION_TOUCHED=NO`
- Sin nuevas dependencias
- Sin `localStorage`
- Sin secrets en los cambios

## NEXT_ACTION

Conectar el flujo Cliente existente de punta a punta al `DemoState` compartido usando el viaje y dispatch ya implementados.
