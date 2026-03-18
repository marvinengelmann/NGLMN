import { generateSoundEffect, textToSpeech } from "@/infra/integrations/elevenlabs.ts"
import { convertMp3ToOggOpus, getAudioDurationMs, mixVoiceWithBackground } from "@/infra/lib/audio.ts"
import { log } from "@/infra/lib/logger.ts"
import { getGenesisVoiceId } from "@/self/genesis/state.ts"

const PADDING_RATIO = 0.08
const MAX_SOUND_DURATION_SECONDS = 22
const MIN_GAP_MS = 800

interface AmbientVoiceResult {
  oggBuffer: Buffer
  durationMs: number
}

/**
 * Build a voice message with ambient background sound.
 * Generates a sound effect from the prompt, synthesizes each voice segment via TTS,
 * distributes segments evenly across the background duration, mixes everything,
 * and returns the final OGG/Opus buffer ready for Telegram.
 *
 * @param voiceSegments - Array of text segments to speak (distributed over the background).
 * @param backgroundPrompt - Natural language description for the sound effect generator.
 * @param backgroundVolume - Volume of the background relative to voice (0–1).
 * @returns OGG/Opus buffer and total duration.
 */
export async function buildAmbientVoiceMessage(
  voiceSegments: string[],
  backgroundPrompt: string,
  backgroundVolume: number
): Promise<AmbientVoiceResult> {
  const voiceId = await getGenesisVoiceId()

  const [backgroundMp3, segmentMp3s] = await Promise.all([
    generateSoundEffect(backgroundPrompt, MAX_SOUND_DURATION_SECONDS),
    Promise.all(voiceSegments.map((segment) => textToSpeech(segment, voiceId)))
  ])

  const [bgDurationMs, ...segDurations] = await Promise.all([
    getAudioDurationMs(backgroundMp3),
    ...segmentMp3s.map((buf) => getAudioDurationMs(buf))
  ])

  const timings = computeSegmentTimings(bgDurationMs, segDurations)

  log.info("Ambient voice mixing", {
    bgDurationMs,
    segments: voiceSegments.length,
    segDurations,
    offsets: timings
  })

  const segments = segmentMp3s.map((buffer, i) => ({
    buffer,
    offsetMs: timings[i] ?? 0
  }))

  const mixedMp3 = await mixVoiceWithBackground(backgroundMp3, segments, backgroundVolume)
  const oggBuffer = await convertMp3ToOggOpus(mixedMp3)

  return { oggBuffer, durationMs: bgDurationMs }
}

/**
 * Distribute voice segments evenly across a background track duration.
 * Adds padding at the start and end so the background is audible before
 * the first word and after the last, creating a natural "entering the scene" feel.
 *
 * @param bgDurationMs - Total background duration in milliseconds.
 * @param segmentDurations - Duration of each voice segment in milliseconds.
 * @returns Array of offset positions (ms) for each segment.
 */
export function computeSegmentTimings(bgDurationMs: number, segmentDurations: number[]): number[] {
  if (segmentDurations.length === 0) return []

  const totalVoiceMs = segmentDurations.reduce((sum, d) => sum + d, 0)
  const padding = bgDurationMs * PADDING_RATIO
  const usableMs = bgDurationMs - padding * 2

  if (totalVoiceMs >= usableMs) {
    let cursor = padding
    return segmentDurations.map((duration) => {
      const offset = cursor
      cursor += duration + MIN_GAP_MS
      return offset
    })
  }

  const gapCount = segmentDurations.length + 1
  const totalGapMs = usableMs - totalVoiceMs
  const gapMs = Math.max(MIN_GAP_MS, totalGapMs / gapCount)

  let cursor = padding + gapMs
  return segmentDurations.map((duration) => {
    const offset = cursor
    cursor += duration + gapMs
    return offset
  })
}
