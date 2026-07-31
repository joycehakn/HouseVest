import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'official-cpi-proxy',
      configureServer(server) {
        server.middlewares.use('/api/cpi-series', async (_request, response) => {
          try {
            const upstream = await fetch(
              'https://nstatdb.dgbas.gov.tw/dgbasAll/webMain.aspx?sdmx/A030101015/1.1.M&startTime=1959-01&endTime=2026-06',
              { headers: { Accept: 'application/json' } },
            )
            const body = await upstream.text()
            if (!upstream.ok || !body.trimStart().startsWith('{')) {
              response.statusCode = 502
              response.setHeader('Content-Type', 'application/json; charset=utf-8')
              response.end(JSON.stringify({
                error: '主計總處物價資料目前無法讀取，請稍後再試',
              }))
              return
            }
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(body)
          } catch {
            response.statusCode = 502
            response.end('Official CPI service unavailable')
          }
        })
      },
    },
  ],
  base: '/house-investment-app/',
  server: {
    proxy: {
      '/api/land-sections': {
        target: 'https://lisp.land.moi.gov.tw',
        changeOrigin: true,
        rewrite: () => '/MoiMMSv2/SectionList.ashx',
      },
    },
  },
})
