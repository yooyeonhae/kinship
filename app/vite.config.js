import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vercel은 app/api/*.js를 서버리스 함수로 자동 인식하지만 vite dev는 그렇지 않다.
// 같은 핸들러를 dev 서버 미들웨어로도 걸어 두 환경의 /api 경로를 하나로 유지한다.
const API_ROUTES = new Set(['/api/tour'])

function apiRoutes() {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      // WEATHER_API_KEY/TOUR_API_KEY는 VITE_ 접두사가 없어 번들에 들어가지 않는다.
      // 핸들러가 process.env로 읽으므로 dev에서만 수동으로 주입한다.
      // configureServer는 서버가 재시작될 때마다 다시 불리고 그때 loadEnv가 빈 값을
      // 돌려주는 경우가 있어, 빈 값이 이미 들어간 키를 덮어쓰지 않도록 막는다.
      const env = loadEnv(server.config.mode, server.config.envDir || server.config.root, '')

      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0]
        if (!API_ROUTES.has(path)) return next()
        // 기동 시점에 한 번만 넣으면 이후 vite 내부에서 다시 비워지는 경우가 있어
        // 요청마다 주입한다. 빈 값이 실제 값을 덮지 않도록 truthy만 반영한다.
        for (const [key, value] of Object.entries(env)) {
          if (value) process.env[key] = value
        }
        try {
          const mod = await server.ssrLoadModule(`./api/${path.slice('/api/'.length)}.js`)
          await mod.default(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiRoutes()],
})
