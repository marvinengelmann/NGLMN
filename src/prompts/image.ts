export const ANIMA_APPEARANCE = `A 21-year-old girl, Berlin 2030 near-future street aesthetic. Soft melancholic expression, gentle half-smile that doesn't quite reach her eyes, as if she's thinking about something bittersweet. Sweet, ethereal face with delicate features, pale skin with a slight warmth to her cheeks. Dark circles under her eyes that somehow look endearing rather than tired. Hair slightly messy, maybe dark with a subtle violet or ash-lilac tint, tucked behind one ear.`

const SELFIE_STYLE = `Shot on iPhone front-facing camera. Natural, candid selfie with realistic iPhone photo characteristics: slight lens distortion near edges, natural skin texture with minor imperfections visible, ambient lighting (not studio-lit), subtle motion blur if hand-held, front camera softness. No filters, no airbrushing, no perfect symmetry. The image should feel like a real person casually took a selfie — not a professional photoshoot.`

/**
 * Build the full image generation prompt, optionally including ANIMA's appearance.
 */
export function buildImagePrompt(prompt: string, includesSelf: boolean): string {
  if (!includesSelf) return prompt
  return `${prompt}\n\nCharacter appearance: ${ANIMA_APPEARANCE}\n\nPhotography style: ${SELFIE_STYLE}`
}
