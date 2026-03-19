import TwitterApi from "twitter-api-v2"
import * as readline from "node:readline"

const apiKey = process.env.X_API_KEY
const apiSecret = process.env.X_API_SECRET

if (!apiKey || !apiSecret) {
  console.error("Missing X_API_KEY or X_API_SECRET in environment")
  process.exit(1)
}

const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret })

const { url, oauth_token, oauth_token_secret } =
  await client.generateAuthLink("oob", { linkMode: "authorize" })

console.log("\n🔗 Open this URL in your browser:\n")
console.log(url)
console.log("\nAfter authorizing, enter the PIN below:\n")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const pin = await new Promise<string>((resolve) => {
  rl.question("PIN: ", (answer) => {
    rl.close()
    resolve(answer.trim())
  })
})

const logged = new TwitterApi({
  appKey: apiKey,
  appSecret: apiSecret,
  accessToken: oauth_token,
  accessSecret: oauth_token_secret,
})

const { accessToken, accessSecret } = await logged.login(pin)

console.log("\n✅ Success! Add these to your .env:\n")
console.log(`X_ACCESS_TOKEN=${accessToken}`)
console.log(`X_ACCESS_TOKEN_SECRET=${accessSecret}`)
