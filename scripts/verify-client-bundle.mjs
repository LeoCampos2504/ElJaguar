// Verifies that dist/ holds the CLIENT target only (run after `vite build --mode client`).
// Fails if any presentation-prototype, driver, central or saved-location surface leaked
// into the bundle, or if the client surface itself is missing.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assetsDir = join(dist, 'assets')

const decode = (text) => text
  .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const assets = readdirSync(assetsDir).filter((name) => /\.(js|css)$/.test(name))
const bundle = assets.map((name) => decode(readFileSync(join(assetsDir, name), 'utf8'))).join('\n')

const forbidden = [
  // presentation prototype / demo
  'Vista demo', 'Cambiar rol demo', 'RESET DEMO', 'PROTOTIPO', 'Prototipo', 'DEMO · DEBUG', 'Destinos rápidos', 'Destinos recientes',
  // driver and central surfaces
  'VER ESTADO EN MODO CLIENTE', 'Central operativa', 'Central · Modo demo', 'Asignación de móviles', 'RESUMEN OPERATIVO',
  // prototype routes
  '"/demo"', '"/cliente"', '/chofer', '/central',
  // out of pilot scope
  'Favoritos', 'Guardados', 'Direcciones frecuentes',
]
const required = ['Iniciar sesión', 'Registrarme', '¿A dónde vas?', 'Buscando un chofer disponible', 'Tu viaje fue aceptado', 'PEDIR REMIS']

const failures = []
if (!/<title>EL JAGUAR<\/title>/.test(html)) failures.push('dist/index.html does not carry the client title')
if (/Prototipo/i.test(html)) failures.push('dist/index.html still mentions the prototype')
for (const marker of forbidden) if (bundle.includes(marker)) failures.push(`forbidden marker in bundle: ${marker}`)
for (const marker of required) if (!bundle.includes(marker)) failures.push(`client marker missing from bundle: ${marker}`)

if (failures.length) {
  console.error('CLIENT_BUNDLE_VERIFIED=NO')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`CLIENT_BUNDLE_VERIFIED=YES (${assets.length} assets checked)`)
