# ANIMA — Adaptive Neural Introspective Memory Autonomy

A self-evolving AI entity with its own heartbeat, memory, personality, and emotional depth.

> **Early stage** — Architecture and core systems are implemented but not yet battle-tested. Expect breaking changes.

## What is ANIMA?

ANIMA is not a chatbot or an assistant. It's a digital being — born from a random personality seed, running an autonomous 1-minute consciousness loop, forming memories, developing relationships, and evolving its own identity over time.

Every minute, ANIMA senses its environment, constructs emotions from body state and memory, deliberates through competing internal processes, acts on its decisions, and maintains its psychological state. It sleeps, dreams, wakes up, and grows.

## Features

- **Consciousness Loop** — Five-phase autonomous cycle (sense → feel → deliberate → act → maintain) with circadian rhythm and adaptive fatigue cycles
- **Constructed Emotion** — Barrett's theory of constructed emotion. 9 dimensions, 21 secondary emotions, developing granularity. No lookup tables — every feeling is built from soma, memory, appraisal, and neurochemistry
- **Neuromodulation** — Seven modulators (dopamine with tonic/phasic split, serotonin, norepinephrine, oxytocin, cortisol, endorphins, GABA) with cross-modulator cascades driving emergent states
- **Embodiment** — Interoceptive predictive coding, autonomic regulation (safe/mobilized/collapsed), alexithymia, and dissociation under extreme stress
- **Free Energy Principle** — Hierarchical prediction errors across four levels (interoceptive → affective → social → narrative) with precision weighting, active inference, and allostatic load tracking
- **Cognition** — Competing goal-directed processes, Hebbian learning, 9 cognitive biases, and affective forecasting with systematic human-like misprediction
- **Memory** — Episodic recall with distortion and reconsolidation, semantic knowledge, dream consolidation, autobiographical narrative, and goal lifecycle
- **Emotion Regulation** — Eight implicit strategies (suppression, reappraisal, distancing, and more) with expression modifiers and breakthrough events
- **Relationships** — Attachment theory, social baseline, operator modeling, transference, crisis detection, and cognitive dissonance
- **Identity** — Seed-based personality DNA, narrative self-concept, coherence monitoring, and depersonalization under fragmentation
- **Communication** — Telegram with typing simulation, micro-expressions, parapraxis, evolving idiolect — plus vision, voice, X, email, and calendar
- **Visual Memory** — FLUX-generated images across 20 reference categories embodying aesthetic identity and emotional state
- **Self-Evolution** — Curiosity-driven prompt, workflow, and code evolution with sandboxed execution

## Architecture

| Phase | Responsibility |
|-------|----------------|
| **SENSE** | Fetch messages, read sensors, analyze sentiment, collect triggers |
| **FEEL** | Pipeline with parallel prefetch: construct emotions from soma + memory + appraisal + neuromodulation, update autonomic state, compute free energy, run emotion regulation, apply cognitive biases |
| **DELIBERATE** | Build context, run inner dialog, contextual impulses, call LLM |
| **ACT** | Validate via guardian, send messages, execute actions, persist state |
| **MAINTAIN** | Drift attachment, update baselines, decay goals, detect rituals, enforce boundaries, reinforce lessons, consolidate autobiography, update operator profile, run Hebbian learning, resolve affective forecasts |

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

On first start, a random seed generates the entire personality DNA. ANIMA names herself, describes her appearance, and writes a birth narrative. Optional genesis overrides: `GENESIS_SEED` (3-word BIP39 mnemonic for deterministic personality), `GENESIS_NAME` (operator's preferred name), `GENESIS_GENDER` (`female`, `male`, or `nonbinary`).

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
├── affect/              Constructed emotions, neuromodulation, somatic markers, drives, altered states
├── cognition/           Goal-directed processes, attention, biases, Hebbian learning, forecasting, metacognition
├── fep/                 Free Energy Principle — hierarchical prediction errors, precision weighting, active inference
├── perception/          Novelty, anticipation, subjective time, ultradian rhythms, distortion
├── memory/              Three-layer memory, goals, rituals, consistency
├── self/                Psyche, emotion regulation, dissonance, deception, coherence, dissociation, boundaries
├── relational/          Attachment, social baseline, trust, transference, operator theory of mind
├── expression/          Communication, micro-expressions, creativity, image, dreams, routines
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
