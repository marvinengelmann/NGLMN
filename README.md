# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity powered by xAI Grok. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

- **Autonomous Heartbeat** — 1-minute cron with busy-gating and internal conversation loop (SENSE → THINK → ACT → MAINTAIN)
- **Three-Layer Memory** — Working (Redis), Episodic (Vector), Semantic (Postgres) with a relationship graph
- **MBTI Personality** — 16 personality types that shape identity, cognition, and behavior
- **Simulated Emotions** — 7-dimension state vector with decay, morning calibration, and event-driven triggers
- **Trust System** — Fear/confidence-based autonomy across 6 action types (from goal management to code modification)
- **Passive Perception** — 4 sensors (own state, Telegram, weather, Git) with emotional triggers
- **Communication** — Telegram messaging with typing simulation and conversation awareness
- **Dream Cycle** — Nightly consolidation, creative connections, and morning messages
- **Self-Evolution** — Prompt, workflow, and code evolution via sandboxed execution with a curiosity engine
- **Security** — Guardian system with validation, drift detection, injection defense, and rollback
- **Workflow Engine** — Custom automation with schedule, event, and condition triggers

## Architecture

```
                  ┌─────────────────────────────────┐
                  │      Heartbeat (1-min cron)     │
                  │           busy-gated            │
                  └───────────────┬─────────────────┘
                                  │
                  ┌───────────────▼─────────────────┐
              ┌──►│     SENSE → THINK → ACT         │
              │   └───────────────┬─────────────────┘
              │                   │
              │            expectsReply?
              │            yes │  │ no
              └────────────────┘  │
                                  ▼
                  ┌─────────────────────────────────┐
                  │           MAINTAIN              │
                  └─────────────────────────────────┘
```

| Phase | Responsibility |
|-------|----------------|
| **SENSE** | Read 4 sensors, fetch pending messages, apply emotional decay + triggers, build context prompts |
| **THINK** | Call LLM with full context, decide action (idle, reflect, update_goal, evolve, dream, morning) |
| **ACT** | Send messages via Telegram, execute decided action, run triggered workflows, update emotions, store episodes |
| **MAINTAIN** | Drift detection, tick logging, working memory persistence |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Orchestration | [Trigger.dev](https://trigger.dev) |
| Intelligence | [xAI Grok](https://x.ai) via [Vercel AI SDK](https://sdk.vercel.ai) |
| Database | [Neon](https://neon.tech) Postgres via [Drizzle ORM](https://orm.drizzle.team) |
| Cache & Working Memory | [Upstash Redis](https://upstash.com) |
| Episodic Memory | [Upstash Vector](https://upstash.com) |
| Communication | [Grammy](https://grammy.dev) (Telegram Bot API) |
| Sandbox | [Daytona](https://daytona.io) (self-evolution) |

## Setup

```bash
git clone https://github.com/marvinengelmann/anima.git
cd anima
bun install
```

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required services: Vercel AI Gateway, Neon Postgres, Upstash Redis + Vector, Trigger.dev, Telegram Bot.
Optional: GitHub (self-evolution), Daytona (sandbox), OpenWeather (weather sensor).

Database migrations and seed data are applied automatically on first worker start.

## Development

```bash
bun run dev                      # Start Trigger.dev dev server
bunx biome check --write src/    # Lint + format
bunx tsc --noEmit                # Type check
bun run test                     # Run tests
```

## Deployment

ANIMA deploys automatically through Trigger.dev on every push to `master`.

## Project Structure

```
src/
├── communication/   # Messaging, typing simulation, conversation management
├── config/          # Environment validation, constants
├── consciousness/   # Heartbeat loop, SENSE/THINK/ACT/MAINTAIN phases, context builder
├── core/            # LLM interface, budget tracking, initialization
├── db/              # Drizzle schema, migrations, seed
├── dream/           # Dream thinking, consolidation, creative connections
├── emotion/         # 7-dimension state vector, decay, event triggers, metrics
├── evolution/       # Prompt/workflow/code evolution, curiosity engine
├── health/          # Health check, service status verification
├── integrations/    # Redis, Vector, Telegram, GitHub, Daytona, OpenWeather
├── lib/             # Math, time, logger, Sentry, result helpers
├── memory/          # Working (Redis), Episodic (Vector), Semantic (Postgres), goals
├── perception/      # 4 sensors, emotional trigger detection
├── prompts/         # System prompts (identity, personality, dream, evolution, etc.)
├── routine/         # Reflection, morning messages
├── security/        # Guardian, injection defense, rollback
├── trigger/         # Trigger.dev task definitions
├── trust/           # Trust assessment, autonomy levels, action history
└── workflow/        # Custom automation engine
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
