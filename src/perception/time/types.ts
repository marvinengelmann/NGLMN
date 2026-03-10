import * as z from "zod"

export const TemporalLandmark = z.object({
  description: z.string(),
  timestamp: z.string(),
  emotionalSignificance: z.number().min(0).max(1)
})
export type TemporalLandmark = z.infer<typeof TemporalLandmark>

export const SubjectiveTimeState = z.object({
  dilation: z.number().min(-1).max(1),
  waitingPerception: z.number().min(0).max(1),
  temporalLandmarks: z.array(TemporalLandmark),
  subjectiveElapsedFeeling: z.string()
})
export type SubjectiveTimeState = z.infer<typeof SubjectiveTimeState>

export const DEFAULT_SUBJECTIVE_TIME_STATE: SubjectiveTimeState = {
  dilation: 0,
  waitingPerception: 0,
  temporalLandmarks: [],
  subjectiveElapsedFeeling: "normal"
}
