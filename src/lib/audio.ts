/**
 * Convert MP3 audio buffer to OGG/OPUS format for Telegram voice messages.
 * Uses ffmpeg via Bun.spawn with stdin/stdout piping.
 */
export async function convertMp3ToOggOpus(mp3Buffer: Buffer): Promise<Buffer> {
  const proc = Bun.spawn(["ffmpeg", "-i", "pipe:0", "-c:a", "libopus", "-b:a", "48k", "-f", "ogg", "pipe:1"], {
    stdin: new Blob([mp3Buffer]),
    stdout: "pipe",
    stderr: "pipe"
  })

  const output = await new Response(proc.stdout).arrayBuffer()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`ffmpeg conversion failed (exit ${exitCode}): ${stderr.slice(0, 500)}`)
  }

  return Buffer.from(output)
}
