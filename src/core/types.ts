import * as z from "zod"

export const BudgetState = z.object({
  consumedToday: z.coerce.number(),
  dailyLimit: z.coerce.number(),
  remainingToday: z.coerce.number()
})
export type BudgetState = z.infer<typeof BudgetState>

export const TextOutput = z.object({ text: z.string() })
export type TextOutput = z.infer<typeof TextOutput>

export const BooleanOutput = z.object({ result: z.boolean() })
export type BooleanOutput = z.infer<typeof BooleanOutput>
