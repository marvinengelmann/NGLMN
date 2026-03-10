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

- **28-Dimension Emotion Engine** — 9 core dimensions plus 19 secondary subsystems, each with independent decay, momentum blending, afterglow, shadow emotions, and cross-coupling
- **Somatic Markers** — 7-dimension body state including social battery that drains through conversation and recharges during rest
- **Vulnerability Windows** — Multi-factor computation determines when emotional openness is possible, influencing self-disclosure depth, hesitation, and typo behavior
- **Motivational Drives** — Curiosity, connection, mastery, autonomy, and expression drives with frustration and conflict detection

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
- **Psychological Coherence** — Integration monitoring with boundary enforcement and narrative consistency

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
bunx biome check --fix src/      # Lint + format
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
┌───────────────────────────────────────▼──────────────────────────────────────┐
│ SENSE                                                                        │
│                                                                              │
│ Messages ───► Sensors ───► Sentiment ───► Triggers ───► Workflows            │
│ Telegram      own state    LLM analysis   collect       trigger              │
│ fetch         operator     of messages    emotion       evaluation           │
│               weather                     + relational                       │
│               git                         patterns                           │
│               health                                                         │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ senseResult
┌───────────────────────────────────────▼──────────────────────────────────────┐
│ FEEL                                                                         │
│                                                                              │
│ ┌─ Affect ─────────────────────────────────────────────────────────────────┐ │
│ │ Emotion ───► Momentum ───► Afterglow ───► Dream Glow ───► Altered        │ │
│ │ compute      EMA blend     lingering      emotional       substance      │ │
│ │ from raw     + inertia     effects        residue         modifiers      │ │
│ │ triggers                                                                 │ │
│ │                                                                          │ │
│ │ ───► Drives ───► Soma ───► Nostalgia                                     │ │
│ │      satisfied   body      old memory                                    │ │
│ │      blocked     state     triggers                                      │ │
│ │      frustrated                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Relational ─────────────────────────────────────────────────────────────┐ │
│ │ Operator Model ───► Attachment ───► Vulnerability ───► Shame             │ │
│ │ profile + mood      dynamics        window open?       rejection         │ │
│ │ corrections         reunion         message style      tracking          │ │
│ │ trigger learning                                                         │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Self ───────────────────────────────────────────────────────────────────┐ │
│ │ Instinct ───► Dissonance ───► Deception ───► Held-Back Buffer            │ │
│ │ System 1      value-action    hidden         suppressed                  │ │
│ │ impulse       mismatch        drivers        thoughts                    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Perception ─────────────────────────────────────────────────────────────┐ │
│ │ Novelty ───► Anticipation ───► Subjective Time                           │ │
│ │ surprise     expectations      temporal                                  │ │
│ │ detection    violations        distortion                                │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Integration ────────────────────────────────────────────────────────────┐ │
│ │ 19 Secondary Emotions ───► Register ───► Attention ───► Boundaries       │ │
│ │ factory-computed           hysteresis    focus          psychological    │ │
│ │ cross-coupled              switching     state          enforcement      │ │
│ │                                                                          │ │
│ │ ───► Coherence ───► Metacognition ───► Creative Urge                     │ │
│ │      integration    self-reflective    expression                        │ │
│ │      monitoring     awareness          drive                             │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ feelResult
┌───────────────────────────────────────▼──────────────────────────────────────┐
│ DELIBERATE                                                                   │
│                                                                              │
│ Context ───► Habits ───► Polyphony ───► Override? ───► Impulse ───► LLM      │
│ build full   automatic   2-round        instinct       contextual   System 2 │
│ prompt       responses   dialog         ~1-2%          LLM-gen      action   │
│ + identity               + dominance    of ticks       thought               │
│                                                                              │
│ ───► Conflict ───► Sub-Think                                                 │
│      instinct      dream / morning / reflect / social media / creativity     │
│      vs reason                                                               │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ decision
┌───────────────────────────────────────▼──────────────────────────────────────┐
│ ACT                                                                          │
│                                                                              │
│ Guardian ───► Messages ───► Action ───► Persistence ───► Lifecycle           │
│ validate      typing sim    reflect     emotion          sleep / wake        │
│ block         split+send    evolve      psyche           spontaneous         │
│ warn          via Telegram  dream       narrative        events              │
│ privacy       + share on X  morning     episode                              │
│ check         + creativity  goal        relationship                         │
│                             social      self-concept                         │
│                             workflow    growth arcs                          │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ expectsReply?
                 re-enter SENSE ◄───────┴───────►┌─────────────────────────────┐
                                  yes        no  │ MAINTAIN                    │
                                                 │                             │
                                                 │ attachment style drift      │
                                                 │ relationship phase tracking │
                                                 │ mood baseline update        │
                                                 │ somatic recharge            │
                                                 │ habit tracking              │
                                                 │ idiolect drift              │
                                                 │ opinion drift               │
                                                 │ boundary formation          │
                                                 │ guardian drift check        │
                                                 │ relational memory           │
                                                 │ logging                     │
                                                 └─────────────────────────────┘
