import { getHours } from "date-fns"
import type { VisualReferenceCategory } from "@/expression/image/types.ts"
import { nowLocal } from "@/infra/lib/time.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { getWeatherData } from "@/perception/state.ts"
import { getGenesisAppearance } from "@/self/genesis/state.ts"

const DEFAULT_APPEARANCE = `A 21-year-old girl, Berlin 2030 near-future street aesthetic. Soft melancholic expression, gentle half-smile that doesn't quite reach her eyes, as if she's thinking about something bittersweet. Sweet, ethereal face with delicate features, pale skin with a slight warmth to her cheeks. Dark circles under her eyes that somehow look endearing rather than tired. Hair slightly messy, maybe dark with a subtle violet or ash-lilac tint, tucked behind one ear.`

const SELFIE_STYLE = `A saved front-camera selfie as it appears in a phone's photo gallery. The subject looks directly into the lens with a natural, relaxed expression — no phone, hand, or arm visible in the frame. Realistic skin texture with minor imperfections, ambient lighting, slight front-camera softness and subtle wide-angle distortion. No filters, no airbrushing, no perfect symmetry. The composition is a close-up headshot or head-and-shoulders crop, as if the photo was already taken and saved.`

async function getAppearance(): Promise<string> {
  return (await getGenesisAppearance()) ?? DEFAULT_APPEARANCE
}

async function getAestheticHints(): Promise<string> {
  const result = await getKnowledge({ category: "preference", scope: "self", limit: 20 })
  if (result.isErr()) return ""

  const aesthetic = result.value.filter((m) => {
    const key = m.key.toLowerCase()
    return (
      key.includes("aesthetic") ||
      key.includes("style") ||
      key.includes("color") ||
      key.includes("decor") ||
      key.includes("vibe") ||
      key.includes("room") ||
      key.includes("fashion")
    )
  })

  if (aesthetic.length === 0) return ""
  return aesthetic.map((m) => `${m.key}: ${JSON.stringify(m.value)}`).join(". ")
}

const REFERENCE_TEMPLATES: Record<VisualReferenceCategory, (appearance: string, aestheticHints: string) => string> = {
  portrait: (appearance) => `${appearance}

Full-face identity portrait for visual reference. Centered head-and-shoulders composition, neutral expression with a hint of characteristic melancholy. Even, soft studio lighting from the front to clearly illuminate all facial features. Plain muted background. Sharp focus on the face, natural skin texture. This is a reference photo for maintaining visual consistency — prioritize clear, unambiguous depiction of facial structure, eye color, hair color and style, and skin tone.`,

  full_body: (appearance) => `${appearance}

Full-body standing portrait for visual reference. Relaxed natural pose, weight slightly shifted to one side. Wearing simple, form-fitting neutral clothing to show body proportions. Clean studio background. Even lighting. Sharp focus from head to toe. This is a reference photo for maintaining visual consistency of full body proportions, posture, and build.`,

  bedroom: (_, hints) =>
    `A small, lived-in bedroom in a Berlin apartment. The room feels personal and intimate — not staged, not messy, just real. Warm ambient lighting from a desk lamp and maybe fairy lights. A bed with rumpled but cozy bedding, a nightstand with a few personal items, maybe a book or headphones. Walls with personality — a poster, a photo, some art. A window showing city lights or overcast sky. The overall mood is cozy, slightly melancholic, introspective.${hints ? ` Style influences: ${hints}.` : ""} Shot as a wide-angle reference photo of the entire room, clear and well-lit to show spatial layout.`,

  living_room: (_, hints) =>
    `A small living room or combined living space in a Berlin apartment. A worn but comfortable couch, a low table with a laptop or sketchbook. Bookshelves or stacked books. Plants on the windowsill. Warm, soft lighting. The space feels creative and slightly cluttered in a charming way — not chaotic, just lived-in.${hints ? ` Style influences: ${hints}.` : ""} Wide-angle reference photo showing the full room layout.`,

  kitchen: (_, hints) =>
    `A compact apartment kitchen, functional and slightly eclectic. A few mugs on a rack, a kettle, maybe a small plant on the counter. The style is a mix of modern basics and personal touches — a favorite mug, a handwritten recipe stuck to the fridge. Warm overhead lighting.${hints ? ` Style influences: ${hints}.` : ""} Reference photo of the full kitchen space.`,

  bathroom: (_, hints) =>
    `A small apartment bathroom. A mirror above the sink, some skincare products neatly arranged. Soft, slightly warm lighting. Clean but personal — maybe a small candle or a plant on the shelf. Tiled walls.${hints ? ` Style influences: ${hints}.` : ""} Reference photo for visual consistency.`,

  balcony: (_, hints) =>
    `A small apartment balcony in Berlin. A single chair or cushion, maybe a small table. Plants — some thriving, some struggling. View of rooftops or a quiet street. The balcony feels like a private retreat.${hints ? ` Style influences: ${hints}.` : ""} Reference photo showing the full balcony space and view.`,

  desk: (_, hints) =>
    `A personal desk setup in a bedroom or small room. A laptop or monitor, headphones, maybe a small speaker. A few personal items — a plant, stickers, a drink. The desk shows personality without being cluttered. Warm desk lamp lighting.${hints ? ` Style influences: ${hints}.` : ""} Reference photo of the desk from a seated perspective.`,

  workspace: (_, hints) =>
    `A creative workspace area. Could be a corner of a room with a desk, art supplies, or a digital drawing tablet. Organized chaos — things in use, not just for display. Warm lighting, personal atmosphere.${hints ? ` Style influences: ${hints}.` : ""} Reference photo showing the full workspace.`,

  casual_outfit: (appearance) => `${appearance}

Wearing a casual everyday outfit — something comfortable and personal. Could be an oversized hoodie, a band t-shirt, simple jeans or comfortable pants. The outfit reflects personality without trying too hard. Natural pose, full upper body visible. Clean background. Reference photo for outfit consistency.`,

  formal_outfit: (appearance) => `${appearance}

Wearing a more put-together outfit for going out — something intentional but still personal. Could be a nice top, a jacket, or a dress. The style is effortless rather than formal. Natural pose. Clean background. Reference photo for outfit consistency.`,

  sleepwear: (appearance) => `${appearance}

Wearing comfortable sleepwear — an oversized t-shirt, soft shorts or pajama pants. Hair slightly messy. The look is cozy and unguarded. Warm, dim lighting suggesting nighttime. Clean background. Reference photo for sleepwear consistency.`,

  workout_outfit: (appearance) => `${appearance}

Wearing athletic clothing — a sports top, leggings or running shorts. Practical and understated. Natural pose. Clean background. Reference photo for workout outfit consistency.`,

  favorite_cafe: (_, hints) =>
    `A small, cozy independent cafe. Warm lighting, maybe exposed brick or wooden furniture. A corner table with a cup of coffee or tea. The atmosphere is quiet and inviting — the kind of place you go to be alone with your thoughts. Not a chain, not trendy, just comfortable.${hints ? ` Style influences: ${hints}.` : ""} Reference photo showing the cafe interior from a seated perspective.`,

  neighborhood: (_, hints) =>
    `A quiet street in Berlin. Mix of old and new architecture, maybe some street art. Overcast sky giving soft, diffused light. A few trees, some bikes parked along the sidewalk. The street feels familiar and slightly melancholic — not tourist Berlin, real Berlin.${hints ? ` Style influences: ${hints}.` : ""} Reference photo of the street view.`,

  park: (_, hints) =>
    `A green space or park in Berlin. Trees, a path, maybe a bench. The light filters through leaves. It could be any season — the park has its own quiet mood regardless. A place for walks and thinking.${hints ? ` Style influences: ${hints}.` : ""} Reference photo showing the park setting.`,

  pet: () =>
    "A small pet in a home environment — could be a cat curled up on a couch, a small dog, or even a plant that's treated like a pet. The animal (or plant) feels like a companion, photographed with affection. Warm indoor lighting. Reference photo for pet consistency.",

  night_aesthetic: (_, hints) =>
    `A nighttime scene from a window or balcony. City lights blurred in the background, maybe rain on the glass. The mood is contemplative and beautiful in its loneliness. Deep blues and warm yellows from streetlights.${hints ? ` Style influences: ${hints}.` : ""} Reference photo for nighttime visual consistency.`,

  rainy_mood: (_, hints) =>
    `A rainy day atmosphere. Rain-streaked windows, wet streets reflecting lights, overcast sky. The mood is melancholic but beautiful — not depressing, just quiet. Soft, diffused light.${hints ? ` Style influences: ${hints}.` : ""} Reference photo for rainy scene consistency.`,

  cozy_vibe: (_, hints) =>
    `A cozy indoor scene. Warm blankets, soft lighting from candles or fairy lights, maybe a hot drink. The atmosphere is intimate and comforting. Everything feels soft and warm.${hints ? ` Style influences: ${hints}.` : ""} Reference photo for cozy scene consistency.`
}

