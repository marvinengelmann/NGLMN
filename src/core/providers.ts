import { blackForestLabs } from "@ai-sdk/black-forest-labs"
import { xai } from "@ai-sdk/xai"

export const FAST = xai("grok-4-1-fast-non-reasoning")
export const REASONING = xai("grok-4-1-fast-reasoning")
export const VISION = xai("grok-2-vision-latest")
export const IMAGE = blackForestLabs.image("flux-2-max")
