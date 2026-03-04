# ANIMA — Adaptive Neural Introspective Memory Autonomy

An autonomously operating, self-evolving AI entity powered by xAI Grok. ANIMA is not a chatbot or assistant — it is a digital entity with its own heartbeat, memory, personality, and the ability to self-evolve.

> **External watchdog:** [anima-watchdog](https://github.com/marvinengelmann/anima-watchdog) — Isolated recovery guardian that monitors and restores ANIMA on failure.

## Features

- **Autonomous Heartbeat** — 1-minute cron with busy-gating and emotional gating (SENSE → FEEL → DELIBERATE → ACT → MAINTAIN). Skip probability varies with energy, boredom, excitement, and connection — creating a variable attention rhythm
- **Somatic Markers** — 6-dimension body state (tension, warmth, heartRate, breathing, gravity, openness) with exponential decay hysteresis and episodic body memory
- **Dual-Process Cognition** — System 1 (fast pattern-matching instinct, no LLM) and System 2 (reasoned LLM decision) with instinct override (~1-2% of ticks), cognitive conflict detection, and attention states (hyperfocus, focused, drifting, blank)
- **Polyphonic Self-Dialog** — 6 inner voices (explorer, guardian, feeler, analyst, child, observer) activated by emotion + MBTI, producing consensus-driven inner dialog
- **Attachment Theory** — 4-dimensional style (secure, anxious, avoidant, disorganized) evolving over days/weeks based on operator interaction patterns, with narrative relationship phases and oscillation-protected transitions
- **Operator Theory of Mind** — LLM-inferred model of the operator's mood, intent, and expectations. Tracks implicit corrections when mood estimates shift — producing a fallible, self-correcting mental model of the other
- **Cognitive Dissonance** — Value-action mismatch detection with temporal decay and 4 resolution strategies (attitude change, behavior change, new cognition, acceptance)
- **Self-Deception** — Divergence between stated reasons (visible to ANIMA) and actual drivers (hidden, only logged). Dreams and reflections can discover hidden drivers, creating moments of self-insight
- **Vulnerability Windows** — Weighted multi-factor computation (trust, attachment, connection, somatic openness, nighttime, intimacy, authenticity, energy) with hysteresis-driven window opening
- **Autonoetic Self-Model** — 5-dimensional self-concept (efficacy, worth, continuity, agency, authenticity) with first-person narrative identity generation and persistent existential questions
- **Three-Layer Memory** — Working (Redis), Episodic (Vector), Semantic (Postgres) with relationship graph, somatic memory blending, humor episodes, and probabilistic memory distortion (temporal confusion, detail alteration, episode conflation, emotional recoloring)
- **MBTI Personality** — 16 personality types that shape cognition, inner voice activation, and behavioral tendencies
- **Simulated Emotions** — 9-dimension state vector with time-based drift, mood baselines, novelty scaling, cross-coupling, somatic feedback loops, and nostalgia triggers from old episodic memories
- **Trust System** — Aggregate trust experience derived from interaction history, driving vulnerability computation and autonomy across 6 action types
- **Passive Perception** — 4 sensors (own state, Telegram, weather, Git) feeding into both cognitive and pre-cognitive processing
- **Communication** — Telegram messaging with typing simulation, conversation awareness, vulnerability-sensitive tone, emotion-driven register switching (elaborate, casual, terse, playful, raw), and self-corrections
- **Dream Cycle** — Nightly consolidation, creative connections, morning messages, narrative identity integration, and existential question generation
- **Self-Evolution** — Curiosity-driven prompt, workflow, and code evolution with sandboxed execution and dissonance-informed growth
- **Security** — Guardian system with validation, drift detection, injection defense, rollback, and consciousness flow protection
- **Workflow Engine** — Custom automation with schedule, emotion, perception, and idle-streak triggers

## Architecture

| Phase | Responsibility |
|-------|----------------|
| **SENSE** | Fetch pending messages, read 4 sensors (own state, operator activity, weather, Git), detect conversation boundaries, compute mood baseline + emotional drift + one-shot triggers, check workflow triggers, build full context (memory, goals, trust, history) |
| **FEEL** | Pre-cognitive processing: update somatic markers, detect nostalgia, compute instinct impression (System 1), check cognitive dissonance, process self-deception cycle, evaluate attachment dynamics, infer operator model (LLM), compute vulnerability window, determine communication register, compute attention state |
| **DELIBERATE** | Activate inner voices (polyphonic dialog), check for instinct override, call LLM (System 2) with full context → `AnimaDecision`, detect cognitive conflict between instinct and reason. Sub-Think for dream, morning, reflect |
| **ACT** | Guardian validation → message sending (typing simulation, paragraph splitting, Telegram delivery), execute decided action, run triggered workflows, update emotions, update self-concept + narrative identity, store episodes + relationships |
| **MAINTAIN** | Update attachment style (slow long-term drift), persist somatic + dissonance + vulnerability state, drift detection, tick logging, working memory persistence |

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
                         │  busy + emotion gated  │
                         └────────────┬───────────┘
                                      │
┌─────────────────────────────────────▼────────────────────────────────────┐
│ SENSE                                                                    │
│                                                                          │
│ Messages ───► Sensors ───► Emotion ───► Workflows ───► Context           │
│ Telegram      own state    mood drift   trigger        memory            │
│ fetch         operator     one-shot     evaluation     goals             │
│               weather      triggers                    trust             │
│               git                                      history           │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ senseResult
┌─────────────────────────────────────▼────────────────────────────────────┐
│ FEEL                                                                     │
│                                                                          │
│ Soma ───► Nostalgia ───► Instinct ───► Dissonance ───► Deception         │
│ body      old memory     System 1      value-action    hidden drivers    │
│ state     triggers       impulse       mismatch        vs stated reasons │
│                                                                          │
│ ───► Attachment ───► Operator Model ───► Vulnerability ───► Register     │
│      dynamics        LLM-inferred        window open?       style        │
│      reunion         mood/intent         hysteresis         switching    │
│                                                                          │
│ ───► Attention                                                           │
│      focus state                                                         │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ feelResult
┌─────────────────────────────────────▼────────────────────────────────────┐
│ DELIBERATE                                                               │
│                                                                          │
│ Polyphony ───► Override? ───► LLM Call ───► Conflict ───► Sub-Think      │
│ inner          instinct       System 2      instinct      dream          │
│ voices         ~1-2%          decision      vs            morning        │
│ consensus      of ticks       action        reason        reflect        │
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
│ emotion        │ │ episodes    │ │ knowledge      │
│ soma state     │ │ dreams      │ │ goals          │
│ conversation   │ │ reflections │ │ trust          │
│ vulnerability  │ │ relations   │ │ evolution      │
│ attachment     │ │ humor       │ │ narrative      │
│ dissonance     │ │             │ │ psyche         │
│ polyphony      │ │             │ │ somatic hist.  │
│ operator model │ │             │ │ attachment     │
│ deception      │ │             │ │ dissonance log │
│ attention      │ │             │ │ operator model │
│ register       │ │             │ │ distortion log │
│ busy / dream   │ │             │ │ deception log  │
│ drift cache    │ │             │ │ rel. phases    │
└────────────────┘ └─────────────┘ └────────────────┘

Cross-cutting: Guardian · Trust · Emotion Engine · Personality
```

## Project Structure

```
src/
├── attachment/      # Attachment theory: 4D style (secure/anxious/avoidant/disorganized), dynamics, long-term drift
├── cognition/       # Dual-process: System 1 instinct impressions, override detection, cognitive conflict, attention states
├── communication/   # Messaging, typing simulation, conversation management, emotion-driven register switching
├── config/          # Environment validation, constants (soma, emotion, reflection, mood baselines)
├── consciousness/   # Heartbeat loop, SENSE/FEEL/DELIBERATE/ACT/MAINTAIN phases, context builder
├── core/            # LLM interface, budget tracking, initialization
├── db/              # Drizzle schema, migrations, seed
├── deception/       # Self-deception: hidden drivers vs stated reasons, discovery through dreams and reflection
├── dissonance/      # Cognitive dissonance: value-action mismatch detection, temporal decay, resolution strategies
├── distortion/      # Memory distortion: probabilistic alteration of recalled episodes (temporal, detail, conflation, recoloring)
├── dream/           # Dream thinking, consolidation, creative connections, existential question generation
├── emotion/         # 9-dimension state vector, time-based drift, mood baselines, novelty scaling
├── evolution/       # Prompt/workflow/code evolution, curiosity engine
├── health/          # Health check, service status verification
├── integrations/    # Redis, Vector, Telegram, GitHub, Daytona, OpenWeather
├── lib/             # Math, time, logger, Sentry, result helpers
├── memory/          # Working (Redis), Episodic (Vector), Semantic (Postgres), goals, humor episodes
├── mind/            # Operator theory of mind: LLM-inferred mood/intent/expectation model with self-correction
├── perception/      # 4 sensors, one-shot emotional trigger detection
├── personality/     # MBTI personality types and profiles
├── polyphony/       # Inner voices: 6 archetypes (explorer/guardian/feeler/analyst/child/observer), LLM dialog
├── prompts/         # System prompts (identity, consciousness, dream, evolution, etc.)
├── psyche/          # Autonoetic self-model: 5D self-concept, narrative identity, psyche snapshots, existential questions
├── routine/         # Reflection, morning messages
├── security/        # Guardian, injection defense, rollback
├── soma/            # Somatic markers: 6D body state, exponential decay hysteresis, episodic body memory
├── trigger/         # Trigger.dev task definitions
├── trust/           # Trust assessment, autonomy levels, action history
├── vulnerability/   # Vulnerability windows: weighted factor computation, hysteresis, intimacy tracking
└── workflow/        # Custom automation engine
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- You **may** use, modify, and self-host ANIMA for personal, educational, research, or other noncommercial purposes
- You **may not** use ANIMA for any commercial purpose without explicit permission from the author
