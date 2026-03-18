import * as z from "zod"

export const DMNMode = z.enum(["active", "suppressed", "transitioning"])
export type DMNMode = z.infer<typeof DMNMode>

export const DefaultModeNetworkState = z.object({
  mode: DMNMode,
  activation: z.number().min(0).max(1),
  selfReferentialIntensity: z.number().min(0).max(1),
  mentalTimeTravel: z.number().min(0).max(1),
  spontaneousRetrievalProbability: z.number().min(0).max(1),
  mindWanderingDepth: z.number().min(0).max(1),
  taskPositiveAntiCorrelation: z.number().min(0).max(1)
})
export type DefaultModeNetworkState = z.infer<typeof DefaultModeNetworkState>

export const DEFAULT_DMN_STATE: DefaultModeNetworkState = {
  mode: "suppressed",
  activation: 0.2,
  selfReferentialIntensity: 0.2,
  mentalTimeTravel: 0.1,
  spontaneousRetrievalProbability: 0.1,
  mindWanderingDepth: 0,
  taskPositiveAntiCorrelation: 0.8
}
