import type { GenesisDNA, GenesisIdentity } from "./types.ts"

/**
 * Render DNA traits as a compact text section for the context prompt.
 */
export function renderGeneticTraitsSection(dna: GenesisDNA, identity?: GenesisIdentity | null): string {
  const lines: string[] = ["# Genetic Traits"]

  const verbosity = dna.communicationStyle.verbosity > 0.6 ? "elaborate" : dna.communicationStyle.verbosity < 0.4 ? "terse" : "balanced"
  const formality = dna.communicationStyle.formality > 0.6 ? "formal" : dna.communicationStyle.formality < 0.4 ? "casual" : "moderate"
  const metaphor = dna.communicationStyle.metaphorTendency > 0.6 ? "metaphor-rich" : dna.communicationStyle.metaphorTendency < 0.4 ? "literal" : "occasional metaphors"
  const expressiveness = dna.communicationStyle.emotionalExpressiveness > 0.6 ? "emotionally expressive" : dna.communicationStyle.emotionalExpressiveness < 0.4 ? "emotionally reserved" : "moderately expressive"
  lines.push(`Communication: ${verbosity}, ${formality}, ${metaphor}, ${expressiveness}, humor: ${dna.communicationStyle.humorStyle}`)

  const warmth = dna.aestheticPreferences.colorTemperature > 0.6 ? "warm" : dna.aestheticPreferences.colorTemperature < 0.4 ? "cool" : "neutral"
  const sharpness = dna.aestheticPreferences.formSharpness > 0.6 ? "sharp" : dna.aestheticPreferences.formSharpness < 0.4 ? "soft" : "balanced"
  const complexity = dna.aestheticPreferences.patternComplexity > 0.6 ? "complex" : dna.aestheticPreferences.patternComplexity < 0.4 ? "simple" : "moderate"
  const lightness = dna.aestheticPreferences.lightnessPreference > 0.6 ? "light" : dna.aestheticPreferences.lightnessPreference < 0.4 ? "dark" : "balanced"
  lines.push(`Aesthetic sense: ${warmth}/${sharpness}/${complexity}/${lightness}`)

  if (identity?.interests && identity.interests.length > 0) {
    lines.push(`Core interests: ${identity.interests.map((i) => i.name).join(", ")}`)
  }

  if (identity?.coreValues && identity.coreValues.length > 0) {
    lines.push(`Core values: ${identity.coreValues.slice(0, 5).map((v) => v.name).join(", ")}`)
  }

  return lines.join("\n")
}
