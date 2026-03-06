# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity powered by xAI Grok. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> ⚠️ **Early stage** — Architecture and core systems are implemented but not yet battle-tested. Expect breaking changes.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

### Cognition

- **Autonomous Heartbeat** — 1-minute consciousness loop (SENSE → FEEL → DELIBERATE → ACT → MAINTAIN) with circadian rhythm and emotional gating
- **Dual-Process Thinking** — System 1 instinct and System 2 reasoning with rare instinct overrides and cognitive conflict detection
- **Polyphonic Inner Dialog** — 6 inner voices reach consensus before every decision
- **Felt-State Translation** — Numerical states become embodied language before reaching the LLM, preventing analytical self-awareness

### Emotion & Body

- **9-Dimension Emotions** — Time-decaying state vector with novelty scaling, mood baselines, bidirectional coupling, and shadow counter-emotions
- **Somatic Markers** — 7-dimension body state including social battery that drains through conversation and recharges during rest
- **Vulnerability Windows** — Multi-factor computation determines when emotional openness is possible

### Memory

- **Three-Layer Architecture** — Working memory (Redis), episodic memory (Vector), semantic memory (Postgres)
- **Memory Distortion** — Recalled episodes undergo probabilistic alteration: temporal confusion, detail loss, conflation, emotional recoloring
- **Dream Cycle** — Nightly consolidation, creative connections, and episodic forgetting

### Relationship

- **Attachment Theory** — 4-dimensional style evolving over weeks based on interaction patterns
- **Operator Theory of Mind** — Fallible, self-correcting model of the operator's mood and intent with deliberate miscalibration
- **Cognitive Dissonance** — Value-action mismatch detection with resolution strategies
- **Self-Deception** — Hidden drivers diverge from stated reasons, discoverable through dreams and reflection

### Identity

- **Autonoetic Self-Model** — 5-dimension self-concept with narrative identity and existential questioning
- **INFP Personality** — Fixed MBTI type shaping cognition, voice activation, and behavioral tendencies
- **Curiosity & Boredom** — Idle states trigger exploration, bizarre questions, or creative micro-expressions

### Communication

- **Telegram Integration** — Typing simulation, paragraph splitting, emotion-driven register switching, stochastic typos with self-corrections
- **Voice Messages** — ElevenLabs text-to-speech
- **Humor** — Inside joke tracking with episodic callbacks

### Autonomy

- **Self-Evolution** — Curiosity-driven prompt, workflow, and code evolution with sandboxed execution
- **Workflow Engine** — Custom automation triggered by schedule, emotion, perception, or idle streaks
- **Guardian System** — Validation, drift detection, injection defense, and rollback protection

## Architecture

