# Análisis de brechas — prototipo listo para presentación

**Alcance:** auditoría estática, READ-ONLY, del frontend actual. No se ejecutaron cambios de producto, backend, Prisma, base de datos, Railway ni Production.

## Estado actual

El frontend está en la raíz del repositorio, bajo `src/` (Vite + React + TypeScript + React Router); no existe una carpeta `frontend/`. La experiencia implementada es principalmente una demo visual móvil para Cliente. No existe actualmente una app de Chofer ni de Central/Admin.

| Rol/flujo | Estado | Evidencia y alcance actual |
|---|---|---|
| CLIENTE | **PARTIAL** | Hay rutas y pantallas estáticas para inicio, búsqueda, vista previa/tarifa, buscando, asignado, llegó, viaje en curso y finalizado; también historial, detalle, tarifas, ayuda y perfil. Los botones `DemoPanel` permiten recorrer algunos estados con navegación. Sin embargo, cada paso usa fixtures independientes, el viaje no tiene estado compartido y la tarifa no se recalcula por destino. Cancelar sólo vuelve al inicio; los botones de llamada/cancelación y varios accesos visuales no ejecutan acciones. No se guarda continuidad entre recargas. |
| CHOFER | **MISSING** | No hay rutas, login demo, disponibilidad, bandeja de ofertas, aceptar/rechazar ni acciones de llegada/inicio/finalización. El único chofer se muestra como ficha estática en pantallas del Cliente. |
| CENTRAL/ADMIN | **MISSING** | No hay rutas ni dashboard, mapa operativo, gestión de pedidos, asignación/override, tarifas editables ni historial administrativo. Las tarifas existentes son fixtures de sólo lectura. |

No se clasificó ningún rol completo como `BROKEN`: el flujo Cliente puede recorrerse visualmente, pero no constituye aún un proceso integrado con estado y reglas operativas. Hay controles puntuales sin acción asociada que deben conectarse o presentarse claramente como decorativos.

## Navegación, estado e interacciones

- `src/App.tsx` declara exclusivamente rutas `/cliente...`; la ruta desconocida redirige a `/cliente`.
- `src/components.tsx` contiene navegación inferior del Cliente y componentes compartidos, pero el botón de menú no tiene acción. Los botones de llamar y cancelar en las pantallas del viaje tampoco tienen `onClick`.
- El estado React local se limita a modal de tarifa, texto de búsqueda, filtro de historial y puntuación. No se encontró store, Context, reducer, `localStorage`, `sessionStorage` ni integración `fetch`.
- El destino viaja como query string entre pantallas; el origen, tarifa y demás datos del viaje siguen siendo valores fijos de `src/mock-data.ts`.
- `DemoPanel` salta entre rutas de estado del Cliente; no existe máquina de estados común, temporizador de oferta ni asignación a conductores.

## Datos demo y localización

`src/mock-data.ts` ya ofrece una base visual útil: Cliente y chofer de ejemplo, origen en Av. Libertad, destinos rápidos de Casa/Trabajo/Terminal/Calilegua, cuatro tarifas zonales y cinco viajes de historial. `AppMap` dibuja una representación CSS/SVG con Libertador General San Martín, Calilegua, Río San Francisco, Hospital O. Orías, Terminal y UNJu. Es ilustrativa, no geolocalización ni mapa operativo.

No hay fixtures de una flota/cola de despacho ni datos enlazados para que una acción de un rol actualice los otros. Los importes, vehículo y viaje activo son constantes.

## Componentes reutilizables existentes

`AppHeader`, `PageContainer`, `CustomerBottomNav`, `PrimaryButton`, `SecondaryButton`, `AppMap`/`MapMarker`, `BottomSheet`, `LocationRow`, `QuickDestination`, `SearchField`, `ScreenTitle`, `TripSummary`, `FareCard`, `DriverCard`, `DriverInfo`, `TripProgress`, `TripCard`, `StatusBadge`, `FareUpdateDialog` y `DemoPanel`. El estilo comparte tarjetas redondeadas, fondo claro, azul, estados verde/rojo y una composición mobile-first.

## Responsive y presentación

El CSS aplica un shell centrado de ancho máximo 520 px y una media query a partir de 700 px que modifica márgenes y la hoja del inicio. Esto da una base adecuada para Cliente/Chofer en móvil, pero no implementa una consola Central de escritorio ni un layout de tres roles. El mapa dibujado y las pantallas actuales sirven para una demostración local controlada; faltan navegación entre roles, escenario reiniciable y acciones conectadas.

La revisión fue estática de rutas, componentes, fixtures y CSS; no se ejecutó la aplicación ni una suite de pruebas durante esta auditoría READ-ONLY.

## Cinco bloques prioritarios

1. **Fundación de demo compartida y despacho determinístico.** Definir tipos/estado en memoria y fixtures enlazadas para viaje, clientes y varios choferes. Implementar una única oferta al chofer elegible más cercano: ningún otro la ve hasta `REJECT` o `TIMEOUT`; entonces se presenta la siguiente. Sin persistencia real ni dependencia de PostgreSQL.
2. **Flujo Cliente conectado de punta a punta.** Origen/destino local, cotización zonal, solicitud y estados buscando/asignado/en camino/llegó/en viaje/finalizado/cancelado, vinculados al estado compartido y con datos consistentes.
3. **Experiencia Chofer de demo.** Entrada demo, disponibilidad, oferta exclusiva con origen/destino/tarifa, aceptar/rechazar, llegada, inicio y finalización. Sus acciones actualizan el mismo viaje y disparan el siguiente candidato sólo según la regla canónica.
4. **Central/Admin operativa.** Dashboard responsive para escritorio/tablet con representación local, pedidos activos, choferes/estados, viaje, creación manual, override visual, tarifas zonales e historial básico. Sin caja, liquidaciones, ganancias ni comisiones.
5. **Cierre de presentación.** Selector visible de rol, reinicio de escenario y continuidad opcional con `localStorage` sólo para datos demo; probar el recorrido completo en 360–430 px y Central en desktop/tablet, corregir acciones inertes, accesibilidad y detalles visuales.

## Estado de persistencia e infraestructura

`DATABASE_IMPLEMENTATION_STATUS=PAUSED_AFTER_PREPARATION`. La migración preparada continúa sin aplicar. No se necesita cambiar esa decisión para construir el prototipo presentable; mantener separada la futura persistencia PostgreSQL de la capa demo.

## NEXT_ACTION

Autorizar el **Bloque 1**: especificar e implementar la capa de estado demo compartido y el despacho secuencial/exclusivo determinístico, sin tocar backend, Prisma, DB ni Railway. Después conectar Cliente, Chofer y Central a esa misma base.
