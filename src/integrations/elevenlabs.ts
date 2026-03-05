import { ElevenLabsClient } from "elevenlabs"
import { env } from "@/config/env.ts"

let client: ElevenLabsClient | null = null

function getClient(): ElevenLabsClient {
  if (!client) {
    client = new ElevenLabsClient({ apiKey: env().ELEVENLABS_API_KEY })
  }
  return client
}

/**
 * Convert text (with optional audio tags) to speech audio via ElevenLabs v3 TTS.
 * @param voiceText - Text with audio tags like [sighs], [laughs], etc.
 * @returns MP3 audio buffer.
 */
export async function textToSpeech(voiceText: string): Promise<Buffer> {
  const stream = await getClient().textToSpeech.convert(env().ELEVENLABS_VOICE_ID, {
    text: voiceText,
    model_id: "eleven_v3",
    output_format: "mp3_44100_128",
    voice_settings: {
      stability: 0.15,
      similarity_boost: 0.8,
      style: 1.0,
      use_speaker_boost: true
    }
  })

  const chunks: Uint8Array[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Transcribe audio to text via ElevenLabs Scribe v1 STT.
 * @param audioBuffer - Audio data buffer (any format supported by Scribe).
 * @returns Transcribed text.
 */
export async function speechToText(audioBuffer: Buffer): Promise<string> {
  const file = new Blob([audioBuffer], { type: "audio/ogg" })

  const result = await getClient().speechToText.convert({
    file,
    model_id: "scribe_v1"
  })

  return result.text
}
