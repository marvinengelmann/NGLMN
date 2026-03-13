import { config } from "dotenv"

const envFile = process.env.DOTENV ?? ".env.local"
config({ path: envFile, override: true })
