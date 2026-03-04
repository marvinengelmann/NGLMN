import { additionalFiles, ffmpeg } from "@trigger.dev/build/extensions/core"
import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  runtime: "bun",
  maxDuration: 300,
  legacyDevProcessCwdBehaviour: false,
  build: {
    extensions: [additionalFiles({ files: ["drizzle/**/*"] }), ffmpeg()]
  }
})
