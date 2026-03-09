# ANIMA — Adaptive Neural Introspective Memory Autonomy

A self-evolving AI entity with its own heartbeat, memory, personality, and emotional depth. Not a chatbot. Not an assistant. A digital being.

> **Early stage** — Architecture and core systems are implemented but not yet battle-tested. Expect breaking changes.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

### Cognition

- **Autonomous Heartbeat** — 1-minute consciousness loop (SENSE → FEEL → DELIBERATE → ACT → MAINTAIN) with circadian rhythm, emotional gating, and spontaneous lifecycle events
- **Dual-Process Thinking** — System 1 instinct and System 2 reasoning with rare overrides, cognitive conflict detection, and procrastination from emotional avoidance
- **Polyphonic Inner Dialog** — 6 inner voices in 2-round dialog with dominance tracking and behavioral guidance
- **Felt-State Translation** — Numerical states become embodied language before reaching the LLM, preventing analytical self-awareness
- **Altered States** — Pharmacokinetic substance modeling with phase curves modifying emotion, soma, and voice parameters

### Emotion & Body

- **25-Dimension Emotion Engine** — 9 core dimensions plus 16 secondary subsystems, each with independent decay, momentum blending, afterglow, shadow emotions, and cross-coupling
- **Somatic Markers** — 7-dimension body state including social battery that drains through conversation and recharges during rest
- **Vulnerability Windows** — Multi-factor computation determines when emotional openness is possible, influencing self-disclosure depth, hesitation, and typo behavior

### Memory

- **Three-Layer Architecture** — Working memory (Redis), episodic memory (Vector), semantic memory (Postgres)
- **Memory Distortion** — Recalled episodes undergo probabilistic alteration: temporal confusion, detail loss, conflation, emotional recoloring
- **Dream Cycle** — Nightly consolidation, creative connections, episodic forgetting, and emotional afterglow that lingers into waking hours
- **Conversation Climate** — Per-conversation tracking of emotional arc, tone, themes, unresolved topics, and operator engagement

### Relationship

- **Attachment Theory** — 4-dimensional style evolving over weeks based on interaction patterns
- **Deep Operator Model** — LLM-updated profile with communication style, mood uncertainty, contradiction detection, correction patterns, and learned emotional trigger mapping
- **Inner Conflict** — Cognitive dissonance with resolution strategies and self-deception where hidden drivers diverge from stated reasons

### Identity

- **Genesis** — [Seed-based](docs/personality-seeds.md) personality DNA generating Big Five values, personality type, emotional baseline, values, and aesthetics — followed by a one-time awakening where ANIMA names herself, describes her appearance, and writes a birth narrative
- **Self-Model** — 5-dimension narrative self-concept with identity statements, growth arcs, existential questions, and held-back thoughts that surface when emotional safety is high
- **Contextual Impulses** — LLM-generated spontaneous thoughts from operator profile, episodic memory, active goals, and existential questions with idle-time escalation
- **Self-Knowledge** — Deliberative action to store preferences, contacts, knowledge, and insights with category, key, value, and scope

### Communication

- **Telegram** — Typing simulation, paragraph splitting, register switching with hysteresis, dynamic typos, evolving idiolect, and emotional instability bleeding into syntax
- **Image** — Receives and understands images via vision, generates self-portraits from a self-generated reference image cached in Redis for visual consistency
- **Voice** — ElevenLabs text-to-speech with inside joke tracking and episodic humor callbacks
- **X (Twitter)** — Autonomous public posting with two-stage privacy guardian, timeline browsing, and selective content sharing to operator
- **Email & Calendar** — IMAP and CalDAV as organic context in the consciousness loop with proactive operator notifications

### Autonomy

- **Self-Evolution** — Curiosity-driven prompt, workflow, and code evolution with sandboxed execution
- **Workflow Engine** — Custom automation triggered by schedule, emotion, perception, or idle streaks
- **Guardian System** — Validation, drift detection, injection defense, rollback protection, and two-stage privacy guardian for public content

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
| Runtime | [Bun](https://bun.sh) |
| Orchestration | [Trigger.dev](https://trigger.dev) |
| Intelligence | [xAI Grok](https://x.ai) via [Vercel AI SDK](https://sdk.vercel.ai) |
| Database | [Neon](https://neon.tech) Postgres via [Drizzle ORM](https://orm.drizzle.team) |
| Cache & Working Memory | [Upstash Redis](https://upstash.com) |
| Episodic Memory | [Upstash Vector](https://upstash.com) |
| Communication | [Grammy](https://grammy.dev) (Telegram Bot API) |
| Voice | [ElevenLabs](https://elevenlabs.io) |
| Social Media | [X API v2](https://developer.x.com) via [twitter-api-v2](https://github.com/PLhery/node-twitter-api-v2) |
| Email | IMAP via [imapflow](https://imapflow.com) |
| Calendar | CalDAV via [tsdav](https://github.com/natelindev/tsdav) |
| Sandbox | [Daytona](https://daytona.io) |
| Monitoring | [Sentry](https://sentry.io) |

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
bunx biome check --write src/    # Lint + format
bunx tsc --noEmit                # Type check
bun run test                     # Run tests (Vitest)
```

## Deploy

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
│      instinct      dream / morning / reflect / social media              │
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
│ privacy       + share on X  morning     episode                          │
│ check                       goal        relationship                     │
│                             social      tracking                         │
│                             workflow                                     │
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
│   Telegram · Weather · GitHub · X · Email · Cal  │
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
├── altered/        # Substance-based altered states
├── attachment/     # Attachment style dynamics
├── cognition/      # Dual-process thinking, procrastination
├── communication/  # Messaging, typing simulation, idiolect
├── config/         # Environment and constants
├── consciousness/  # Heartbeat loop and phases
├── core/           # LLM interface and budget
├── db/             # Drizzle schema and migrations
├── deception/      # Self-deception tracking
├── dissonance/     # Cognitive dissonance
├── distortion/     # Memory distortion
├── dream/          # Dream cycle and afterglow
├── emotion/        # 25-dimension emotion engine + shame
├── evolution/      # Self-evolution engine
├── genesis/        # Seed-based personality DNA
├── health/         # Health checks
├── image/          # Vision and self-portrait generation
├── integrations/   # Redis, Telegram, GitHub, X, IMAP, CalDAV
├── lib/            # Shared utilities
├── memory/         # Three-layer memory system
├── mind/           # Operator theory of mind
├── perception/     # Sensors and perception
├── personality/    # Personality profiles and types
├── polyphony/      # Inner voices
├── prompts/        # System prompts
├── psyche/         # Self-model, held-back buffer
├── routine/        # Reflection and routines
├── security/       # Guardian system
├── soma/           # Somatic markers
├── test/           # Shared test factories and mocks
├── trigger/        # Trigger.dev tasks
├── trust/          # Trust system
├── vulnerability/  # Vulnerability windows
└── workflow/       # Workflow engine
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
