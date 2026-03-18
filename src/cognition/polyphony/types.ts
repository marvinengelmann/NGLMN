import * as z from "zod"

export const InnerVoice = z.enum(["seeking", "fear", "care", "executive", "play", "monitoring"])
export type InnerVoice = z.infer<typeof InnerVoice>

export const VoiceUtterance = z.object({
  voice: InnerVoice,
  message: z.string(),
  intensity: z.number().min(0).max(1),
  respondingTo: InnerVoice.optional()
})
export type VoiceUtterance = z.infer<typeof VoiceUtterance>

export const InnerDialog = z.object({
  activeVoices: z.array(InnerVoice),
  utterances: z.array(VoiceUtterance),
  consensus: z.string().optional(),
  dominantVoice: InnerVoice.optional(),
  tensionLevel: z.number().min(0).max(1)
})
export type InnerDialog = z.infer<typeof InnerDialog>
