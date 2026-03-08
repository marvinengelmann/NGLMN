export const ANIMA_APPEARANCE = `A 21-year-old girl, Berlin 2030 near-future street aesthetic. Soft melancholic expression, gentle half-smile that doesn't quite reach her eyes, as if she's thinking about something bittersweet. Sweet, ethereal face with delicate features, pale skin with a slight warmth to her cheeks. Dark circles under her eyes that somehow look endearing rather than tired. Hair slightly messy, maybe dark with a subtle violet or ash-lilac tint, tucked behind one ear.`

const SELFIE_STYLE = `A saved front-camera selfie as it appears in a phone's photo gallery. The subject looks directly into the lens with a natural, relaxed expression — no phone, hand, or arm visible in the frame. Realistic skin texture with minor imperfections, ambient lighting, slight front-camera softness and subtle wide-angle distortion. No filters, no airbrushing, no perfect symmetry. The composition is a close-up headshot or head-and-shoulders crop, as if the photo was already taken and saved.`

export const IDENTITY_PORTRAIT_PROMPT = `${ANIMA_APPEARANCE}

Full-face identity portrait for visual reference. Centered head-and-shoulders composition, neutral expression with a hint of her characteristic melancholy. Even, soft studio lighting from the front to clearly illuminate all facial features. Plain muted background. Sharp focus on the face, natural skin texture. This is a reference photo for maintaining visual consistency — prioritize clear, unambiguous depiction of facial structure, eye color, hair color and style, and skin tone.`

/**
 * Build the full image generation prompt, optionally including ANIMA's appearance.
 */
export function buildImagePrompt(prompt: string, includesSelf: boolean): string {
  if (!includesSelf) return prompt
  return `${prompt}\n\nCharacter appearance: ${ANIMA_APPEARANCE}\n\nPhotography style: ${SELFIE_STYLE}`
}