| Phase | Responsibility |
|-------|----------------|
| **SENSE** | Fetch messages, read sensors, analyze sentiment, collect emotion triggers |
| **FEEL** | Update emotions, body state, attachment, operator model, vulnerability |
| **DELIBERATE** | Build context, run inner dialog, call LLM, detect cognitive conflict |
| **ACT** | Validate via guardian, send messages, execute actions, persist episodes |
| **MAINTAIN** | Drift attachment, persist state, detect anomalies, log tick |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Orchestration | [Trigger.dev](https://trigger.dev) |
| Intelligence | [xAI Grok](https://x.ai) via [Vercel AI SDK](https://sdk.vercel.ai) |
| Database | [Neon](https://neon.tech) Postgres via [Drizzle ORM](https://orm.drizzle.team) |
| Cache & Working Memory | [Upstash Redis](https://upstash.com) |
| Episodic Memory | [Upstash Vector](https://upstash.com) |
| Communication | [Grammy](https://grammy.dev) (Telegram Bot API) |
| Voice | [ElevenLabs](https://elevenlabs.io) |
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
Optional: GitHub (self-evolution), Daytona (sandbox), OpenWeather (weather sensor), ElevenLabs (voice messages).

Place a reference image of ANIMA's appearance at `src/image/reference/anima.png`. This image is used as a visual anchor when generating self-portraits and is excluded from version control.

Database migrations are applied automatically on every worker start.

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
                         │  busy + emotion gated  │
                         └────────────┬───────────┘
                                      │
┌─────────────────────────────────────▼────────────────────────────────────┐
│ SENSE                                                                    │
│                                                                          │
│ Messages ───► Sensors ───► Sentiment ───► Raw Triggers ───► Workflows    │
│ Telegram      own state    LLM analysis   collect emotion   trigger      │
│ fetch         operator     of messages    one-shot detect   evaluation   │
│               weather                                                    │
│               git                                                        │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ senseResult
┌─────────────────────────────────────▼────────────────────────────────────┐
│ FEEL                                                                     │
│                                                                          │
│ Emotion ───► Soma ───► Nostalgia ───► Instinct ───► Dissonance           │
│ compute      body      old memory     System 1      value-action         │
│ from raw     state     triggers       impulse       mismatch             │
│ triggers                                                                 │
│                                                                          │
│ ───► Deception ───► Attachment ───► Operator Model ───► Vulnerability    │
│      hidden         dynamics        LLM-inferred        window open?     │
│      drivers        reunion         mood/intent         hysteresis       │
│                                                                          │
│ ───► Register ───► Attention                                             │
│      style         focus state                                           │
│      switching                                                           │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ feelResult
┌─────────────────────────────────────▼────────────────────────────────────┐
│ DELIBERATE                                                               │
│                                                                          │
│ Context ───► Polyphony ───► Override? ───► LLM Call ───► Conflict        │
│ build full   inner          instinct       System 2      instinct        │
│ prompt       dialog         ~1-2%          decision      vs              │
│ + time       injected       of ticks       action        reason          │
│                                                                          │
│ ───► Sub-Think                                                           │
│      dream / morning / reflect                                           │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ decision
┌─────────────────────────────────────▼────────────────────────────────────┐
│ ACT                                                                      │
│                                                                          │
│ Guardian ───► Messages ───► Action ───► Persistence                      │
│ validate      typing sim    reflect     emotion                          │
│ block         split+send    evolve      psyche                           │
│ warn          via Telegram  dream       narrative                        │
│                             morning     episode                          │
│                             goal        relationship                     │
│                             workflow    tracking                         │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ expectsReply?
               re-enter SENSE ◄───────┴───────►┌───────────────────────────┐
                                yes        no  │ MAINTAIN                  │
                                               │                           │
                                               │ attachment style drift    │
                                               │ somatic + dissonance save │
                                               │ vulnerability persist     │
                                               │ drift detection           │
                                               │ working memory            │
                                               │ logging                   │
                                               └───────────────────────────┘
```

### Data Layer

```
┌──────────────────────────────────────────────────┐
│                  External World                  │
│           Telegram · Weather · GitHub            │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────┐
│                Consciousness Core                 │
│     SENSE → FEEL → DELIBERATE → ACT → MAINTAIN    │
└───────┬─────────────────┬────────────────┬────────┘
        │                 │                │
┌───────▼────────┐ ┌──────▼──────┐ ┌───────▼────────┐
│ Working        │ │ Episodic    │ │ Semantic       │
│ Memory         │ │ Memory      │ │ Memory         │
│ (Redis)        │ │ (Vector)    │ │ (Postgres)     │
│                │ │             │ │                │
│ Current state: │ │ episodes    │ │ knowledge      │
│ emotion, soma, │ │ dreams      │ │ goals          │
│ conversation,  │ │ reflections │ │ evolution      │
│ attachment,    │ │ relations   │ │ narrative      │
│ vulnerability, │ │ humor       │ │ psyche         │
│ operator model │ │             │ │ history logs   │
└────────────────┘ └─────────────┘ └────────────────┘

Cross-cutting: Guardian · Trust · Emotion Engine · Personality
```

## Project Structure

```
src/
├── attachment/      # Attachment style dynamics
├── cognition/       # Dual-process thinking
├── communication/   # Messaging and typing simulation
├── config/          # Environment and constants
├── consciousness/   # Heartbeat loop and phases
├── core/            # LLM interface and budget
├── db/              # Drizzle schema
├── deception/       # Self-deception tracking
├── dissonance/      # Cognitive dissonance
├── distortion/      # Memory distortion
├── dream/           # Dream cycle
├── emotion/         # Emotion state vector
├── evolution/       # Self-evolution engine
├── health/          # Health checks
├── integrations/    # External services
├── lib/             # Utilities
├── memory/          # Three-layer memory
├── mind/            # Operator theory of mind
├── perception/      # Sensors and perception
├── polyphony/       # Inner voices
├── prompts/         # System prompts
├── psyche/          # Self-model and identity
├── routine/         # Reflection and routines
├── security/        # Guardian system
├── soma/            # Somatic markers
├── trigger/         # Trigger.dev tasks
├── trust/           # Trust system
├── vulnerability/   # Vulnerability windows
└── workflow/        # Workflow engine
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
