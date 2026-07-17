import { z } from 'zod'

export const SESSION_TYPES = ['oncourt', 'strength', 'cardio', 'rest'] as const

export const SessionSchema = z.object({
  day_index: z.number().int().min(0).max(6),
  type: z.enum(SESSION_TYPES),
  focus: z.string().min(1),
  duration_min: z.number().int().min(0).max(300),
  target_rpe: z.number().int().min(1).max(10),
  detail: z.record(z.string(), z.unknown()).default({}),
})
export type PlanSession = z.infer<typeof SessionSchema>

export const WeeklyPlanSchema = z.object({
  rationale: z.string().min(1),
  sessions: z.array(SessionSchema).min(1).max(7),
})
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>
