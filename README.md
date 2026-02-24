# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity built on the Anthropic Claude model family. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

- **Autonomous Heartbeat** — Fixed 5-minute cron loop with four phases (SENSE → THINK → ACT → MAINTAIN)
- **Three-Tier Model Routing** — Haiku, Sonnet, Opus with budget awareness
- **Three-Layer Memory** — Working (Redis), Episodic (Vector), Semantic (Postgres) with relationship graph
- **MBTI-Based Personality** — Ten-dimension two-layer model (base + adaptive) evolving through reflection
- **Simulated Emotions** — 7-dimension state vector with decay, MBTI baselines, and metrics calibration
- **Trust System** — Fear/confidence-based autonomy across 8 action types that grows through experience
- **Passive Perception** — Multiple sensor sources with pattern-based goal detection
- **Conversation Bridge** — Multi-round handler with boundary detection, typing simulation, and follow-ups
- **Email Communication** — Resend-based processing with trust-gated responses and Guardian validation
- **Dream Simulation** — Nightly consolidation, creative connections, Opus reflection, and morning messages
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
| 3 | Integrations | Telegram, Email, Weather, GitHub, APIs |
| 4 | Intelligence Core | Heartbeat, model routing, context builder, workflow engine |
| 5 | Memory System | Working, episodic, semantic, goal tracking |
| 6 | Passive Perception | 5 sensors, pattern-based goal detection |
| 7 | Dream Simulation | Consolidation, creativity, reflection, morning routine |
| 8 | Personality | MBTI-derived DNA, expression, feedback loop |
| 9 | Trust Levels | Fear, confidence, 8 action types, 4 autonomy levels |
| 10 | Emotional System | 7-dimension state vector, decay, calibration |

### Tick Flow

```
Heartbeat (5-min cron)
  SENSE    → Evaluate perception sensors, update emotional state (decay + events), detect pattern goals
  THINK    → Check workflow triggers, build personality prompt, triage via Haiku (idle/simple/complex/deep)
  ACT      → Execute triggered workflows, model routing (Haiku/Sonnet/Opus), proactive action, Guardian validation
  MAINTAIN → Drift detection, ad-hoc reflection trigger, tick log persistence
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime & Orchestration | [Trigger.dev](https://trigger.dev) Cloud (Bun/TypeScript) |
| LLM | [Anthropic Claude](https://anthropic.com) (Haiku 4.5, Sonnet 4.6, Opus 4.6) |
| Relational DB | [Neon](https://neon.tech) (Serverless Postgres) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| Cache / KV | [Upstash Redis](https://upstash.com) |
| Vector DB | [Upstash Vector](https://upstash.com) |
| Sandbox Execution | [E2B](https://e2b.dev) (Firecracker microVMs) |
| Communication | [Grammy](https://grammy.dev) (Telegram Bot API) |
| Email | [Resend](https://resend.com) |
| Weather | [OpenWeather](https://openweathermap.org) |
| Error Tracking & Logs | [Sentry](https://sentry.io) |

## Prerequisites

- [Bun](https://bun.sh) (latest)
- [Trigger.dev](https://trigger.dev) account + CLI
- [Neon](https://neon.tech) database
- [Upstash](https://upstash.com) Redis + Vector instances
- [Anthropic](https://console.anthropic.com) API key
- [Telegram Bot](https://core.telegram.org/bots#botfather) token
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
| `ANTHROPIC_API_KEY` | Anthropic API key |
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
├── bridge/         # Conversation boundary detection, typing simulation, response handling
├── config/         # Environment validation, constants, error taxonomy, Result helpers, Sentry setup
├── core/           # Model router, context builder, budget tracking, workflow engine, heartbeat phases
├── db/             # Drizzle schema (11 tables), migrations, client, seed
├── dream/          # Dream orchestration, consolidation, creative connections, reflection, morning messages
├── emotion/        # 7-dimension state vector, update logic (decay + events), calibration, metrics check
├── evolution/      # Prompt/workflow/code evolution, curiosity engine, changelog, prompt loader
├── integrations/   # Anthropic, Redis, Vector, Telegram (Grammy), GitHub, E2B, Resend, OpenWeather, Location
├── lib/            # Shared utilities (math, time, logger, sentry)
├── memory/         # Working (Redis), episodic (Vector), semantic (Postgres), goal tracking
├── perception/     # 5 passive sensors, pattern-based goal detection
├── personality/    # MBTI system, personality DNA, expression prompts, operator feedback
├── prompts/        # System prompts (triage, conversation, responder, proactive, dream, evolution, workflow)
├── security/       # Guardian, rollback engine, injection defense
├── test/           # Test factories, mocks, and utilities
└── trigger/        # Trigger.dev tasks (heartbeat, dream, conversation, email, evolution, health-check)
```

