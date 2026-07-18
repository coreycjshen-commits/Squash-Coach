// TEMPORARY diagnostic endpoint — reports which import/module fails to load on Vercel.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const steps: Record<string, string> = {}
  steps.node = process.version
  const tryImport = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      steps[name] = 'ok'
    } catch (e) {
      steps[name] = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    }
  }
  await tryImport('supabase-js', () => import('@supabase/supabase-js'))
  await tryImport('zod', () => import('zod'))
  await tryImport('src/planSchema', () => import('../src/lib/planSchema.js'))
  await tryImport('src/template', () => import('../src/lib/template.js'))
  await tryImport('src/macrocycle', () => import('../src/lib/macrocycle.js'))
  await tryImport('src/week', () => import('../src/lib/week.js'))
  await tryImport('src/dates', () => import('../src/lib/dates.js'))
  await tryImport('_lib/prompt', () => import('./_lib/prompt.js'))
  await tryImport('_lib/groq', () => import('./_lib/groq.js'))
  await tryImport('_lib/supabaseServer', () => import('./_lib/supabaseServer.js'))
  res.status(200).json(steps)
}
