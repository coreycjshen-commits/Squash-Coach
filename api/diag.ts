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
  await tryImport('src/planSchema', () => import('../src/lib/planSchema'))
  await tryImport('src/template', () => import('../src/lib/template'))
  await tryImport('src/macrocycle', () => import('../src/lib/macrocycle'))
  await tryImport('src/week', () => import('../src/lib/week'))
  await tryImport('src/dates', () => import('../src/lib/dates'))
  await tryImport('_lib/prompt', () => import('./_lib/prompt'))
  await tryImport('_lib/groq', () => import('./_lib/groq'))
  await tryImport('_lib/supabaseServer', () => import('./_lib/supabaseServer'))
  res.status(200).json(steps)
}
