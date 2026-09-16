import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// SEO (F8): a URL do domínio final ainda não foi escolhida. index.html usa o placeholder
// literal "__SITE_URL__" (canonical, OG/Twitter, JSON-LD) -- este plugin o substitui pelo
// valor de SITE_URL no build. Em dev, ou se a variável não estiver definida, cai para um
// domínio inválido de propósito (RFC 2606) para nunca publicar por engano uma URL real.
function siteUrlPlugin(): Plugin {
  const siteUrl = (process.env.SITE_URL ?? 'https://EXEMPLO.invalid').replace(/\/$/, '')
  return {
    name: 'substituir-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrlPlugin()],
  base: '/',
  build: {
    sourcemap: false,
  },
  // Fixo em 5174 (documentado em CLAUDE.md) -- antes só .claude/launch.json fixava a porta
  // via "-- --port 5174 --strictPort" na invocação do preview; "npm run dev --prefix web" puro
  // (como um agente sem esse launch config roda) caía no default do Vite (5173), divergindo da
  // doc. strictPort: falha alto em vez de subir noutra porta silenciosamente.
  server: {
    port: 5174,
    strictPort: true,
  },
})
