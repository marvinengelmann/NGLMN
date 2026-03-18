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
│ ┌─ Cognition ──────────────────────────────────────────────────────────────┐ │
│ │ Free Energy ───► 12 Biases ───► Regulation ───► Dissociation             │ │
│ │ 9 PE channels    negativity     8 strategies    trait-modulated          │ │
│ │ bidirectional    attribution    resource        depth + symptoms         │ │
│ │ KL-proxy         projection     competition                              │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Integration ────────────────────────────────────────────────────────────┐ │
│ │ 20 Secondary Emotions ───► Register ───► Attention ───► Boundaries       │ │
│ │ factory-computed           hysteresis    focus +        psychological    │ │
│ │ cross-coupled              switching     fatigue        enforcement      │ │
│ │                                                                          │ │
│ │ ───► Coherence ───► Metacognition ───► Creative Urge                     │ │
│ │      fragmentation  self-reflective    expression                        │ │
│ │      interactions   awareness          drive                             │ │
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
                 re-enter SENSE ◄───────┤
                                  yes   │ no
┌───────────────────────────────────────▼──────────────────────────────────────┐
│ MAINTAIN                                                                     │
│                                                                              │
│ Attachment ───► Relationship ───► Mood Baseline ───► Somatic Recharge        │
│ style drift     phase tracking    EMA update         energy + battery        │
│                                                                              │
│ Habit ───► Idiolect ───► Opinion ───► Boundary ───► Guardian Drift           │
│ tracking   drift         drift        formation     check                    │
│                                                                              │
│ Relational ───► Hebbian ───► Pattern ───► Forecast ───► Personality          │
│ memory          STDP-lite    decay        resolve       Big Five drift       │
│                 + dopamine                                                   │
│                                                                              │
│ Precision ───► Goal Decay ───► Autobiography ───► Logging                    │
│ dynamics       exponential     consolidation      tick summary               │
│ update         half-life                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
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
┌──────────▼────────┐ ┌───────▼─────┐ ┌───────▼────────┐
│ Working Memory    │ │ Episodic    │ │ Semantic       │
│ (Redis)           │ │ Memory      │ │ Memory         │
│                   │ │ (Vector)    │ │ (Postgres)     │
│ emotion, soma,    │ │             │ │                │
│ momentum,         │ │ episodes    │ │ knowledge      │
│ drives, shame,    │ │ dreams      │ │ goals          │
│ conversation,     │ │ reflections │ │ goal lifecycle │
│ attachment,       │ │ relations   │ │ evolution      │
│ vulnerability,    │ │ humor       │ │ narrative      │
│ operator model,   │ │             │ │ psyche         │
│ dissonance,       │ │             │ │ interaction    │
│ coherence,        │ │             │ │ outcomes       │
│ metacognition,    │ │             │ │ conversation   │
│ anticipation,     │ │             │ │ arcs           │
│ novelty,          │ │             │ │ entities +     │
│ boundaries,       │ │             │ │ relations      │
│ held-back buffer, │ │             │ │ procedures     │
│ creative urge,    │ │             │ │ lessons        │
│ dream afterglow,  │ │             │ │ history logs   │
│ neuromodulation,  │ │             │ │                │
│ free energy +     │ │             │ │                │
│ prior state,      │ │             │ │                │
│ relational        │ │             │ │                │
│ patterns,         │ │             │ │                │
│ regulation,       │ │             │ │                │
│ dissociation,     │ │             │ │                │
│ ultradian rhythm  │ │             │ │                │
└───────────────────┘ └─────────────┘ └────────────────┘

Cross-cutting: Guardian · Trust · Personality · Emotion Factory · Altered States · FEP Precision
```
