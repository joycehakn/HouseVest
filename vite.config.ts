import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
