# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity powered by xAI Grok via Vercel AI Gateway. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

- **Autonomous Heartbeat** — Fixed 5-minute cron loop with four phases (SENSE → THINK → ACT → MAINTAIN)
- **Two-Tier Model Routing** — Grok Fast and Reasoning via AI Gateway
- **Three-Layer Memory** — Working (Redis), Episodic (Vector), Semantic (Postgres) with relationship graph
- **MBTI-Based Personality** — Ten-dimension two-layer model (base + adaptive) evolving through reflection
- **Simulated Emotions** — 7-dimension state vector with decay, personality-driven baselines, and metrics calibration
- **Trust System** — Fear/confidence-based autonomy across 9 action types that grows through experience
- **Passive Perception** — 6 sensor sources with pattern-based goal detection
- **Human Bridge** — Unified Telegram polling and conversation handler with boundary detection, typing simulation, afterthought messages, and multi-round follow-ups
- **X Integration** — Mention polling, trust-gated replies and proactive tweets
- **Email Communication** — Resend-based processing with trust-gated responses and Guardian validation
- **Dream Simulation** — Nightly consolidation, creative connections, deep reflection, and morning messages
- **Self-Evolution** — Three tiers: prompt and workflow evolution (DB), code modification (E2B sandbox)
- **Curiosity Engine** — Emotionally triggered interest exploration that generates self-directed goals
- **Security** — Guardian (allowlist, validation, drift detection), rollback engine, external watchdog
- **Operator Feedback** — Adaptive personality adjustments from operator sentiment analysis

## Architecture

The system consists of ten interlocking layers:

| # | Layer | Function |
|---|-------|----------|
| 1 | External Protection | Watchdog, health checks |
| 2 | Security Foundation | Guardian, rollback, injection defense |
| 3 | Integrations | Telegram, X, Email, Weather, GitHub, APIs |
| 4 | Intelligence Core | Heartbeat, model routing, context builder, workflow engine |
| 5 | Memory System | Working, episodic, semantic, goal tracking |
| 6 | Passive Perception | 6 sensors, pattern-based goal detection |
| 7 | Dream Simulation | Consolidation, creativity, reflection, morning routine |
| 8 | Personality | MBTI-derived DNA, expression, feedback loop |
| 9 | Trust Levels | Fear, confidence, 9 action types, 4 autonomy levels |
| 10 | Emotional System | 7-dimension state vector, decay, calibration |

### Tick Flow

