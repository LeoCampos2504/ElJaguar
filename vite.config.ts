import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type AppTarget = 'client' | 'prototype'

// The client target ships without the presentation prototype's document metadata.
function clientDocument(target: AppTarget): Plugin {
  return {
    name: 'el-jaguar-client-document',
    transformIndexHtml(html) {
      if (target !== 'client') return html
      return html
        .replace(/<title>[^<]*<\/title>/, '<title>EL JAGUAR</title>')
        .replace(/<meta name="description" content="[^"]*" \/>/, '<meta name="description" content="EL JAGUAR: pedí tu remis en Libertador General San Martín y Calilegua." />')
    },
  }
}

export default defineConfig(({ mode }) => {
  const target: AppTarget = mode === 'client' ? 'client' : 'prototype'
  return {
    plugins: [react(), clientDocument(target)],
    define: {
      'import.meta.env.VITE_APP_TARGET': JSON.stringify(target),
    },
  }
})
