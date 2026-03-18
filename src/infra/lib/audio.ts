import { unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Convert MP3 audio buffer to OGG/OPUS format for Telegram voice messages.
 * Uses ffmpeg via Bun.spawn with stdin/stdout piping.
 */
export async function convertMp3ToOggOpus(mp3Buffer: Buffer): Promise<Buffer> {
  return runFfmpeg(["-i", "pipe:0", "-c:a", "libopus", "-b:a", "48k", "-f", "ogg", "pipe:1"], mp3Buffer)
}

/**
 * Get the duration of an audio buffer in milliseconds using ffprobe.
 * @param audioBuffer - Any audio format buffer that ffprobe can read.
 * @returns Duration in milliseconds.
 */
export async function getAudioDurationMs(audioBuffer: Buffer): Promise<number> {
  const tmpPath = join(tmpdir(), `anima-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)
  await Bun.write(tmpPath, audioBuffer)

  try {
    const proc = Bun.spawn(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", tmpPath], {
      stdout: "pipe",
      stderr: "pipe"
    })

    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`ffprobe failed (exit ${exitCode}): ${stderr.slice(0, 500)}`)
    }

    const parsed = JSON.parse(stdout) as { format: { duration: string } }
    return Math.round(Number.parseFloat(parsed.format.duration) * 1000)
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}

interface SegmentTiming {
  buffer: Buffer
  offsetMs: number
}

/**
 * Mix voice segments over a background sound track with automatic ducking.
 * Voice segments are placed at their specified offsets using ffmpeg adelay filters.
 * Background volume is reduced globally to let speech sit on top clearly.
 *
 * @param background - MP3 buffer of the background sound/ambience.
 * @param segments - Voice segment buffers with their offset positions in ms.
 * @param backgroundVolume - Volume multiplier for background (0–1, e.g. 0.25).
 * @returns Mixed MP3 buffer.
 */
export async function mixVoiceWithBackground(
  background: Buffer,
  segments: SegmentTiming[],
  backgroundVolume: number
): Promise<Buffer> {
  const tmpDir = tmpdir()
  const id = `anima-mix-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const bgPath = join(tmpDir, `${id}-bg.mp3`)
  const segPaths: string[] = []

  await Bun.write(bgPath, background)

  for (const [i, segment] of segments.entries()) {
    const segPath = join(tmpDir, `${id}-seg${i}.mp3`)
    await Bun.write(segPath, segment.buffer)
    segPaths.push(segPath)
  }

  try {
    const inputs = ["-i", bgPath, ...segPaths.flatMap((p) => ["-i", p])]
    const totalInputs = 1 + segments.length

    const filterParts: string[] = [`[0]volume=${backgroundVolume}[bg]`]

    for (const [i, segment] of segments.entries()) {
      const delayMs = Math.round(segment.offsetMs)
      filterParts.push(`[${i + 1}]adelay=${delayMs}|${delayMs}[s${i}]`)
    }

    const mixInputs = ["[bg]", ...segments.map((_, i) => `[s${i}]`)].join("")
    filterParts.push(`${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0`)

    const filterComplex = filterParts.join(";")

    return runFfmpeg([...inputs, "-filter_complex", filterComplex, "-f", "mp3", "pipe:1"])
  } finally {
    const allPaths = [bgPath, ...segPaths]
    await Promise.all(allPaths.map((p) => unlink(p).catch(() => {})))
  }
}

async function runFfmpeg(args: string[], stdin?: Buffer): Promise<Buffer> {
  const proc = Bun.spawn(["ffmpeg", "-y", ...args], {
    stdin: stdin ? new Blob([stdin]) : undefined,
    stdout: "pipe",
    stderr: "pipe"
  })

  const output = await new Response(proc.stdout).arrayBuffer()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`ffmpeg failed (exit ${exitCode}): ${stderr.slice(0, 500)}`)
  }

  return Buffer.from(output)
}
