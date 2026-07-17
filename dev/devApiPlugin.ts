import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

/**
 * Dev-only plugin: serves the Vercel-style `/api/*.ts` handlers directly from the Vite dev
 * server, so `npm run dev` exercises the real serverless handlers with no Vercel CLI/login.
 * Production is unaffected — Vercel runs the same files from `api/` on deploy.
 *
 * A request to `POST /api/foo` loads `api/foo.ts` through Vite's SSR pipeline (full TS + deps)
 * and invokes its default export with Node req/res shimmed to the VercelRequest/Response shape.
 */
export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      loadDotEnvLocal(server.config.root)

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()

        const path = url.split('?')[0].replace(/\/$/, '')
        const modPath = resolve(server.config.root, `.${path}.ts`)

        // Shim the Vercel response helpers onto the Node ServerResponse.
        const vres = res as ServerResponse & {
          status: (code: number) => typeof vres
          json: (body: unknown) => void
        }
        vres.status = (code: number) => {
          res.statusCode = code
          return vres
        }
        vres.json = (body: unknown) => {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }

        try {
          const body = await readBody(req)
          const vreq = Object.assign(req, { body }) as IncomingMessage & { body: unknown }
          const mod = await server.ssrLoadModule(modPath)
          const handler = mod.default as (rq: unknown, rs: unknown) => unknown
          if (typeof handler !== 'function') {
            vres.status(404).json({ error: `No handler at ${path}` })
            return
          }
          await handler(vreq, vres)
        } catch (e) {
          // Surface the real error to the browser console/network tab during dev.
          server.config.logger.error(`[dev-api] ${path} failed: ${String(e)}`)
          if (!res.writableEnded) vres.status(500).json({ error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}

/** Read all env vars from .env.local into process.env (server-side keys like GROQ_API_KEY). */
function loadDotEnvLocal(root: string) {
  try {
    const text = readFileSync(resolve(root, '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
    }
  } catch {
    // no .env.local — handlers will report missing keys themselves
  }
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      if (!data) return resolvePromise({})
      try {
        resolvePromise(JSON.parse(data))
      } catch {
        resolvePromise({})
      }
    })
    req.on('error', () => resolvePromise({}))
  })
}