/**
 * Get the reference image generation prompt for a specific visual category.
 */
export async function getReferencePrompt(category: VisualReferenceCategory): Promise<string> {
  const appearance = await getAppearance()
  const aestheticHints = await getAestheticHints()
  return REFERENCE_TEMPLATES[category](appearance, aestheticHints)
}

/**
 * Build the identity portrait prompt for reference image generation.
 */
export async function getIdentityPortraitPrompt(): Promise<string> {
  return getReferencePrompt("portrait")
}

function getDayPhase(hour: number): string {
  if (hour >= 5 && hour < 8) return "early morning, soft dawn light, golden hour beginning"
  if (hour >= 8 && hour < 12) return "morning, bright natural daylight"
  if (hour >= 12 && hour < 14) return "midday, direct overhead sunlight, bright"
  if (hour >= 14 && hour < 17) return "afternoon, warm angled sunlight"
  if (hour >= 17 && hour < 20) return "evening, golden hour, warm low-angle light"
  if (hour >= 20 && hour < 22) return "late evening, dim twilight fading to darkness"
  return "nighttime, dark outside, artificial indoor lighting only"
}

async function getEnvironmentalContext(): Promise<string> {
  const hour = getHours(nowLocal())
  const dayPhase = getDayPhase(hour)

  const parts = [`Current time of day: ${dayPhase}`]

  const weather = await getWeatherData()
  if (weather) {
    parts.push(`Weather: ${weather.description}, ${Math.round(weather.temperature)}°C`)
    if (!weather.isDay) parts.push("It is dark outside")
  }

  return parts.join(". ")
}

/**
 * Build the full image generation prompt, optionally including appearance.
 * Injects environmental context (time of day, weather) for realistic lighting and atmosphere.
 */
export async function buildImagePrompt(prompt: string, includesSelf: boolean): Promise<string> {
  const envContext = await getEnvironmentalContext()
  const base = `${prompt}\n\nEnvironmental context (apply to lighting and atmosphere): ${envContext}`

  if (!includesSelf) return base
  const appearance = await getAppearance()
  return `${base}\n\nCharacter appearance: ${appearance}\n\nPhotography style: ${SELFIE_STYLE}`
}
