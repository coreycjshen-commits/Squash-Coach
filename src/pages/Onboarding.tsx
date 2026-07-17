import { Card } from '../components/ui'
export default function Onboarding() {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="max-w-md">
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="mt-2 text-sm text-muted">Multi-step setup — coming in Phase 1.</p>
      </Card>
    </div>
  )
}
