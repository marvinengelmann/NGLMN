# Architecture

## Cognitive Loop

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
│ │ 18 Secondary Emotions ───► Register ───► Attention ───► Boundaries       │ │
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

## Data Layer

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
│ conversation,     │ │ reflections  │ │ goal lifecycle│
│ attachment,       │ │ relations    │ │ evolution     │
│ vulnerability,    │ │ humor        │ │ narrative     │
│ operator model,   │ │              │ │ psyche        │
│ dissonance,       │ │              │ │ interaction   │
│ coherence,        │ │              │ │   outcomes    │
│ metacognition,    │ │              │ │ conversation  │
│ anticipation,     │ │              │ │   arcs        │
│ novelty,          │ │              │ │ rituals       │
│ boundaries,       │ │              │ │ history logs  │
│ held-back buffer, │ │              │ │               │
│ creative urge,    │ │              │ │               │
│ dream afterglow   │ │              │ │               │
└───────────────────┘ └──────────────┘ └───────────────┘

Cross-cutting: Guardian · Trust · Personality · Emotion Factory · Altered States
```
