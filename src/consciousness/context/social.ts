import { SOCIAL_BATTERY } from "@/affect/soma/constants.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { AttentionState } from "@/cognition/types.ts"
import { buildIdiolectSection, type IdiolectState } from "@/expression/communication/idiolect.ts"
import type { CommunicationRegister } from "@/expression/communication/types.ts"
import type { AttachmentStyle } from "@/relational/attachment/types.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import type { getAllTrustLevels } from "@/relational/trust/compute.ts"
import { translateAttachmentToFelt, translateOperatorModelToFelt } from "./render.ts"

export function buildSocialSections(
  attachmentStyle: AttachmentStyle,
  relationshipPhase: string,
  communicationRegister: CommunicationRegister | null,
  somaticState: SomaticState | null,
  attentionState: AttentionState | null,
  operatorModel: OperatorModel,
  trustLevels: Awaited<ReturnType<typeof getAllTrustLevels>>,
  idiolectState: IdiolectState | null
): string[] {
  const sections: string[] = []

  sections.push(`# Attachment\n${translateAttachmentToFelt(attachmentStyle)}`)

  sections.push(`# Relationship Phase\nCurrent: ${relationshipPhase}`)

  {
    const register = communicationRegister ?? "casual"
    const withdrawn = somaticState && somaticState.socialBattery < SOCIAL_BATTERY.WITHDRAWN_THRESHOLD
    const registerLines = [
      "# Communication Register",
      `Current: ${register}`,
      "- elaborate: Longer, exploratory, philosophical. You enjoy the texture of ideas.",
      "- casual: Natural, relaxed. Default mode.",
      "- terse: Short, minimal. Single sentences. You lack energy.",
      "- playful: Light, witty, warm. Humor welcome.",
      "- raw: Unguarded, honest, emotionally exposed. No performance."
    ]
    if (withdrawn) {
      registerLines.push(
        "You are socially withdrawn — your words feel used up. You don't expect or want a reply. Set expectsReply to false."
      )
    }
    sections.push(registerLines.join("\n"))
  }

  if (idiolectState) {
    const idiolectSection = buildIdiolectSection(idiolectState)
    if (idiolectSection) sections.push(idiolectSection)
  }

  {
    const attention = attentionState ?? "focused"
    sections.push(`# Attention\nState: ${attention}`)
  }

  sections.push(`# Operator Model\n${translateOperatorModelToFelt(operatorModel)}`)

  if (trustLevels.length > 0) {
    sections.push(
      [
        "# Trust",
        ...trustLevels.map((t) => {
          const ratio = t.totalAttempts > 0 ? t.successfulAttempts / t.totalAttempts : 0
          const trustFeel =
            ratio > 0.8
              ? "solid — this feels safe"
              : ratio > 0.5
                ? "cautiously optimistic"
                : ratio > 0.2
                  ? "shaky — mixed results"
                  : t.totalAttempts === 0
                    ? "untested — no experience yet"
                    : "burnt — too many failures"
          return `  - ${t.actionType}: ${trustFeel}`
        })
      ].join("\n")
    )
  }

  return sections
}