```
Heartbeat (5-min cron)
  SENSE    → Evaluate perception sensors, update emotional state (decay + events), detect pattern goals
  THINK    → Check workflow triggers, build personality prompt, triage via Grok Fast (idle/simple/complex/deep)
  ACT      → Execute triggered workflows, model routing (Fast/Reasoning), proactive action, Guardian validation
  MAINTAIN → Drift detection, ad-hoc reflection trigger, tick log persistence
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime & Orchestration | [Trigger.dev](https://trigger.dev) Cloud (Bun/TypeScript) |
| LLM | [xAI Grok](https://x.ai) via [Vercel AI Gateway](https://sdk.vercel.ai) (Fast, Reasoning) |
| Relational DB | [Neon](https://neon.tech) (Serverless Postgres) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| Cache / KV | [Upstash Redis](https://upstash.com) |
| Vector DB | [Upstash Vector](https://upstash.com) |
| Sandbox Execution | [E2B](https://e2b.dev) (Firecracker microVMs) |
| Communication | [Grammy](https://grammy.dev) (Telegram Bot API) |
| Social | [X API](https://developer.x.com) |
| Email | [Resend](https://resend.com) |
| Weather | [OpenWeather](https://openweathermap.org) |
| Error Tracking & Logs | [Sentry](https://sentry.io) |

## Prerequisites

- [Bun](https://bun.sh) (latest)
- [Trigger.dev](https://trigger.dev) account + CLI
- [Neon](https://neon.tech) database
- [Upstash](https://upstash.com) Redis + Vector instances
- [Vercel AI Gateway](https://sdk.vercel.ai) API key (for xAI Grok access)
- [Telegram Bot](https://core.telegram.org/bots#botfather) token
- [X Developer](https://developer.x.com) app credentials
- [Resend](https://resend.com) API key
- [E2B](https://e2b.dev) API key
- [GitHub](https://github.com) personal access token
- [OpenWeather](https://openweathermap.org) API key
- [Sentry](https://sentry.io) DSN

## Setup

```bash
git clone https://github.com/marvinengelmann/anima.git
cd anima
bun install
```

Copy the environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Environment variables:

| Variable | Description |
|----------|-------------|
| | **Core AI** |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key |
| `ANIMA_PERSONALITY_TYPE` | MBTI type string (e.g. `INFP-T`) |
| | **Orchestration** |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key |
| `TRIGGER_PROJECT_REF` | Trigger.dev project reference |
| | **Database (Neon Postgres)** |
| `DATABASE_URL` | Neon Postgres connection string |
| | **Cache & Memory (Upstash Redis)** |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| | **Vector Store (Upstash Vector)** |
| `UPSTASH_VECTOR_REST_URL` | Upstash Vector REST URL |
| `UPSTASH_VECTOR_REST_TOKEN` | Upstash Vector REST token |
| | **Telegram** |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_OPERATOR_CHAT_ID` | Your Telegram chat ID |
| | **X (Twitter)** |
| `X_CLIENT_ID` | X OAuth 2.0 client ID |
| `X_CLIENT_SECRET` | X OAuth 2.0 client secret |
| `X_ACCESS_TOKEN` | X access token |
| `X_REFRESH_TOKEN` | X refresh token |
| | **Email (Resend)** |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Email address ANIMA sends from |
| `RESEND_OPERATOR_EMAIL` | Operator email address |
| | **Operator** |
| `OPERATOR_TIMEZONE` | Operator timezone (e.g. `Europe/Berlin`) |
| `OPERATOR_PREFERRED_LANGUAGE` | Language for communication (e.g. `German`) |
| | **GitHub (Self-Evolution)** |
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITHUB_OWNER` | GitHub repo owner |
| `GITHUB_REPO` | GitHub repo name |
| | **Sandbox (Self-Evolution)** |
| `E2B_TEMPLATE_ID` | E2B sandbox template ID |
| | **Weather** |
| `OPENWEATHER_API_KEY` | OpenWeather API key |
| `OPENWEATHER_DEFAULT_LOCATION` | Default location (city name) |
| | **Error Tracking** |
| `SENTRY_DSN` | Sentry DSN |

Generate the initial X tokens:

```bash
bun run x-auth
```

Build the E2B sandbox template (provides the `E2B_TEMPLATE_ID`):

```bash
bun run e2b:build
```

Database migrations and baseline data (semantic memory, personality, trust levels, emotions) are applied automatically on first worker start — both locally via `bun run dev` and on deployment.

## Development

Start the Trigger.dev dev server:

```bash
bun run dev
```

Run tests:

```bash
bun run test          # watch mode
bun run test:run      # single run
bun run test:coverage # with coverage
```

Lint and type check:

```bash
bunx biome check --write src/   # lint + format
bunx tsc --noEmit               # type check
```

## Deployment

ANIMA deploys automatically through Trigger.dev on every push to `master`. The self-evolution system also uses this mechanism — validated code changes are merged to `master` and auto-deployed.

## Project Structure

```
src/
├── bridge/         # Human Bridge — conversation handling, typing simulation, afterthought
├── config/         # Environment validation, constants, error taxonomy, Result helpers, Sentry setup
├── core/           # Intelligence (LLM), context builder, budget tracking, workflow engine, heartbeat phases
├── db/             # Drizzle schema (11 tables), migrations, client, seed
├── dream/          # Dream orchestration, consolidation, creative connections
├── emotion/        # 7-dimension state vector, update logic (decay + events), calibration, metrics check
├── evolution/      # Prompt/workflow/code evolution, curiosity engine, changelog, prompt loader
├── health/         # Health check logic, service status verification
├── inbound/        # Unified polling cycle — X mentions, email processing
├── integrations/   # Redis, Vector, Telegram (Grammy), X, GitHub, E2B, Resend, OpenWeather
├── lib/            # Shared utilities (math, time, logger, sentry)
├── memory/         # Working (Redis), episodic (Vector), semantic (Postgres), goal tracking
├── perception/     # 6 passive sensors, pattern-based goal detection
├── personality/    # MBTI system, personality DNA, expression prompts, operator feedback
├── prompts/        # System prompts (triage, conversation, responder, proactive, afterthought, dream, evolution)
├── routine/        # Reflection, morning messages
├── security/       # Guardian, rollback engine, injection defense
├── test/           # Test factories, mocks, and utilities
├── trigger/        # Trigger.dev tasks (heartbeat, bridge, inbound, dream, morning, evolution, health, reflection, init)
└── trust/          # Trust assessment, autonomy levels, action history
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
