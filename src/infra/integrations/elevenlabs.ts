import { ElevenLabsClient } from "elevenlabs"
import type { VoicePreviewResponseModel } from "elevenlabs/api"
import { env } from "@/infra/config/env.ts"

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
 * @param voiceId - Optional voice ID override (falls back to ELEVENLABS_VOICE_ID env var).
 * @returns MP3 audio buffer.
 */
export async function textToSpeech(voiceText: string, voiceId?: string): Promise<Buffer> {
  const resolvedVoiceId = voiceId ?? env().ELEVENLABS_VOICE_ID

  const stream = await getClient().textToSpeech.convert(resolvedVoiceId, {
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
 * Design a voice from a text description, returning preview candidates.
 * @param description - Natural language voice description for ElevenLabs.
 * @param seed - Numeric seed for deterministic voice generation.
 * @returns Array of voice previews with generated_voice_id and audio.
 */
export async function designVoice(description: string, seed: number): Promise<VoicePreviewResponseModel[]> {
  const response = await getClient().textToVoice.createPreviews({
    voice_description: description,
    auto_generate_text: true,
    seed
  })
  return response.previews
}

/**
 * Save a designed voice preview as a permanent voice in the ElevenLabs library.
 * @param name - Display name for the saved voice.
 * @param description - Voice description metadata.
 * @param generatedVoiceId - The generated_voice_id from a design preview.
 * @returns The permanent voice_id string.
 */
export async function saveVoice(name: string, description: string, generatedVoiceId: string): Promise<string> {
  const voice = await getClient().textToVoice.createVoiceFromPreview({
    voice_name: name,
    voice_description: description,
    generated_voice_id: generatedVoiceId
  })
  return voice.voice_id
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
