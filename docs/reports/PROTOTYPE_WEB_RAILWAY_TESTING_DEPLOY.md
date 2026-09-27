# Prototype Web — Railway TESTING Deployment

## Baseline

- Project: `remis-norte-prototipo` (`C:\Leo Campos\Trabajo\EL JAGUAR`)
- Git branch: `testing`
- Pre-deploy HEAD / `origin/testing`: `bb466c095d2a7e617ef137ec59ad9feedf512fc6`
- `main`: `4804e8be5b478e0ea0fb92f78e2736fbf61c39b4` (unchanged)
- Worktree before changes: clean
- Frontend: Vite + React with React Router; root `/`, build `npm run build`, output `dist`
- `dist/index.html` exists after build.

## Architecture and cause

Railway TESTING previously had the Fastify API service `testing jaguar`, rooted at `/server`. It implements `/health` and `/ready`, but does not serve the frontend at `/`, so an API `GET /` returning 404 is expected and remains unchanged. The React/Vite application lives at the repository root and needs an SPA fallback for React Router paths.

The deployment keeps these concerns separate:

| Railway service | Root | Purpose |
| --- | --- | --- |
| `testing jaguar` | `/server` | Fastify API |
| `testing jaguar web` | `/` | React/Vite SPA |
| `Postgres` | existing | Existing TESTING database service |

## Frontend production server

Added `serve` as a regular dependency and the npm start script `serve --single --listen $PORT dist`. The `--single` option serves `index.html` for client-side routes. Existing `dev`, `build`, `preview`, and test scripts remain in place.

Support commit: `8267c60643f12c804925beb8c586456cf23e39aa` (`chore: add frontend production server`), pushed to `origin/testing`.

Validation from the repository root:

- `npm test`: PASS (20 tests)
- `node_modules\.bin\tsc -b --pretty false`: PASS
- `npm run build`: PASS
- `dist/index.html`: present
- Local static server on port 4173: `/`, `/cliente`, `/cliente/viajes`, and `/cliente/tarifas` each returned HTTP 200; local process stopped after smoke testing.
- `LOCAL_STATIC_ROOT=PASS`; `LOCAL_SPA_FALLBACK=PASS`.

## Railway TESTING deployment

- Railway project: `tender-nurturing`
- Environment: `testing`
- New service: `testing jaguar web` (`d2d41ef9-ba44-4dcc-9ee8-7ae5214ba9e1`)
- Source: `LeoCampos2504/ElJaguar`, branch `testing`
- Root directory: `/`
- Build command: `npm run build`
- Start command: `npm run start`
- Deployment status: `SUCCESS`, running; deployed commit `8267c60643f12c804925beb8c586456cf23e39aa`
- Public Railway URL: <https://testing-jaguar-web-testing.up.railway.app>
- A Railway-provided domain was created; no custom domain was created.
- No database, PostgreSQL, or Prisma variables were configured on the web service.

Remote smoke against the web URL:

| GET | Result |
| --- | --- |
| `/` | HTTP 200, Vite app HTML and assets |
| `/cliente` | HTTP 200 |
| `/cliente/viajes` | HTTP 200 |
| `/cliente/tarifas` | HTTP 200 |

`WEB_ROOT_SMOKE=PASS`; `WEB_CLIENT_ROUTE_SMOKE=PASS`; `WEB_SPA_FALLBACK_SMOKE=PASS`. The HTML title is `Remis Norte · Prototipo`, confirming this is the React prototype, not Fastify.

## Backend regression and scope gates

After the web deployment, the existing API remained rooted at `/server`. Its root still returns the expected HTTP 404; `/health` returned HTTP 200 with `{"status":"ok","service":"remis-norte-api"}`, and `/ready` returned HTTP 200 with status `ready`. API configuration was not edited and no explicit API redeploy command was run. Railway reports the pushed `testing` commit as the API's latest deployment, confirming the branch push also triggered its normal automatic deployment; the API regression checks passed afterward.

- `API_HEALTH_AFTER_WEB_DEPLOY=PASS`
- `API_READY_AFTER_WEB_DEPLOY=PASS`
- `API_SERVICE_CHANGED=NO` (no API service settings or source changed)
- `POSTGRES_CHANGED=NO`
- `DATABASE_MUTATED=NO`; no database variables were added to the web service
- `PRISMA_CHANGED=NO`
- `MIGRATION_CHANGED=NO`
- `MAIN_BRANCH_TOUCHED=NO`
- `PRODUCTION_TOUCHED=NO`
- `SECRET_SCAN=PASS` (reviewed scoped source and report changes; no secret values included)
- `CUSTOM_DOMAIN_CREATED=NO`
- Responsive certification at 360/390/430 px remains deferred to `DEFERRED_TO_PROTOTYPE_FINAL_PRESENTATION_QA`.

## Next action

`NEXT_ACTION=Implementar PROTOTYPE BLOCK 3: experiencia Chofer conectada al mismo DemoState compartido.`
