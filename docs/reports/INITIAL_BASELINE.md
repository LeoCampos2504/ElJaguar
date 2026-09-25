# INITIAL BASELINE

## Fecha

2026-09-25 (America/Argentina/Buenos_Aires)

## Proyecto

PROJECT_NAME=remis-norte-prototipo
PROJECT_ROOT=C:\Leo Campos\Trabajo\EL JAGUAR
REPORT_DIR=C:\Leo Campos\Trabajo\EL JAGUAR\docs\reports
REPOSITORY=LOCAL_ONLY_PENDING_REMOTE
MAIN_BRANCH=main
TEST_BRANCH=testing
PRODUCTION_ENV=NOT_CONFIGURED
TESTING_ENV=LOCAL_ONLY

## Preflight

El proyecto no contenía `.git` ni `.gitignore` antes de esta formalización. Se confirmó la presencia de `package.json`, `package-lock.json`, `src/`, `dist/` y `node_modules/`. No se encontraron archivos `.env` ni asignaciones sospechosas de secretos. El inventario inicial registró siete archivos fuente bajo `src/`.

## Stack

- React 19.3.0.
- Vite 8.3.1.
- TypeScript 7.0.2.
- React Router 7.18.4.
- Lucide React 1.48.0.
- CSS propio en `src/styles.css`.
- Node v24.18.0.
- npm 11.16.0.

## Estado funcional

El estado baseline conserva el prototipo cliente navegable existente. Es un frontend mock/demo, sin backend, sin autenticación, sin base de datos, sin realtime, sin GPS, sin mapas externos y sin Production.

Las rutas principales cubren inicio, búsqueda de destino, preview, búsqueda de móvil, móvil asignado, móvil llegado, viaje en curso, finalización, historial, detalle, ayuda, perfil y tarifas. Las transiciones operativas dependen del modo demo `?demo=1` y no representan operaciones reales.

## Git

- Repositorio local inicializado.
- Branch activa: `main`.
- Branch `testing` creada y sin cambios.
- Baseline commit: `f4fde2cb4bf3032b2bdde02d3d171426169cd68d`.
- Remote no configurado.
- No se hizo push.

El commit inicial contiene el snapshot funcional del prototipo y `.gitignore`. Este documento se registra posteriormente como commit documental separado para conservar el SHA del baseline dentro del propio reporte y mantener el working tree limpio.

## Tests baseline

- `npx tsc -p tsconfig.app.json --noEmit --pretty false`: PASS.
- `npx tsc -p tsconfig.node.json --noEmit --pretty false`: PASS.
- `npx vite build --outDir C:\Users\eltig\AppData\Local\Temp\remis-norte-baseline-build --emptyOutDir`: PASS.

El build se ejecutó en una carpeta temporal externa para no modificar `dist/`.

## Archivos principales

- `index.html`: entrada HTML.
- `package.json` y `package-lock.json`: scripts y dependencias.
- `vite.config.ts`: configuración mínima de Vite con React.
- `tsconfig*.json`: configuración TypeScript.
- `src/App.tsx`: rutas y pantallas del prototipo cliente.
- `src/components.tsx`: componentes reutilizables.
- `src/mock-data.ts`: cliente, chofer, vehículo, viajes y tarifas mock.
- `src/types.ts`: tipos `Trip`, `Fare`, `FareVersion`, `Driver`, etc.
- `src/styles.css`: sistema visual completo.
- `src/main.tsx`: montaje React.
- `docs/reports/`: directorio canónico de reportes.

`node_modules/` y `dist/` existen localmente, pero están excluidos por `.gitignore` y no forman parte del baseline.

## Riesgos actuales

- Sin backend.
- Sin persistencia.
- Sin autenticación.
- Sin tests automatizados.
- Sin lint configurado.
- Flujo demo/mock.
- Sin GPS, mapas reales ni realtime.
- Acciones de ayuda, menú, llamada y cancelación sin integración operativa.
- Datos mock parcialmente duplicados en pantallas y componentes.
- Dependencias declaradas con `latest` en `package.json`, aunque fijadas en el lockfile actual.

## Production

PRODUCTION_EXISTS=NO
PRODUCTION_TOUCHED=NO

No se encontraron configuraciones de despliegue, credenciales, remotes ni entornos productivos.

## Rollback

ROLLBACK_BASELINE=f4fde2cb4bf3032b2bdde02d3d171426169cd68d

Este commit representa el punto de retorno visual y funcional del prototipo actual. La branch `testing` queda creada para futuras validaciones sin cambios en este baseline.

## Next action

No implementar nada en esta etapa. Sugerencia única:

Auditoría READ-ONLY de DeliGO para identificar arquitectura y patrones reutilizables.

BASELINE_PREFLIGHT=PASS
BASELINE_GIT_INIT=PASS
BASELINE_REPORT_DIR=PASS
BASELINE_TYPECHECK_APP=PASS
BASELINE_TYPECHECK_NODE=PASS
BASELINE_BUILD=PASS
BASELINE_COMMIT=PASS
BASELINE_TEST_BRANCH_CREATED=PASS
BASELINE_WORKTREE_CLEAN=YES
BASELINE_SHA=f4fde2cb4bf3032b2bdde02d3d171426169cd68d
MAIN_BRANCH=main
TEST_BRANCH=testing
REMOTE_CONFIGURED=NO
PRODUCTION_EXISTS=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=YES
NEXT_ACTION=Auditar DeliGO READ-ONLY para identificar arquitectura y patrones reutilizables.
