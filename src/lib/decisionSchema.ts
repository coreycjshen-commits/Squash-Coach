import { z } from 'zod'
import { SESSION_TYPES } from './planSchema.js'

export const DECISIONS = ['keep', 'scale_down', 'scale_up', 'change_modality', 'rest'] as const

export const AdjustedSessionSchema = z.object({
  type: z.enum(SESSION_TYPES),
  focus: z.string().min(1),
  duration_min: z.number().int().min(0).max(300),
  target_rpe: z.number().int().min(1).max(10),
  detail: z.record(z.string(), z.unknown()).default({}),
})
export type AdjustedSession = z.infer<typeof AdjustedSessionSchema>

export const DecisionSchema = z.object({
  decision: z.enum(DECISIONS),
  rationale: z.string().min(1),
  adjusted_session: AdjustedSessionSchema.nullable().optional(),
})
export type Decision = z.infer<typeof DecisionSchema>