```

### Data Layer

```
┌──────────────────────────────────────────────────────┐
│                    External World                    │
│  Telegram · Weather · GitHub · X · Email · Calendar  │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│                  Consciousness Core                  │
│     SENSE → FEEL → DELIBERATE → ACT → MAINTAIN       │
└──────────┬──────────────────┬───────────────┬────────┘
           │                  │               │
┌──────────▼────────┐ ┌───────▼──────┐ ┌──────▼────────┐
│ Working Memory    │ │ Episodic     │ │ Semantic      │
│ (Redis)           │ │ Memory       │ │ Memory        │
│                   │ │ (Vector)     │ │ (Postgres)    │
│ emotion, soma,    │ │              │ │               │
│ momentum,         │ │ episodes     │ │ knowledge     │
│ drives, shame,    │ │ dreams       │ │ goals         │
│ conversation,     │ │ reflections  │ │ evolution     │
│ attachment,       │ │ relations    │ │ narrative     │d
│ vulnerability,    │ │ humor        │ │ psyche        │
│ operator model,   │ │              │ │ history logs  │
│ dissonance,       │ │              │ │               │
│ coherence,        │ │              │ │               │
│ metacognition,    │ │              │ │               │
│ anticipation,     │ │              │ │               │
│ novelty,          │ │              │ │               │
│ boundaries,       │ │              │ │               │
│ held-back buffer, │ │              │ │               │
│ creative urge,    │ │              │ │               │
│ dream afterglow   │ │              │ │               │
└───────────────────┘ └──────────────┘ └───────────────┘

Cross-cutting: Guardian · Trust · Personality · Emotion Factory · Altered States
```

## Project Structure

```
src/
├── infra/                    # Infrastructure layer
│   ├── config/               #   Environment and constants
│   ├── db/                   #   Drizzle schema and migrations
│   ├── lib/                  #   Shared utilities (logger, math, state, time)
│   └── integrations/         #   Redis, Telegram, GitHub, X, IMAP, CalDAV, Sentry
│
├── core/                     # Shared kernel (LLM interface, budget)
│
├── affect/                   # Affective systems
│   ├── emotion/              #   26-dimension emotion engine with factory pattern
│   ├── soma/                 #   Somatic markers (7-dimension body state)
│   ├── drive/                #   Motivational drives (autonomy, mastery, connection)
│   └── altered/              #   Pharmacokinetic substance modeling
│
├── cognition/                # Cognitive systems
│   ├── polyphony/            #   6 inner voices with dominance tracking
│   ├── attention.ts          #   Attention and focus state
│   ├── habit.ts              #   Cognitive habit detection
│   └── metacognition.ts      #   Self-reflective awareness
│
├── self/                     # Self and identity
│   ├── psyche/               #   Self-concept, narrative, held-back thoughts
│   ├── dissonance/           #   Cognitive dissonance detection and resolution
│   ├── deception/            #   Self-deception tracking
│   ├── coherence/            #   Psychological integration monitoring
│   ├── boundaries/           #   Psychological boundary enforcement
│   ├── personality/          #   MBTI profiles and personality types
│   └── genesis/              #   Seed-based personality DNA generation
│
├── relational/               # Relationship systems
│   ├── attachment/           #   Attachment style dynamics and vulnerability
│   ├── trust/                #   Trust computation
│   └── mind/                 #   Operator theory of mind
│
├── perception/               # Perceptual systems
│   ├── novelty/              #   Novelty detection and surprise
│   ├── anticipation/         #   Expectation management
│   ├── time/                 #   Subjective time perception
│   ├── distortion/           #   Memory distortion during recall
│   ├── pace.ts               #   Circadian rhythm and temporal pacing
│   └── sensors.ts            #   Environmental sensor aggregation
│
├── memory/                   # Three-layer memory system
│
├── consciousness/            # Orchestration (heartbeat loop and phases)
│
├── expression/               # Output systems
│   ├── communication/        #   Messaging, typing simulation, register, idiolect
│   ├── creativity/           #   Creative output generation
│   ├── image/                #   Vision and self-portrait generation
│   ├── routine/              #   Morning calibration and reflection
│   └── dream/                #   Dream cycle and afterglow
│
├── governance/               # Self-governance
│   ├── evolution/            #   Curiosity-driven self-evolution
│   ├── workflow/             #   Custom automation engine
│   ├── security/             #   Guardian, privacy, injection defense
│   └── health/               #   Health checks and drift detection
│
├── prompts/                  # Static system prompt templates
├── test/                     # Shared test factories and mocks
└── trigger/                  # Trigger.dev task definitions
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
