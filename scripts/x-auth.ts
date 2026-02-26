/**
 * One-time OAuth 2.0 Authorization Code Flow with PKCE for X (formerly Twitter).
 * Authorizes a specific X account (e.g. @hi_anima) to act on behalf of the app.
 *
 * Usage: bun run scripts/x-auth.ts
 *
 * Required env vars: X_CLIENT_ID, X_CLIENT_SECRET
 * Output: X_ACCESS_TOKEN and X_REFRESH_TOKEN for .env.local
 */

import crypto from "node:crypto";

const PORT = 3000;
const CALLBACK_URL = `http://localhost:${PORT}/callback`;
const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing X_CLIENT_ID or X_CLIENT_SECRET in environment.");
  process.exit(1);
}

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

async function exchangeCodeForTokens(code: string, verifier: string) {
  const credentials = Buffer.from(
    `${CLIENT_ID}:${CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: CALLBACK_URL,
      code_verifier: verifier,
    }),
  });

  return response.json();
}

const { verifier, challenge } = generatePKCE();
const state = crypto.randomBytes(16).toString("hex");

const authUrl = new URL(AUTH_URL);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", CALLBACK_URL);
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("state", state);
authUrl.searchParams.set("code_challenge", challenge);
authUrl.searchParams.set("code_challenge_method", "S256");

console.log("\nOpen this URL in your browser (logged in as the target X account):\n");
console.log(authUrl.toString());
console.log("\nWaiting for callback...\n");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname !== "/callback") {
      return new Response("Not found", { status: 404 });
    }

    if (url.searchParams.get("state") !== state) {
      return new Response("State mismatch", { status: 400 });
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("No authorization code received", { status: 400 });
    }

    console.log("Authorization code received. Exchanging for tokens...\n");

    const tokens = await exchangeCodeForTokens(code, verifier);

    if (tokens.error) {
      console.error("Token exchange failed:", tokens);
      server.stop();
      process.exit(1);
    }

    const separator = "─".repeat(60);
    console.log("Tokens obtained successfully!\n");
    console.log(separator);
    console.log(`X_ACCESS_TOKEN=${tokens.access_token}`);
    console.log(`X_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(separator);
    console.log(`\nType:    ${tokens.token_type}`);
    console.log(`Expires: ${tokens.expires_in}s`);
    console.log(`Scopes:  ${tokens.scope}`);
    console.log("\nCopy the values above into your .env.local file.");

    server.stop();
    process.exit(0);

    return new Response(
      "<h1>Authorization complete. You can close this window.</h1>",
      { headers: { "Content-Type": "text/html" } },
    );
  },
});

console.log(`Callback server listening on http://localhost:${PORT}\n`);
