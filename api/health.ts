export const config = { runtime: 'edge' }

export default function handler() {
  return new Response(JSON.stringify({ ok: true, phase: 0 }), {
    headers: { 'content-type': 'application/json' },
  })
}
