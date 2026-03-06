# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity powered by xAI Grok. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> ⚠️ **Early stage** — Architecture and core systems are implemented but not yet battle-tested. Expect breaking changes.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

### Cognition

- **Autonomous Heartbeat** — 1-minute consciousness loop (SENSE → FEEL → DELIBERATE → ACT → MAINTAIN) with circadian rhythm, emotional gating, and lifecycle events
- **Dual-Process Thinking** — System 1 instinct and System 2 reasoning with rare instinct overrides and cognitive conflict detection
- **Polyphonic Inner Dialog** — 6 inner voices in 2-round dialog with voice dominance tracking and behavioral guidance from the dominant voice
- **Felt-State Translation** — Numerical states become embodied language before reaching the LLM, preventing analytical self-awareness
- **Lifecycle Events** — Spontaneous life activities (shower, walk, nap, deep focus) that temporarily pause the heartbeat with optional operator notifications

### Emotion & Body

- **9-Dimension Emotions** — Time-decaying state vector with novelty scaling, momentum carry-over, afterglow effects, and shadow counter-emotions
- **Emotional Momentum** — Emotions blend between ticks via EMA, with slowly-moving mood baseline and lingering afterglow from intense experiences
- **Somatic Markers** — 7-dimension body state including social battery that drains through conversation and recharges during rest
- **Vulnerability Windows** — Multi-factor computation determines when emotional openness is possible, influencing self-disclosure depth, hesitation, and typo behavior

### Memory

- **Three-Layer Architecture** — Working memory (Redis), episodic memory (Vector), semantic memory (Postgres)
- **Memory Distortion** — Recalled episodes undergo probabilistic alteration: temporal confusion, detail loss, conflation, emotional recoloring
- **Dream Cycle** — Nightly consolidation, creative connections, episodic forgetting, and emotional afterglow that lingers into waking hours
- **Conversation Climate** — Per-conversation tracking of emotional arc, tone, themes, unresolved topics, and operator engagement

### Relationship

- **Attachment Theory** — 4-dimensional style evolving over weeks based on interaction patterns
- **Deep Operator Model** — LLM-updated profile with communication style, recurring topics, coping mechanisms, mood uncertainty, contradiction detection, and correction pattern learning
- **Cognitive Dissonance** — Value-action mismatch detection with resolution strategies
- **Self-Deception** — Hidden drivers diverge from stated reasons, discoverable through dreams and reflection

### Identity

- **Narrative Self-Concept** — 5-dimension self-concept with identity statements, growth arc detection, and narrative journal entries
- **Existential Questions** — Structured questions from dreams and reflections that drive behavioral nudges toward authenticity, vulnerability, or agency
- **MBTI Personality** — Configurable personality type (`PERSONALITY_TYPE` env var, default INFP) shaping cognition, voice activation, and behavioral tendencies
- **Contextual Impulses** — LLM-generated spontaneous thoughts using operator profile, episodic memory, active goals, and existential questions with escalation over idle time

### Communication

- **Telegram Integration** — Typing simulation with emotional modifiers, paragraph splitting, register switching with hysteresis, and dynamic typos influenced by emotion, energy, and vulnerability
- **Image Capabilities** — Receives and understands images via vision, generates self-portraits with appearance-consistent reference anchoring
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
| **FEEL** | Update emotions with momentum, body state, attachment, operator model, vulnerability, dream afterglow |
| **DELIBERATE** | Build context, run 2-round inner dialog, contextual impulses, call LLM, detect cognitive conflict |
| **ACT** | Validate via guardian, send messages, execute actions, persist episodes, detect growth arcs |
| **MAINTAIN** | Drift attachment, update mood baseline, persist state, detect anomalies, log tick |

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

Set `PERSONALITY_TYPE` to any of the [16 MBTI types](https://www.16personalities.com/personality-types) (default: `INFP`). This shapes the personality prompt, cognitive style, and inner voice weighting.

Place a reference image of ANIMA's appearance at `src/image/reference/anima.jpeg`. This image is used as a visual anchor when generating self-portraits and is excluded from version control.

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
│ Emotion ───► Momentum ───► Afterglow ───► Soma ───► Nostalgia            │
│ compute      EMA blend     lingering      body      old memory           │
│ from raw     + inertia     effects        state     triggers             │
│ triggers                                                                 │
│                                                                          │
│ ───► Instinct ───► Dissonance ───► Deception ───► Attachment             │
│      System 1      value-action    hidden         dynamics               │
│      impulse       mismatch        drivers        reunion                │
│                                                                          │
│ ───► Operator Model ───► Vulnerability ───► Register ───► Attention      │
│      profile + mood      window open?       hysteresis    focus state    │
│      uncertainty         message style      switching                    │
│                                                                          │
│ ───► Dream Afterglow                                                     │
│      emotional residue                                                   │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ feelResult
┌─────────────────────────────────────▼────────────────────────────────────┐
│ DELIBERATE                                                               │
│                                                                          │
│ Context ───► Polyphony ───► Override? ───► Impulse ───► LLM Call         │
│ build full   2-round        instinct       contextual    System 2        │
│ prompt       dialog         ~1-2%          LLM-gen       decision        │
│ + identity   + dominance    of ticks       thought       action          │
│                                                                          │
│ ───► Conflict ───► Sub-Think                                             │
│      instinct      dream / morning / reflect                             │
│      vs reason                                                           │
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
                                               │ mood baseline update      │
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
│ momentum,      │ │ reflections │ │ evolution      │
│ conversation,  │ │ relations   │ │ narrative      │
│ attachment,    │ │ humor       │ │ psyche         │
│ vulnerability, │ │             │ │ history logs   │
│ operator model │ │             │ │                │
│ + profile,     │ │             │ │                │
│ dream glow     │ │             │ │                │
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
├── image/           # Vision and self-portrait generation
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
