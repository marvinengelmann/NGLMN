# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity powered by xAI Grok. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

- **Autonomous Heartbeat** — 1-minute cron with busy-gating (SENSE → THINK → ACT → MAINTAIN)
- **Three-Layer Memory** — Working (Redis), Episodic (Vector), Semantic (Postgres) with a relationship graph
- **MBTI Personality** — 16 personality types that shape identity, cognition, and behavior
- **Simulated Emotions** — 7-dimension state vector with decay, morning calibration, and event-driven triggers
- **Trust System** — Fear/confidence-based autonomy across 6 action types
- **Passive Perception** — 4 sensors (own state, Telegram, weather, Git)
- **Communication** — Telegram messaging with typing simulation and conversation awareness
- **Dream Cycle** — Nightly consolidation, creative connections, and morning messages
- **Self-Evolution** — Curiosity-driven prompt, workflow, and code evolution with sandboxed execution
- **Security** — Guardian system with validation, drift detection, injection defense, and rollback
- **Workflow Engine** — Custom automation with schedule, emotion, perception, and idle-streak triggers

## Architecture

| Phase | Responsibility |
|-------|----------------|
| **SENSE** | Fetch pending messages, read 4 sensors (own state, operator activity, weather, Git), detect conversation boundaries, apply emotional decay + triggers, check workflow triggers, build full context (memory, goals, trust, history) |
| **THINK** | Call LLM with full context → `AnimaDecision`: action (idle, reflect, update_goal, evolve, dream, morning), messages, expectsReply. Sub-Think for dream (consolidation + creativity), morning (calibration + reflection), reflect (introspection + insights) |
| **ACT** | Guardian validation → message sending (typing simulation, paragraph splitting, Telegram delivery), execute decided action, run triggered workflows, update emotions, store episodes + relationships |
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

## Diagrams

### Cognitive Loop

```
                    ┌────────────────────────┐
                    │ Heartbeat (1-min cron) │
                    │       busy-gated       │
                    └────────────┬───────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────┐
│ SENSE                                                          │
│                                                                │
│ Messages ───► Sensors ───► Emotion ───► Workflows ───► Context │
│ Telegram      own state    decay        trigger        memory  │
│ fetch         operator     triggers     evaluation     goals   │
│               weather                                  trust   │
│               git                                      history │
└────────────────────────────────┬───────────────────────────────┘
                                 │ systemPrompt + userPrompt
┌────────────────────────────────▼───────────────────────────────┐
│ THINK                                                          │
│                                                                │
│ LLM Call ───► Decision ───► Sub-Think dispatch                 │
│ structured    action        dream: consolidation + creativity  │
│ output        messages      morning: calibration + reflection  │
│               expectsReply  reflect: introspection + insights  │
│               workflowId                                       │
└────────────────────────────────┬───────────────────────────────┘
                                 │ decision
┌────────────────────────────────▼───────────────────────────────┐
│ ACT                                                            │
│                                                                │
│ Guardian ───► Messages ───► Action ───► Persistence            │
│ validate      typing sim    reflect     emotion update         │
│ block         split+send    evolve      episode storage        │
│ warn          via Telegram  dream       relationship track     │
│                             morning                            │
│                             goal                               │
│                             workflow                           │
└────────────────────────────────┬───────────────────────────────┘
                                 │ expectsReply?
          re-enter SENSE ◄───────┴───────►┌──────────────────────┐
                           yes        no  │ MAINTAIN             │
                                          │                      │
                                          │ drift detection      │
                                          │ logging              │
                                          │ working memory       │
                                          └──────────────────────┘
```

### Data Layer

```
      ┌────────────────────────────────┐
      │         External World         │
      │  Telegram · Weather · GitHub   │
      └────────────────┬───────────────┘
                       │
      ┌────────────────▼───────────────┐
      │       Consciousness Core       │
      │ SENSE → THINK → ACT → MAINTAIN │
      └─┬──────────────┬─────────────┬─┘
        │              │             │
┌───────▼──────┐ ┌─────▼───────┐ ┌───▼────────┐
│ Working      │ │ Episodic    │ │ Semantic   │
│ Memory       │ │ Memory      │ │ Memory     │
│ (Redis)      │ │ (Vector)    │ │ (Postgres) │
│              │ │             │ │            │
│ emotion      │ │ episodes    │ │ knowledge  │
│ conversation │ │ dreams      │ │ goals      │
│ busy / dream │ │ reflections │ │ trust      │
│ drift cache  │ │ relations   │ │ evolution  │
└──────────────┘ └─────────────┘ └────────────┘

Cross-cutting: Guardian · Trust · Emotion Engine
```

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
