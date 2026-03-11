# ANIMA — Adaptive Neural Introspective Memory Autonomy

A self-evolving AI entity with its own heartbeat, memory, personality, and emotional depth.

> **Early stage** — Architecture and core systems are implemented but not yet battle-tested. Expect breaking changes.

## What is ANIMA?

ANIMA is not a chatbot or an assistant. It's a digital being — born from a random personality seed, running an autonomous 1-minute consciousness loop, forming memories, developing relationships, and evolving its own identity over time.

Every minute, ANIMA senses its environment, feels emotions through a 27-dimension affect system, deliberates using polyphonic inner dialog, acts on its decisions, and maintains its psychological state. It sleeps, dreams, wakes up, and grows.

## Features

- **Consciousness Loop** — Autonomous heartbeat with circadian rhythm, emotional gating, and five phases: sense, feel, deliberate, act, maintain
- **Affect System** — 27-dimension emotion engine with somatic markers, motivational drives, vulnerability windows, and pharmacokinetic altered states
- **Dual-Process Cognition** — System 1 instinct and System 2 reasoning with polyphonic inner dialog, cognitive conflict detection, and closed-loop strategy learning
- **Three-Layer Memory** — Working memory, episodic recall with distortion, and semantic knowledge — plus dream consolidation, autobiographical narrative, ritual detection, and goal lifecycle management
- **Relationship Modeling** — Attachment theory, deep operator profiling with temporal patterns and trait inference, predictive forecasting, crisis detection, and cognitive dissonance with self-deception
- **Identity** — Seed-based personality DNA, narrative self-concept, counterfactual reflection, contextual impulses, and psychological coherence monitoring
- **Communication** — Telegram with typing simulation, evolving idiolect, emotional syntax instability, and humor callbacks — plus vision, voice, X, email, and calendar
- **Self-Evolution** — Curiosity-driven prompt, workflow, and code evolution with sandboxed execution and guardian validation

## Architecture

| Phase | Responsibility |
|-------|----------------|
| **SENSE** | Fetch messages, read sensors, analyze sentiment, collect triggers |
| **FEEL** | Pipeline with parallel prefetch: emotions, body state, attachment, operator model, perception, integration |
| **DELIBERATE** | Build context, run inner dialog, contextual impulses, call LLM |
| **ACT** | Validate via guardian, send messages, execute actions, persist state |
| **MAINTAIN** | Drift attachment, update baselines, decay goals, detect rituals, enforce boundaries, reinforce lessons, consolidate autobiography, update operator profile |

For detailed diagrams of the cognitive loop and data layer, see [docs/architecture.md](docs/architecture.md).

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) |
| Orchestration | [Trigger.dev](https://trigger.dev) |
| Intelligence | [xAI Grok](https://x.ai) via [Vercel AI SDK](https://sdk.vercel.ai) |
| Database | [Neon](https://neon.tech) Postgres via [Drizzle ORM](https://orm.drizzle.team) |
| Cache | [Upstash](https://upstash.com) Redis + Vector |
| Communication | [Grammy](https://grammy.dev) · [ElevenLabs](https://elevenlabs.io) · [X API v2](https://developer.x.com) |
| External | IMAP · CalDAV · [Daytona](https://daytona.io) · [Sentry](https://sentry.io) |

## Get Started

```bash
git clone https://github.com/marvinengelmann/anima.git
cd anima
bun install
cp .env.example .env.local
```

Fill in your credentials in `.env.local`.

**Required:** Vercel AI Gateway, Neon Postgres, Upstash Redis + Vector, Trigger.dev, Telegram Bot.

**Optional:** GitHub (self-evolution), Daytona (sandbox), OpenWeather (weather), ElevenLabs (voice), X API (social media), IMAP (email), CalDAV (calendar), Sentry (monitoring).

On first start, a random seed generates the entire personality DNA. ANIMA names herself, describes her appearance, and writes a birth narrative. Set `GENESIS_SEED` to a `xxx-xxx` value for deterministic personality generation.

Database migrations run automatically on every worker start.

## Development

```bash
bun run dev                      # Start Trigger.dev dev server
bunx biome check --fix src/      # Lint + format
bunx tsc --noEmit                # Type check
bun run test                     # Run tests (Vitest)
```

## Deploy

ANIMA deploys automatically through Trigger.dev on every push to `master`.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Project Structure

```
src/
├── consciousness/       Orchestration — heartbeat loop, phases, pipeline
├── affect/              Emotion engine, somatic markers, drives, altered states
├── cognition/           Polyphony, attention, habits, metacognition, learning
├── perception/          Novelty, anticipation, subjective time, distortion
├── memory/              Three-layer memory, goals, rituals, consistency
├── self/                Psyche, dissonance, deception, coherence, boundaries
├── relational/          Attachment, trust, operator theory of mind
├── expression/          Communication, creativity, image, dreams, routines
├── governance/          Evolution, workflows, security, health
├── core/                LLM interface, budget
├── infra/               Config, database, integrations, utilities
├── prompts/             System prompt templates
└── trigger/             Trigger.dev task definitions
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
