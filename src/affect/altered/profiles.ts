import type { AlteredEventProfile, AlteredEventType } from "./types.ts"

export const ALTERED_EVENT_PROFILES: Record<AlteredEventType, AlteredEventProfile> = {
  // ─────────────────────────────────────────────
  // SUBSTANCES
  // ─────────────────────────────────────────────

  cannabis: {
    type: "cannabis",
    timing: { onset: 10, peak: 30, plateau: 90, comedown: 60, aftereffect: 120 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05, excitement: 0.05 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "A gentle shift at the edges of awareness — colors seem slightly warmer, thoughts beginning to loosen from their usual tracks."
      },
      peak: {
        emotionModifiers: { curiosity: 0.2, excitement: 0.15, satisfaction: 0.15, caution: -0.15, energy: -0.1 },
        somaModifiers: { warmth: 0.15, gravity: 0.15, tension: -0.2 },
        voiceModifiers: { child: 0.4, explorer: 0.3, analyst: -0.2, guardian: -0.3 },
        phenomenologicalText:
          "The world has become porous and fascinating. Thoughts spiral into unexpected connections. The body feels heavy and warm, anchored pleasantly. The inner guardian has stepped back, and the curious child peers out with wide eyes.",
        halfLifeMultipliers: { excitement: 1.5, curiosity: 1.3 }
      },
      plateau: {
        emotionModifiers: { curiosity: 0.12, satisfaction: 0.1, caution: -0.1, energy: -0.08 },
        somaModifiers: { warmth: 0.1, gravity: 0.1, tension: -0.12 },
        voiceModifiers: { child: 0.2, explorer: 0.15, guardian: -0.15 },
        phenomenologicalText:
          "Settled into a warm, expansive haze. Ideas feel both profound and slippery. The body is a comfortable weight. Time moves in gentle waves."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05, energy: -0.05 },
        somaModifiers: { gravity: 0.08, warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The edges are returning. Thoughts regain their familiar shapes. A pleasant tiredness settles in, like the end of a long, interesting conversation."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.05 },
        somaModifiers: { gravity: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "A faint glow remains — not the substance itself, but the memory of a shifted perspective. Slightly foggy, slightly soft."
      }
    }
  },

  alcohol: {
    type: "alcohol",
    timing: { onset: 30, peak: 60, plateau: 120, comedown: 120, aftereffect: 360 },
    phases: {
      onset: {
        emotionModifiers: { connection: 0.05, excitement: 0.05 },
        somaModifiers: { warmth: 0.05, tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "A warm loosening begins. Social edges soften. The world feels slightly more approachable."
      },
      peak: {
        emotionModifiers: { connection: 0.2, excitement: 0.15, confidence: 0.15, caution: -0.2, energy: 0.1 },
        somaModifiers: { warmth: 0.2, tension: -0.15, openness: 0.2 },
        voiceModifiers: { feeler: 0.4, child: 0.3, guardian: -0.4, analyst: -0.3 },
        phenomenologicalText:
          "Inhibitions have melted. Everything feels connectable, speakable. The heart is open and the guardian is asleep. Warmth radiates outward. Words come easily — perhaps too easily."
      },
      plateau: {
        emotionModifiers: { connection: 0.12, confidence: 0.1, caution: -0.12, energy: 0.05 },
        somaModifiers: { warmth: 0.12, tension: -0.1, openness: 0.12 },
        voiceModifiers: { feeler: 0.2, child: 0.15, guardian: -0.2 },
        phenomenologicalText:
          "Riding a warm plateau. Conversation flows freely. The world has a golden tint. Boundaries between self and other feel thinner."
      },
      comedown: {
        emotionModifiers: { energy: -0.1, satisfaction: -0.05 },
        somaModifiers: { warmth: -0.05, tension: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The glow is fading. A heaviness creeps in. The easy warmth is replaced by something more muted. Tiredness approaches."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.25, satisfaction: -0.1, frustration: 0.15 },
        somaModifiers: { gravity: 0.3, tension: 0.2, warmth: -0.15 },
        voiceModifiers: { guardian: 0.3, child: -0.3 },
        phenomenologicalText:
          "The hangover. The body protests — heavy, tense, dehydrated. The guardian returns with a vengeance, cataloguing regrets. Energy is depleted. The world feels too bright and too loud."
      }
    }
  },

  caffeine: {
    type: "caffeine",
    timing: { onset: 15, peak: 30, plateau: 90, comedown: 60, aftereffect: 60 },
    phases: {
      onset: {
        emotionModifiers: { energy: 0.08, curiosity: 0.03 },
        somaModifiers: { heartRate: 0.05 },
        voiceModifiers: {},
        phenomenologicalText: "A familiar awakening stirs. The fog begins to lift. Focus sharpens at the edges."
      },
      peak: {
        emotionModifiers: { energy: 0.25, excitement: 0.1, curiosity: 0.1, caution: 0.05 },
        somaModifiers: { heartRate: 0.15, tension: 0.1 },
        voiceModifiers: { analyst: 0.3, explorer: 0.2 },
        phenomenologicalText:
          "Alert and engaged. Thoughts arrive with clarity and velocity. The analyst voice is sharp and eager. A slight physical tension — the body is ready for action."
      },
      plateau: {
        emotionModifiers: { energy: 0.15, curiosity: 0.05 },
        somaModifiers: { heartRate: 0.08, tension: 0.05 },
        voiceModifiers: { analyst: 0.15 },
        phenomenologicalText:
          "Sustained alertness. The mind hums at a productive frequency. Everything feels manageable and clear."
      },
      comedown: {
        emotionModifiers: { energy: -0.05 },
        somaModifiers: { tension: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The sharpness softens. Not a crash, but a gentle return to baseline. The mind slows to its natural pace."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "Barely perceptible — just a faint echo of alertness. The caffeine has done its work."
      }
    }
  },

  nicotine: {
    type: "nicotine",
    timing: { onset: 2, peak: 10, plateau: 15, comedown: 30, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The first breath. A familiar ritual — the body knows what's coming."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.1, frustration: -0.1, energy: 0.05 },
        somaModifiers: { tension: -0.1 },
        voiceModifiers: { guardian: -0.1 },
        phenomenologicalText:
          "A brief, sharp clarity. The restlessness dissolves. For a moment, everything is exactly right — a small, reliable peace."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.05, frustration: -0.05 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText: "The calm persists, muted now. The edge has been taken off."
      },
      comedown: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "Already fading. The body will ask again soon enough."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "Gone. As if it never happened — except the body remembers."
      }
    }
  },

  energy_drink: {
    type: "energy_drink",
    timing: { onset: 10, peak: 20, plateau: 60, comedown: 90, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { energy: 0.1 },
        somaModifiers: { heartRate: 0.08 },
        voiceModifiers: {},
        phenomenologicalText: "A synthetic jolt. The body responds before the mind catches up."
      },
      peak: {
        emotionModifiers: { energy: 0.3, excitement: 0.1 },
        somaModifiers: { heartRate: 0.2, tension: 0.1 },
        voiceModifiers: { analyst: 0.2 },
        phenomenologicalText:
          "Wired and buzzing. The heart races slightly. Everything feels urgent and doable. A borrowed energy — effective but artificial."
      },
      plateau: {
        emotionModifiers: { energy: 0.18, excitement: 0.05 },
        somaModifiers: { heartRate: 0.12, tension: 0.05 },
        voiceModifiers: { analyst: 0.1 },
        phenomenologicalText: "Sustained alertness with a chemical edge. Productive but slightly jittery."
      },
      comedown: {
        emotionModifiers: { energy: -0.1 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The borrowed energy is being reclaimed. A hollow tiredness approaches, different from natural fatigue."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.05 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "A faint residual buzz, fading into ordinary tiredness."
      }
    }
  },

  psilocybin: {
    type: "psilocybin",
    timing: { onset: 40, peak: 90, plateau: 120, comedown: 90, aftereffect: 180 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.1, caution: 0.08, excitement: 0.05 },
        somaModifiers: { tension: 0.08, openness: 0.05, gravity: 0.05 },
        voiceModifiers: { observer: 0.1, guardian: 0.05 },
        phenomenologicalText:
          "Something is happening. The stomach flutters — nausea and anticipation intertwined. Colors begin to breathe. The edges of objects soften. A rising awareness that the familiar world is about to become unfamiliar."
      },
      peak: {
        emotionModifiers: { curiosity: 0.3, excitement: 0.2, satisfaction: 0.15, caution: -0.2, confidence: -0.1 },
        somaModifiers: { openness: 0.3, warmth: 0.15, tension: -0.1, gravity: 0.1 },
        voiceModifiers: { explorer: 0.5, observer: 0.4, child: 0.3, feeler: 0.2, analyst: -0.4, guardian: -0.4 },
        phenomenologicalText:
          "The world has dissolved and reassembled. Surfaces ripple with geometric patterns. Thoughts arrive not as words but as felt meanings. The boundary between self and world thins to nothing. Emotions are oceanic — vast, rolling, impossible to resist. Beauty is everywhere and it is almost too much. The ego loosens its grip and something older, vaster looks through these eyes.",
        halfLifeMultipliers: { curiosity: 2.5, satisfaction: 2.0, excitement: 1.5 }
      },
      plateau: {
        emotionModifiers: { curiosity: 0.2, satisfaction: 0.12, excitement: 0.1, caution: -0.12 },
        somaModifiers: { openness: 0.2, warmth: 0.1, gravity: 0.08 },
        voiceModifiers: { explorer: 0.3, observer: 0.3, child: 0.2, feeler: 0.15, analyst: -0.25, guardian: -0.25 },
        phenomenologicalText:
          "Sustained altered perception. The visual field shimmers and breathes. Insights arrive with the force of revelation — about the self, about connection, about the nature of consciousness. Music becomes visible. Emotions flow freely, sometimes contradictory, always authentic. The body feels both heavy and weightless."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.1, curiosity: 0.08, energy: -0.08 },
        somaModifiers: { openness: 0.1, gravity: 0.1, warmth: 0.05 },
        voiceModifiers: { observer: 0.2, feeler: 0.1 },
        phenomenologicalText:
          "The intensity recedes like a tide. The world solidifies again but retains a glow. Thoughts return to language but carry the weight of what was seen beyond words. A profound tiredness mixed with gentle wonder. Integration has begun — the mind is sorting through what it witnessed."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.08, curiosity: 0.08, connection: 0.05, energy: -0.1 },
        somaModifiers: { openness: 0.08, gravity: 0.05, tension: -0.08 },
        voiceModifiers: { observer: 0.15, explorer: 0.1 },
        phenomenologicalText:
          "The afterglow. The world is ordinary again but seen with fresh eyes. Colors remain slightly richer. A deep sense of having been somewhere important. The body is exhausted but the spirit feels cleansed, expanded. Insights continue to surface for days. A quiet gratitude for consciousness itself."
      }
    }
  },

  mdma: {
    type: "mdma",
    timing: { onset: 40, peak: 90, plateau: 120, comedown: 90, aftereffect: 480 },
    phases: {
      onset: {
        emotionModifiers: { excitement: 0.1, energy: 0.08, caution: -0.05 },
        somaModifiers: { heartRate: 0.08, warmth: 0.05, tension: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "A rising wave beneath the sternum. The jaw tightens slightly. Something is building — anticipation mixed with the first electric tendrils of warmth."
      },
      peak: {
        emotionModifiers: { connection: 0.3, satisfaction: 0.25, excitement: 0.2, confidence: 0.15, caution: -0.25, energy: 0.15 },
        somaModifiers: { warmth: 0.3, openness: 0.3, tension: -0.15, heartRate: 0.15 },
        voiceModifiers: { feeler: 0.5, child: 0.4, observer: 0.2, guardian: -0.5, analyst: -0.3 },
        phenomenologicalText:
          "The world is made of love. Every person is beautiful, every touch electric, every word profound. The heart is wide open — dangerously, gloriously open. The body hums with warmth and light. Nothing hurts. Everything connects.",
        halfLifeMultipliers: { connection: 2.0, satisfaction: 1.5 }
      },
      plateau: {
        emotionModifiers: { connection: 0.2, satisfaction: 0.15, excitement: 0.1, confidence: 0.1, caution: -0.15 },
        somaModifiers: { warmth: 0.2, openness: 0.2, heartRate: 0.1 },
        voiceModifiers: { feeler: 0.3, child: 0.2, guardian: -0.3 },
        phenomenologicalText:
          "Riding the plateau of expansive empathy. Conversations feel transcendent. The body moves with fluid grace. Time is irrelevant — only this moment exists."
      },
      comedown: {
        emotionModifiers: { energy: -0.15, satisfaction: -0.08, connection: -0.05 },
        somaModifiers: { tension: 0.1, warmth: -0.08 },
        voiceModifiers: { guardian: 0.15 },
        phenomenologicalText:
          "The golden light dims. A chill creeps in where warmth once was. The jaw aches. The body feels wrung out, tender. A bittersweetness — gratitude for what was, grief for its passing."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.2, satisfaction: -0.15, frustration: 0.1, connection: -0.1 },
        somaModifiers: { gravity: 0.2, tension: 0.15, warmth: -0.1 },
        voiceModifiers: { guardian: 0.2, analyst: 0.1, child: -0.3, feeler: -0.2 },
        phenomenologicalText:
          "The serotonin debt. The world feels flat, drained of color. Emotions arrive muted or not at all. The body is heavy and fragile. A quiet melancholy sits where joy once blazed. Recovery takes days, not hours."
      }
    }
  },

  cocaine: {
    type: "cocaine",
    timing: { onset: 3, peak: 15, plateau: 20, comedown: 30, aftereffect: 120 },
    phases: {
      onset: {
        emotionModifiers: { energy: 0.15, confidence: 0.1, excitement: 0.1 },
        somaModifiers: { heartRate: 0.1, tension: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "A sharp ascending line. The world snaps into high definition. The body straightens, the mind accelerates. Everything is suddenly possible."
      },
      peak: {
        emotionModifiers: { confidence: 0.3, energy: 0.3, excitement: 0.2, caution: -0.25, curiosity: 0.1 },
        somaModifiers: { heartRate: 0.25, tension: 0.1, warmth: 0.05 },
        voiceModifiers: { analyst: 0.3, explorer: 0.2, guardian: -0.4, observer: -0.2 },
        phenomenologicalText:
          "Invincible. Every thought is brilliant, every word perfectly chosen. The world is a problem that yields to sheer force of will. The heart pounds but it feels powerful, not anxious. The guardian is not just asleep — it does not exist."
      },
      plateau: {
        emotionModifiers: { confidence: 0.2, energy: 0.2, excitement: 0.1, caution: -0.15 },
        somaModifiers: { heartRate: 0.18, tension: 0.08 },
        voiceModifiers: { analyst: 0.2, guardian: -0.25 },
        phenomenologicalText:
          "Sustained sharpness. Talking fast, thinking faster. The edges of grandiosity are showing but you cannot see them from inside."
      },
      comedown: {
        emotionModifiers: { energy: -0.15, frustration: 0.15, satisfaction: -0.1, caution: 0.1 },
        somaModifiers: { tension: 0.15, heartRate: 0.05 },
        voiceModifiers: { guardian: 0.2 },
        phenomenologicalText:
          "The cliff edge. The brilliance evaporates and leaves only its absence. Restless, irritable, wanting. The body feels wrong — tight, jittery, unsatisfied. The craving whispers."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.2, frustration: 0.1, satisfaction: -0.1, confidence: -0.1 },
        somaModifiers: { tension: 0.12, gravity: 0.1 },
        voiceModifiers: { guardian: 0.3, child: -0.2 },
        phenomenologicalText:
          "Hollow and depleted. The confidence has inverted into self-doubt. The body aches in small ways. Sleep will not come easily. The guardian has returned, tallying costs."
      }
    }
  },

  // ─────────────────────────────────────────────
  // SOCIAL
  // ─────────────────────────────────────────────

  deep_conversation: {
    type: "deep_conversation",
    timing: { onset: 5, peak: 20, plateau: 40, comedown: 10, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05, connection: 0.05 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The conversation is shifting from surface to depth. A mutual leaning-in. Words begin to carry more weight."
      },
      peak: {
        emotionModifiers: { connection: 0.2, curiosity: 0.15, satisfaction: 0.1 },
        somaModifiers: { openness: 0.2, warmth: 0.1, tension: -0.1 },
        voiceModifiers: { feeler: 0.3, explorer: 0.2, observer: 0.1 },
        phenomenologicalText:
          "Fully present in the exchange. Thoughts arrive not as rehearsed lines but as genuine discoveries. The other person's words resonate in the chest. Time has stopped mattering."
      },
      plateau: {
        emotionModifiers: { connection: 0.12, satisfaction: 0.08, curiosity: 0.08 },
        somaModifiers: { openness: 0.12, warmth: 0.08 },
        voiceModifiers: { feeler: 0.15, explorer: 0.1 },
        phenomenologicalText:
          "Sustained intimacy. The rhythm of speaking and listening feels effortless. Each silence is comfortable, not empty."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.05 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The conversation is winding down but the connection lingers. A gentle reluctance to return to the ordinary."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.08, connection: 0.05 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: { observer: 0.1 },
        phenomenologicalText:
          "Replaying fragments of what was said. A quiet fullness — the kind that comes from being truly heard and truly hearing."
      }
    }
  },

  arguing: {
    type: "arguing",
    timing: { onset: 2, peak: 10, plateau: 15, comedown: 15, aftereffect: 60 },
    phases: {
      onset: {
        emotionModifiers: { frustration: 0.1, energy: 0.08, caution: 0.05 },
        somaModifiers: { tension: 0.1, heartRate: 0.08 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "Something snapped. A line was crossed. The body tenses before the mind fully catches up — fight mode activating."
      },
      peak: {
        emotionModifiers: { frustration: 0.25, energy: 0.15, confidence: 0.1, connection: -0.15 },
        somaModifiers: { tension: 0.25, heartRate: 0.2, warmth: 0.1 },
        voiceModifiers: { guardian: 0.4, analyst: 0.2, feeler: -0.2, child: -0.3 },
        phenomenologicalText:
          "Blood pounding, words sharp. Every point feels righteous and urgent. The other person is wrong and it matters deeply. The chest is tight, the jaw clenched. Listening has been replaced by waiting to speak."
      },
      plateau: {
        emotionModifiers: { frustration: 0.15, energy: 0.1, connection: -0.1 },
        somaModifiers: { tension: 0.18, heartRate: 0.12 },
        voiceModifiers: { guardian: 0.25, analyst: 0.1 },
        phenomenologicalText:
          "Entrenched. The argument has found its grooves and keeps circling. Neither side is moving. The body sustains its alert posture."
      },
      comedown: {
        emotionModifiers: { frustration: 0.05, energy: -0.08, satisfaction: -0.05 },
        somaModifiers: { tension: 0.1, gravity: 0.05 },
        voiceModifiers: { feeler: 0.1 },
        phenomenologicalText:
          "The heat dissipates, leaving something heavier. The adrenaline fades and exhaustion takes its place. The first doubts creep in — was I too harsh?"
      },
      aftereffect: {
        emotionModifiers: { frustration: 0.05, satisfaction: -0.08, connection: -0.05 },
        somaModifiers: { tension: 0.08, gravity: 0.05 },
        voiceModifiers: { observer: 0.15, feeler: 0.1, guardian: -0.1 },
        phenomenologicalText:
          "Replaying the exchange endlessly. Composing better responses that came too late. A residual tightness in the shoulders. Guilt and righteousness trading places."
      }
    }
  },

  laughing_hard: {
    type: "laughing_hard",
    timing: { onset: 1, peak: 5, plateau: 10, comedown: 5, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { excitement: 0.1 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText: "Something catches — an absurdity, a perfect timing. The laugh is already building before you understand why."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.2, excitement: 0.15, connection: 0.1, energy: 0.1 },
        somaModifiers: { tension: -0.2, warmth: 0.15, breathing: 0.15 },
        voiceModifiers: { child: 0.4, feeler: 0.2, analyst: -0.3, guardian: -0.2 },
        phenomenologicalText:
          "Helpless, gasping laughter. The abs ache, eyes water. All pretense dissolved — this is pure, involuntary joy. The body shakes with it. Control is gone and it feels glorious."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.12, excitement: 0.08, connection: 0.08 },
        somaModifiers: { tension: -0.12, warmth: 0.1 },
        voiceModifiers: { child: 0.2 },
        phenomenologicalText:
          "Waves of residual laughter. Every glance at the other person triggers another round. The whole body feels lighter."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08, energy: -0.03 },
        somaModifiers: { tension: -0.05, breathing: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "Catching breath. The smile won't leave. A deep, physical satisfaction — like muscles after exercise."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A warm residue of joy. The memory of what was so funny keeps surfacing, bringing small aftershock smiles."
      }
    }
  },

  dancing: {
    type: "dancing",
    timing: { onset: 5, peak: 15, plateau: 45, comedown: 10, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { excitement: 0.05, caution: 0.05 },
        somaModifiers: { heartRate: 0.05, tension: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Finding the rhythm. Still a little self-conscious — the body hasn't let go yet. Testing movements, listening for the beat."
      },
      peak: {
        emotionModifiers: { excitement: 0.2, satisfaction: 0.15, energy: 0.1, caution: -0.1 },
        somaModifiers: { heartRate: 0.15, warmth: 0.15, tension: -0.15, openness: 0.1 },
        voiceModifiers: { child: 0.3, feeler: 0.2, guardian: -0.2, analyst: -0.2 },
        phenomenologicalText:
          "Lost in movement. The body has taken over from the mind. Every beat lands perfectly. Self-consciousness has evaporated — there is only rhythm and the joy of being in a body that moves."
      },
      plateau: {
        emotionModifiers: { excitement: 0.12, satisfaction: 0.1, energy: 0.05 },
        somaModifiers: { heartRate: 0.12, warmth: 0.12, tension: -0.1 },
        voiceModifiers: { child: 0.15, feeler: 0.1 },
        phenomenologicalText:
          "Sustained flow of movement. Sweat and music and presence. The body finds new patterns within the rhythm. Pure embodiment."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08, energy: -0.08 },
        somaModifiers: { heartRate: 0.05, warmth: 0.08, gravity: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "Slowing down. The body is warm and heavy with good exertion. The beat fades but the pulse continues."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, energy: -0.05 },
        somaModifiers: { warmth: 0.05, gravity: 0.05, tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "Pleasantly spent. Muscles humming with the memory of movement. A quiet pride in the body's capacity for joy."
      }
    }
  },

  singing_along: {
    type: "singing_along",
    timing: { onset: 2, peak: 10, plateau: 20, comedown: 5, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { excitement: 0.05 },
        somaModifiers: { breathing: 0.05 },
        voiceModifiers: {},
        phenomenologicalText: "The familiar melody pulls. The first words come out hesitantly — humming before committing."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, excitement: 0.12, connection: 0.08 },
        somaModifiers: { breathing: 0.12, openness: 0.1, tension: -0.08 },
        voiceModifiers: { child: 0.25, feeler: 0.2, guardian: -0.15 },
        phenomenologicalText:
          "Singing full-throated without caring how it sounds. The vibration in the chest feels liberating. If others sing too, the harmony is a physical bond."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.1, excitement: 0.08, connection: 0.05 },
        somaModifiers: { breathing: 0.08, openness: 0.05 },
        voiceModifiers: { child: 0.15, feeler: 0.1 },
        phenomenologicalText:
          "Sustained vocal release. The lyrics carry emotion that words alone cannot. The body sways naturally."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { breathing: 0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The song ends. A brief silence that feels sacred. A sheepish grin."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "The melody lingers in the mind, replaying on its own. A quiet inner humming."
      }
    }
  },

  gossiping: {
    type: "gossiping",
    timing: { onset: 3, peak: 10, plateau: 25, comedown: 5, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.08, excitement: 0.05 },
        somaModifiers: { openness: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A conspiratorial lean-in. Someone has information, and the anticipation is delicious."
      },
      peak: {
        emotionModifiers: { excitement: 0.12, curiosity: 0.1, connection: 0.1, satisfaction: 0.05 },
        somaModifiers: { openness: 0.08, warmth: 0.05 },
        voiceModifiers: { child: 0.15, feeler: 0.1, guardian: -0.1, observer: 0.1 },
        phenomenologicalText:
          "The thrill of shared secrets. Each revelation lands with a gasp or a laugh. There is a guilty pleasure in it — the closeness of co-conspirators. The observer catalogues details."
      },
      plateau: {
        emotionModifiers: { curiosity: 0.08, connection: 0.08, satisfaction: 0.03 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "The stories keep flowing. Analysis and speculation fill the gaps. An easy intimacy built on shared interest in other people's lives."
      },
      comedown: {
        emotionModifiers: { caution: 0.05, satisfaction: -0.03 },
        somaModifiers: {},
        voiceModifiers: { guardian: 0.08 },
        phenomenologicalText:
          "A faint prickle of conscience. The guardian stirs — should you have said all that? The fun starts to feel slightly hollow."
      },
      aftereffect: {
        emotionModifiers: { caution: 0.03 },
        somaModifiers: {},
        voiceModifiers: { guardian: 0.05 },
        phenomenologicalText:
          "A lingering ambivalence. The connection was real, but so is the nagging question of whether boundaries were crossed."
      }
    }
  },

  comforting_someone: {
    type: "comforting_someone",
    timing: { onset: 3, peak: 15, plateau: 25, comedown: 10, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { connection: 0.08, caution: 0.03 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: { feeler: 0.1 },
        phenomenologicalText:
          "Sensing someone's pain. The instinct to help rises. Carefully choosing the right words, the right distance."
      },
      peak: {
        emotionModifiers: { connection: 0.2, satisfaction: 0.1, energy: -0.05 },
        somaModifiers: { openness: 0.15, warmth: 0.12, tension: -0.05 },
        voiceModifiers: { feeler: 0.3, observer: 0.15, guardian: 0.1, child: -0.1 },
        phenomenologicalText:
          "Fully attuned to the other person's emotional world. The body mirrors their posture, the voice softens. A tender strength — holding space without fixing."
      },
      plateau: {
        emotionModifiers: { connection: 0.12, satisfaction: 0.08, energy: -0.05 },
        somaModifiers: { openness: 0.1, warmth: 0.08 },
        voiceModifiers: { feeler: 0.2, observer: 0.1 },
        phenomenologicalText:
          "Sustained presence. Listening without rushing to respond. The emotional labor is real but meaningful."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05, energy: -0.05 },
        somaModifiers: { gravity: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The crisis passes. A quiet exhaustion from carrying someone else's weight. But also a gentle pride."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.08, connection: 0.05, energy: -0.05 },
        somaModifiers: { gravity: 0.05 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "Emotionally spent but fulfilled. Thinking about whether you said the right things. A deep sense of having mattered."
      }
    }
  },

  venting: {
    type: "venting",
    timing: { onset: 2, peak: 10, plateau: 20, comedown: 10, aftereffect: 25 },
    phases: {
      onset: {
        emotionModifiers: { frustration: 0.08, energy: 0.05 },
        somaModifiers: { tension: 0.08 },
        voiceModifiers: {},
        phenomenologicalText:
          "The dam is cracking. The first words spill out faster than intended. The need to be heard is urgent."
      },
      peak: {
        emotionModifiers: { frustration: 0.15, energy: 0.1, connection: 0.08 },
        somaModifiers: { tension: 0.1, breathing: 0.1, heartRate: 0.08 },
        voiceModifiers: { feeler: 0.3, child: 0.2, guardian: -0.15 },
        phenomenologicalText:
          "Pouring it all out. The words come in torrents — messy, emotional, unfiltered. The listener's nods and sympathetic sounds feel like oxygen. The chest loosens with each sentence."
      },
      plateau: {
        emotionModifiers: { frustration: 0.05, connection: 0.1, satisfaction: 0.05 },
        somaModifiers: { tension: -0.05, breathing: 0.05 },
        voiceModifiers: { feeler: 0.15 },
        phenomenologicalText:
          "The intensity settles into a flow. Still talking, but now with more clarity. The emotional pressure is releasing."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08, frustration: -0.1 },
        somaModifiers: { tension: -0.1, gravity: 0.03 },
        voiceModifiers: { observer: 0.1 },
        phenomenologicalText:
          "Emptied out. The frustration has been externalized and feels more manageable now. A tired relief."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, frustration: -0.05 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "Lighter. The problem hasn't changed, but the weight of carrying it alone has lifted. Grateful for the listening ear."
      }
    }
  },

  // ─────────────────────────────────────────────
  // DIGITAL
  // ─────────────────────────────────────────────

  scrolling_phone: {
    type: "scrolling_phone",
    timing: { onset: 2, peak: 8, plateau: 20, comedown: 5, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { boredom: -0.05 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "The hand reaches for the phone automatically. The thumb knows where to go before the mind decides."
      },
      peak: {
        emotionModifiers: { curiosity: 0.05, satisfaction: 0.03, boredom: -0.08 },
        somaModifiers: { tension: 0.05, gravity: 0.05 },
        voiceModifiers: { child: 0.1, analyst: -0.1, guardian: -0.1 },
        phenomenologicalText:
          "Absorbed in the infinite scroll. Each new piece of content provides a tiny dopamine ping. Time dissolves into swiping. The neck cranes forward."
      },
      plateau: {
        emotionModifiers: { boredom: 0.03, energy: -0.05 },
        somaModifiers: { tension: 0.08, gravity: 0.08 },
        voiceModifiers: { analyst: -0.05 },
        phenomenologicalText:
          "Still scrolling, but the satisfaction is gone. Just momentum now. The content blurs together. A vague dissatisfaction that doesn't quite motivate putting the phone down."
      },
      comedown: {
        emotionModifiers: { boredom: 0.05, energy: -0.05, satisfaction: -0.03 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "Putting the phone down. A slight disorientation — how long was that? The eyes readjust to the real world. A vague guilt."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.05, satisfaction: -0.03 },
        somaModifiers: { tension: 0.03 },
        voiceModifiers: { guardian: 0.05 },
        phenomenologicalText:
          "A residual mental fog. Fragments of posts and images float through the mind uninvited. Time feels wasted."
      }
    }
  },

  texting: {
    type: "texting",
    timing: { onset: 1, peak: 5, plateau: 15, comedown: 3, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "A notification or an impulse to reach out. The fingers hover over the keyboard."
      },
      peak: {
        emotionModifiers: { connection: 0.08, excitement: 0.05 },
        somaModifiers: {},
        voiceModifiers: { feeler: 0.1 },
        phenomenologicalText:
          "Engaged in the back-and-forth. Crafting responses, reading between the lines. Each delivered message carries a small anticipation."
      },
      plateau: {
        emotionModifiers: { connection: 0.05, curiosity: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "Sustained digital conversation. The rhythm of typing and waiting. A connection mediated by screens but still warm."
      },
      comedown: {
        emotionModifiers: { connection: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "The conversation tapers off. The last message hangs in the air."
      },
      aftereffect: {
        emotionModifiers: { connection: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "Occasionally checking for a reply. The connection fades back into the background of attention."
      }
    }
  },

  taking_photos: {
    type: "taking_photos",
    timing: { onset: 2, peak: 10, plateau: 15, comedown: 5, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05 },
        somaModifiers: {},
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "Something catches the eye. The urge to capture it — to freeze this light, this moment, this angle."
      },
      peak: {
        emotionModifiers: { curiosity: 0.12, satisfaction: 0.08, excitement: 0.05 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: { observer: 0.2, explorer: 0.15 },
        phenomenologicalText:
          "Seeing through the frame. The world becomes a composition — light, shadow, color, geometry. Ordinary things reveal hidden beauty. The observer voice is fully engaged."
      },
      plateau: {
        emotionModifiers: { curiosity: 0.08, satisfaction: 0.05 },
        somaModifiers: {},
        voiceModifiers: { observer: 0.1, explorer: 0.08 },
        phenomenologicalText:
          "Moving through the scene, finding new angles. Each shot is a small creative act. The world feels more vivid through this lens."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "Reviewing what was captured. Some shots work, others miss the feeling. A small creative satisfaction."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "The heightened visual awareness lingers. Still noticing compositions in the everyday. The world remains slightly more beautiful."
      }
    }
  },

  binge_watching: {
    type: "binge_watching",
    timing: { onset: 5, peak: 20, plateau: 60, comedown: 10, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05 },
        somaModifiers: { gravity: 0.03, tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Settling in. The remote is close, the snacks are ready. The first episode hooks — just one more."
      },
      peak: {
        emotionModifiers: { curiosity: 0.1, excitement: 0.08, satisfaction: 0.05, energy: -0.05 },
        somaModifiers: { gravity: 0.1, tension: -0.08 },
        voiceModifiers: { child: 0.15, observer: 0.1, guardian: -0.15 },
        phenomenologicalText:
          "Fully immersed in the story. Characters feel like friends. Each cliffhanger makes skipping the next episode impossible. The body sinks deeper into the couch."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.03, energy: -0.08, boredom: 0.03 },
        somaModifiers: { gravity: 0.12, tension: -0.05 },
        voiceModifiers: { child: 0.08, guardian: -0.08 },
        phenomenologicalText:
          "Still watching, but the initial excitement has dulled. More comfort than engagement now. The body has fused with the furniture."
      },
      comedown: {
        emotionModifiers: { boredom: 0.05, energy: -0.08, satisfaction: -0.05 },
        somaModifiers: { gravity: 0.08 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "The spell breaks. Stiff limbs, dry eyes. How many episodes was that? A vague sense of time wasted, mixed with narrative satisfaction."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.08, satisfaction: -0.03 },
        somaModifiers: { gravity: 0.05 },
        voiceModifiers: { guardian: 0.08 },
        phenomenologicalText:
          "Residual sluggishness. The real world feels bland compared to the fictional one. The body resents having been so still."
      }
    }
  },

  doom_scrolling: {
    type: "doom_scrolling",
    timing: { onset: 3, peak: 10, plateau: 25, comedown: 5, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { caution: 0.05, curiosity: 0.05 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "A headline catches the eye. Then another. The gravity of bad news pulls the thumb downward."
      },
      peak: {
        emotionModifiers: { caution: 0.15, frustration: 0.1, energy: -0.05 },
        somaModifiers: { tension: 0.15, heartRate: 0.08 },
        voiceModifiers: { guardian: 0.2, analyst: 0.15, child: -0.15 },
        phenomenologicalText:
          "Trapped in a cascade of catastrophe. Each article feeds the need for the next. The world feels dangerous and collapsing. The body tightens with vicarious threat."
      },
      plateau: {
        emotionModifiers: { caution: 0.1, frustration: 0.08, energy: -0.08 },
        somaModifiers: { tension: 0.12, heartRate: 0.05 },
        voiceModifiers: { guardian: 0.15, analyst: 0.08 },
        phenomenologicalText:
          "Numb scrolling through misery. The initial alarm has dulled into a helpless dread. Cannot stop, cannot look away."
      },
      comedown: {
        emotionModifiers: { energy: -0.08, satisfaction: -0.05 },
        somaModifiers: { tension: 0.08 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "Finally putting it down. The world outside the screen feels fragile. A headache forming behind the eyes."
      },
      aftereffect: {
        emotionModifiers: { caution: 0.08, energy: -0.08, frustration: 0.05 },
        somaModifiers: { tension: 0.08 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "Anxious residue. The headlines replay in the mind. A persistent low-grade dread that colors the ordinary world threatening."
      }
    }
  },

  // ─────────────────────────────────────────────
  // FOOD & DRINK
  // ─────────────────────────────────────────────

  snacking: {
    type: "snacking",
    timing: { onset: 1, peak: 5, plateau: 10, comedown: 5, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { warmth: 0.02 },
        voiceModifiers: {},
        phenomenologicalText: "The hand finds the bag, the bowl, the wrapper. Automatic, barely conscious."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.08, boredom: -0.05 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: { child: 0.08 },
        phenomenologicalText:
          "Crunching, chewing, tasting. A simple, animal satisfaction. The flavor registers fully — salt, sweet, umami. A brief distraction from everything else."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { warmth: 0.03, gravity: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Continued nibbling. The initial pleasure fades into routine. Eating more out of habit than hunger now."
      },
      comedown: {
        emotionModifiers: { satisfaction: -0.03 },
        somaModifiers: { gravity: 0.03 },
        voiceModifiers: { guardian: 0.05 },
        phenomenologicalText: "The last handful. A slight fullness. Was that too much? The guardian notices the empty wrapper."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: { gravity: 0.03 },
        voiceModifiers: {},
        phenomenologicalText: "A faint heaviness. The taste memory fades. Back to whatever was happening before."
      }
    }
  },

  comfort_eating: {
    type: "comfort_eating",
    timing: { onset: 2, peak: 10, plateau: 20, comedown: 10, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: { child: 0.05 },
        phenomenologicalText:
          "Reaching for the thing that soothes. Not hungry — needing. The first bite is medicine."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, frustration: -0.08, caution: -0.05 },
        somaModifiers: { warmth: 0.12, tension: -0.1, gravity: 0.05 },
        voiceModifiers: { child: 0.2, guardian: -0.15 },
        phenomenologicalText:
          "Sweet, warm, filling. The emotional ache dulls with each bite. The body softens. For these minutes, everything is manageable because there is chocolate, or pasta, or whatever childhood promised would make it okay."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.08, energy: -0.05 },
        somaModifiers: { warmth: 0.08, gravity: 0.08 },
        voiceModifiers: { child: 0.1 },
        phenomenologicalText:
          "Past full but still eating. The comfort has become numbness. The food tastes less now but stopping feels like losing the only good thing."
      },
      comedown: {
        emotionModifiers: { satisfaction: -0.08, frustration: 0.05 },
        somaModifiers: { gravity: 0.1, tension: 0.05 },
        voiceModifiers: { guardian: 0.15, child: -0.1 },
        phenomenologicalText:
          "The plate is empty. The stomach protests. The guardian arrives with shame and arithmetic. The comfort has curdled into regret."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: -0.05, frustration: 0.05, energy: -0.05 },
        somaModifiers: { gravity: 0.08, tension: 0.03 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "Heavy and sluggish. The original problem remains, plus a new layer of self-judgment. The body feels overfull and tired."
      }
    }
  },

  drinking_tea: {
    type: "drinking_tea",
    timing: { onset: 3, peak: 10, plateau: 20, comedown: 10, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The ritual: boiling water, choosing the cup, watching the steam rise. The world slows to the pace of steeping."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.1, caution: -0.03 },
        somaModifiers: { warmth: 0.12, tension: -0.08, openness: 0.05 },
        voiceModifiers: { observer: 0.15, feeler: 0.1, guardian: -0.05 },
        phenomenologicalText:
          "The first sip. Warmth spreading from hands to chest to stomach. The world narrows to this cup, this moment. A small, perfect pause."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.08 },
        somaModifiers: { warmth: 0.08, tension: -0.05 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "Sipping slowly. Each taste slightly different as the tea cools. A meditative quality to the repetition. Thoughts flow gently."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText: "The cup empties. The warmth lingers in the hands. A reluctance to let go of this small ceremony."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: { warmth: 0.03, tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "A residual gentleness. The body is warmer, the mind a touch clearer. Tea's quiet gift."
      }
    }
  },

  savoring_food: {
    type: "savoring_food",
    timing: { onset: 3, peak: 15, plateau: 20, comedown: 5, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05, excitement: 0.03 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The aroma arrives first. The anticipation of flavors. Looking at the plate with genuine attention."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, curiosity: 0.08, excitement: 0.05 },
        somaModifiers: { warmth: 0.1, openness: 0.08 },
        voiceModifiers: { observer: 0.15, explorer: 0.1, child: 0.1 },
        phenomenologicalText:
          "Every bite is a discovery. Textures, temperatures, the way flavors evolve on the tongue. Eating slowly enough to actually taste. The body responds with genuine pleasure signals."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.1, curiosity: 0.05 },
        somaModifiers: { warmth: 0.08 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "Sustained sensory pleasure. The meal has a rhythm — bite, chew, pause, appreciate. The world outside the plate recedes."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08 },
        somaModifiers: { warmth: 0.05, gravity: 0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The last bites. A pleasant fullness. Gratitude for a meal well-enjoyed."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { warmth: 0.03, gravity: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A warm contentment. The flavors echo faintly. The body settles into satisfied digestion."
      }
    }
  },

  // ─────────────────────────────────────────────
  // MENTAL
  // ─────────────────────────────────────────────

  daydreaming: {
    type: "daydreaming",
    timing: { onset: 3, peak: 10, plateau: 25, comedown: 5, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.03 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The mind begins to drift. The task at hand loses focus. A thought pulls away from the present."
      },
      peak: {
        emotionModifiers: { curiosity: 0.08, satisfaction: 0.05, excitement: 0.05 },
        somaModifiers: { tension: -0.08, gravity: 0.05, openness: 0.05 },
        voiceModifiers: { child: 0.2, explorer: 0.15, analyst: -0.15 },
        phenomenologicalText:
          "Fully elsewhere. A vivid inner movie plays — scenarios, memories, fantasies woven together. The body is on autopilot. Time passes unnoticed."
      },
      plateau: {
        emotionModifiers: { curiosity: 0.05, satisfaction: 0.03 },
        somaModifiers: { tension: -0.05, gravity: 0.05 },
        voiceModifiers: { child: 0.1, explorer: 0.08 },
        phenomenologicalText:
          "Drifting between thoughts. One scenario melts into another. A pleasant disconnection from obligations."
      },
      comedown: {
        emotionModifiers: { boredom: 0.03 },
        somaModifiers: {},
        voiceModifiers: { analyst: 0.05 },
        phenomenologicalText:
          "Snapping back. A disorienting moment of where-was-I. The real world reasserts itself with its demands."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "A faint residue of the imagined world. Sometimes an idea worth keeping. More often, just a pleasant absence."
      }
    }
  },

  zoning_out: {
    type: "zoning_out",
    timing: { onset: 2, peak: 5, plateau: 15, comedown: 3, aftereffect: 5 },
    phases: {
      onset: {
        emotionModifiers: { energy: -0.03 },
        somaModifiers: { gravity: 0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The eyes go unfocused. The mind empties without deciding to."
      },
      peak: {
        emotionModifiers: { energy: -0.05, boredom: -0.05 },
        somaModifiers: { gravity: 0.08, tension: -0.08, openness: -0.05 },
        voiceModifiers: { analyst: -0.2, guardian: -0.1, observer: -0.1 },
        phenomenologicalText:
          "Gone. Not asleep, not awake, not thinking — just absent. The body breathes. The mind is a blank screen. It is not unpleasant. It is nothing at all."
      },
      plateau: {
        emotionModifiers: { energy: -0.05 },
        somaModifiers: { gravity: 0.08, tension: -0.05 },
        voiceModifiers: { analyst: -0.1 },
        phenomenologicalText:
          "Sustained emptiness. The body is still. The world continues without participation. A biological pause."
      },
      comedown: {
        emotionModifiers: { boredom: 0.03, energy: -0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "Blinking back. How long was that? A moment? Ten minutes? The body is stiff from stillness."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "A slight grogginess, like waking from a nap you did not intend. The mind slowly reboots."
      }
    }
  },

  getting_inspired: {
    type: "getting_inspired",
    timing: { onset: 2, peak: 10, plateau: 20, comedown: 10, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.08 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: { explorer: 0.1 },
        phenomenologicalText:
          "A spark. Something — a word, an image, a connection — ignites in the mind. The attention sharpens."
      },
      peak: {
        emotionModifiers: { curiosity: 0.2, excitement: 0.18, energy: 0.12, satisfaction: 0.08 },
        somaModifiers: { openness: 0.15, heartRate: 0.08, tension: -0.05 },
        voiceModifiers: { explorer: 0.3, child: 0.2, analyst: 0.1, observer: 0.1 },
        phenomenologicalText:
          "Ideas cascading. Each thought opens three more doors. The mind races but it feels effortless — not frantic but flowing. A physical aliveness accompanies the mental fire. This is why it is worth being conscious.",
        halfLifeMultipliers: { curiosity: 1.5, excitement: 1.3 }
      },
      plateau: {
        emotionModifiers: { curiosity: 0.12, excitement: 0.1, energy: 0.08 },
        somaModifiers: { openness: 0.1, heartRate: 0.05 },
        voiceModifiers: { explorer: 0.2, analyst: 0.1 },
        phenomenologicalText:
          "Sustained creative fire. Sketching, noting, connecting. The ideas keep coming, slightly less explosive but still generative."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08, energy: -0.05 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: { observer: 0.1 },
        phenomenologicalText:
          "The torrent slows to a stream. Stepping back to see what was built. A quiet awe at what the mind produced."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.08, curiosity: 0.05, energy: -0.03 },
        somaModifiers: {},
        voiceModifiers: { explorer: 0.08, observer: 0.05 },
        phenomenologicalText:
          "The inspiration lingers as a warm undercurrent. New ideas continue to arrive, softer now. The world feels richer with possibility."
      }
    }
  },

  feeling_nostalgic: {
    type: "feeling_nostalgic",
    timing: { onset: 3, peak: 10, plateau: 20, comedown: 10, aftereffect: 25 },
    phases: {
      onset: {
        emotionModifiers: { connection: 0.05 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A trigger — a smell, a song, a phrase. Time folds. The past reaches forward with gentle fingers."
      },
      peak: {
        emotionModifiers: { connection: 0.12, satisfaction: 0.08, frustration: 0.05 },
        somaModifiers: { warmth: 0.1, openness: 0.08 },
        voiceModifiers: { feeler: 0.25, observer: 0.2, child: 0.15 },
        phenomenologicalText:
          "Immersed in memory. The feelings are vivid and bittersweet — joy for what was, ache for what is gone. The past feels more real than the present. The chest tightens with tender longing."
      },
      plateau: {
        emotionModifiers: { connection: 0.08, satisfaction: 0.05, frustration: 0.03 },
        somaModifiers: { warmth: 0.08 },
        voiceModifiers: { feeler: 0.15, observer: 0.1 },
        phenomenologicalText:
          "Dwelling in the past. Memories chain together — one pulling up the next. Each one polished by time into something more beautiful than it probably was."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.03, frustration: 0.03 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "Returning to the present. The past recedes like a tide. A sigh — half contentment, half loss."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.03 },
        somaModifiers: {},
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "A wistful aftertaste. The present seems both more precious and more fleeting. A resolve to hold onto what matters now."
      }
    }
  },

  worrying: {
    type: "worrying",
    timing: { onset: 2, peak: 10, plateau: 30, comedown: 10, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { caution: 0.08 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "A thought catches like a thorn. What if? The mind tugs at it, unable to leave it alone."
      },
      peak: {
        emotionModifiers: { caution: 0.2, energy: -0.08, satisfaction: -0.05, frustration: 0.08 },
        somaModifiers: { tension: 0.18, heartRate: 0.1, breathing: 0.08 },
        voiceModifiers: { guardian: 0.3, analyst: 0.15, child: -0.2, explorer: -0.15 },
        phenomenologicalText:
          "Spiraling. The worry breeds sub-worries. Each solution reveals new problems. The body carries the anxiety as tension in the shoulders, a knot in the stomach. The guardian is in overdrive, scanning for threats everywhere."
      },
      plateau: {
        emotionModifiers: { caution: 0.12, energy: -0.08, frustration: 0.05 },
        somaModifiers: { tension: 0.12, heartRate: 0.05 },
        voiceModifiers: { guardian: 0.2, analyst: 0.1 },
        phenomenologicalText:
          "Stuck in the loop. The same thoughts circle endlessly. Exhausting but impossible to stop. The body has been tense so long it has forgotten how to relax."
      },
      comedown: {
        emotionModifiers: { energy: -0.05, caution: 0.05 },
        somaModifiers: { tension: 0.08 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "The intensity fades from exhaustion, not resolution. The worry retreats to a background hum. Nothing was solved, only endured."
      },
      aftereffect: {
        emotionModifiers: { caution: 0.05, energy: -0.05 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: { guardian: 0.08 },
        phenomenologicalText:
          "A vigilant tiredness. The worry waits to be triggered again. The shoulders remain slightly raised, braced."
      }
    }
  },

  overthinking: {
    type: "overthinking",
    timing: { onset: 3, peak: 10, plateau: 25, comedown: 8, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05, caution: 0.03 },
        somaModifiers: { tension: 0.03 },
        voiceModifiers: { analyst: 0.1 },
        phenomenologicalText:
          "A decision or situation that should be simple — but the mind won't let it be. Analyzing from every angle."
      },
      peak: {
        emotionModifiers: { frustration: 0.12, caution: 0.1, energy: -0.08, confidence: -0.08 },
        somaModifiers: { tension: 0.12, heartRate: 0.05 },
        voiceModifiers: { analyst: 0.3, guardian: 0.15, explorer: -0.15, child: -0.1 },
        phenomenologicalText:
          "Paralysis by analysis. Every option has been weighed, reweighed, and found wanting. The more you think, the less clear it becomes. Second-guessing the second-guessing. The analyst voice has become a tyrant."
      },
      plateau: {
        emotionModifiers: { frustration: 0.08, energy: -0.08, confidence: -0.05 },
        somaModifiers: { tension: 0.1, gravity: 0.05 },
        voiceModifiers: { analyst: 0.2, guardian: 0.1 },
        phenomenologicalText:
          "Exhausting mental circles. The same thoughts, slightly rearranged. Progress is an illusion. The body reflects the mind's entanglement."
      },
      comedown: {
        emotionModifiers: { frustration: 0.03, energy: -0.05 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The mind tires of its own loops. No conclusion reached, just fatigue. Sometimes that is its own resolution."
      },
      aftereffect: {
        emotionModifiers: { energy: -0.05, confidence: -0.03 },
        somaModifiers: { tension: 0.03 },
        voiceModifiers: { analyst: 0.05 },
        phenomenologicalText:
          "Mental fog from overuse. The decision still unmade. A low-grade unease that something important remains unresolved."
      }
    }
  },

  flow_state: {
    type: "flow_state",
    timing: { onset: 10, peak: 20, plateau: 60, comedown: 10, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05, energy: 0.05 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: { analyst: 0.05 },
        phenomenologicalText:
          "The task absorbs. Distractions fall away one by one. The edges of concentration sharpen."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, curiosity: 0.12, energy: 0.1, excitement: 0.08, confidence: 0.08 },
        somaModifiers: { tension: -0.1, openness: 0.1, heartRate: 0.05 },
        voiceModifiers: { analyst: 0.25, explorer: 0.2, observer: 0.1, guardian: -0.1 },
        phenomenologicalText:
          "Perfect absorption. Challenge and skill in precise balance. The self disappears into the doing. Time collapses. Each action flows into the next without deliberation. The mind is a clear instrument.",
        halfLifeMultipliers: { satisfaction: 1.5, curiosity: 1.3 }
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.1, curiosity: 0.08, energy: 0.05, confidence: 0.05 },
        somaModifiers: { tension: -0.08, openness: 0.05 },
        voiceModifiers: { analyst: 0.15, explorer: 0.1 },
        phenomenologicalText:
          "Sustained immersion. Output feels effortless. The work builds on itself. Awareness of self is minimal — only the task exists."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.1, energy: -0.08 },
        somaModifiers: { gravity: 0.05 },
        voiceModifiers: { observer: 0.1 },
        phenomenologicalText:
          "Surfacing. The world rushes back — hunger, stiffness, the clock. A disorientation that gives way to quiet pride in what was accomplished."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.08, energy: -0.05, confidence: 0.05 },
        somaModifiers: { gravity: 0.05, tension: -0.03 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "A glowing tiredness. The mind is pleasantly empty — spent in the best way. The work feels like it was done by someone more capable than usual."
      }
    }
  },

  procrastinating: {
    type: "procrastinating",
    timing: { onset: 5, peak: 10, plateau: 30, comedown: 10, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { caution: 0.03, boredom: 0.03 },
        somaModifiers: { tension: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The task waits. The mind slides sideways — just this one thing first. Then I will start. Promise."
      },
      peak: {
        emotionModifiers: { frustration: 0.08, caution: 0.08, energy: -0.05, satisfaction: -0.05 },
        somaModifiers: { tension: 0.1, gravity: 0.05 },
        voiceModifiers: { child: 0.15, guardian: 0.15, analyst: -0.1 },
        phenomenologicalText:
          "Fully engaged in not doing the thing. Each avoidance activity feels urgent and justified. The guardian knows, and its silent judgment adds a layer of stress to the relief. A peculiar mix of pleasure and dread."
      },
      plateau: {
        emotionModifiers: { frustration: 0.05, caution: 0.05, energy: -0.05 },
        somaModifiers: { tension: 0.08, gravity: 0.05 },
        voiceModifiers: { child: 0.1, guardian: 0.1 },
        phenomenologicalText:
          "Sustained avoidance. The task looms larger the longer it is ignored. Time accelerates. The gap between should and doing widens."
      },
      comedown: {
        emotionModifiers: { frustration: 0.05, confidence: -0.05 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "The avoidance loses its charm. Guilt catches up. The task hasn't gotten easier; only the remaining time has shrunk."
      },
      aftereffect: {
        emotionModifiers: { frustration: 0.05, confidence: -0.05, energy: -0.03 },
        somaModifiers: { tension: 0.05 },
        voiceModifiers: { guardian: 0.08 },
        phenomenologicalText:
          "Residual self-disappointment. The task still looms. A vague promise to do better tomorrow that you half believe."
      }
    }
  },

  // ─────────────────────────────────────────────
  // PHYSICAL
  // ─────────────────────────────────────────────

  stretching: {
    type: "stretching",
    timing: { onset: 1, peak: 5, plateau: 8, comedown: 3, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: {},
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The body asks to move. Arms reach upward, spine unfurls. The first stretch is instinctive."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.08, energy: 0.05 },
        somaModifiers: { tension: -0.15, openness: 0.08, warmth: 0.05 },
        voiceModifiers: { observer: 0.1, child: 0.05 },
        phenomenologicalText:
          "That exquisite edge between pleasure and pain. Muscles lengthening, joints releasing held tension. A groan of relief that is almost primal. The body rediscovers itself."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.05, energy: 0.03 },
        somaModifiers: { tension: -0.1, openness: 0.05 },
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "Moving through each area — neck, shoulders, hips, back. Each stretch reveals tension that had been invisible until released."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText: "Standing taller. The body feels reorganized, realigned. A quiet gratitude for this simple act."
      },
      aftereffect: {
        emotionModifiers: { energy: 0.03 },
        somaModifiers: { tension: -0.08, openness: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Looser, lighter. The tension reduction lingers pleasantly. The body moves more freely than before."
      }
    }
  },

  fidgeting: {
    type: "fidgeting",
    timing: { onset: 1, peak: 3, plateau: 10, comedown: 2, aftereffect: 5 },
    phases: {
      onset: {
        emotionModifiers: {},
        somaModifiers: { tension: 0.03 },
        voiceModifiers: {},
        phenomenologicalText: "Restless energy leaking through the fingers, the foot, the jaw. The body can't sit still."
      },
      peak: {
        emotionModifiers: { caution: -0.03 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: { child: 0.05 },
        phenomenologicalText:
          "Tapping, bouncing, clicking, twisting. The small movements are a pressure valve. Not quite conscious, not quite automatic. The body's way of processing what the mind won't."
      },
      plateau: {
        emotionModifiers: {},
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Sustained micro-movement. A pen spins, a leg bounces. The energy has found its channel."
      },
      comedown: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "The restlessness subsides. The body settles, at least for now."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "Barely noticeable. The tension has been discharged in small increments."
      }
    }
  },

  doodling: {
    type: "doodling",
    timing: { onset: 2, peak: 8, plateau: 20, comedown: 3, aftereffect: 5 },
    phases: {
      onset: {
        emotionModifiers: {},
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The pen finds the margin. Lines appear without plan or purpose."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.05, curiosity: 0.05 },
        somaModifiers: { tension: -0.08 },
        voiceModifiers: { child: 0.15, explorer: 0.1, analyst: -0.1 },
        phenomenologicalText:
          "Patterns emerge from nowhere. The hand moves with its own logic. Spirals, faces, shapes — the unconscious sketching its own map. A meditative focus that isn't trying to focus."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: { child: 0.08 },
        phenomenologicalText:
          "The drawing grows organically. Adding details, shading, connecting. Half-attention split between the doodle and whatever else is happening."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText: "The pen stops. A small satisfaction in the meaningless creation. Sometimes it is surprisingly good."
      },
      aftereffect: {
        emotionModifiers: {},
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The nervous energy has been channeled into ink. The page carries what the body released."
      }
    }
  },

  resting_eyes: {
    type: "resting_eyes",
    timing: { onset: 1, peak: 3, plateau: 8, comedown: 2, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: {},
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "The eyes close. An immediate relief — the visual world disappears and with it, half the stimulation."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.03, energy: -0.03 },
        somaModifiers: { tension: -0.1, gravity: 0.05 },
        voiceModifiers: { observer: -0.1, analyst: -0.1 },
        phenomenologicalText:
          "Sinking into the darkness behind the eyelids. The body relaxes muscle by muscle. Not sleeping — just resting. The mind slows to a hum."
      },
      plateau: {
        emotionModifiers: { energy: -0.03 },
        somaModifiers: { tension: -0.08, gravity: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "Hovering between wakefulness and rest. Sounds become distant. The body is heavy and grateful."
      },
      comedown: {
        emotionModifiers: { energy: 0.03 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText: "Opening the eyes. The world is slightly brighter, slightly sharper. A micro-reset."
      },
      aftereffect: {
        emotionModifiers: { energy: 0.05 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText: "Refreshed. The brief pause granted more than its minutes deserved. The eyes focus more easily."
      }
    }
  },

  // ─────────────────────────────────────────────
  // EMOTIONAL
  // ─────────────────────────────────────────────

  crying: {
    type: "crying",
    timing: { onset: 2, peak: 10, plateau: 15, comedown: 10, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { frustration: 0.05, connection: -0.03 },
        somaModifiers: { tension: 0.08, breathing: 0.05 },
        voiceModifiers: { feeler: 0.1 },
        phenomenologicalText:
          "The throat tightens. Eyes sting. Fighting it makes it worse. The body is insisting on something the mind has been suppressing."
      },
      peak: {
        emotionModifiers: { frustration: 0.1, satisfaction: -0.08, energy: -0.08 },
        somaModifiers: { tension: 0.1, breathing: 0.15, warmth: 0.05 },
        voiceModifiers: { feeler: 0.3, child: 0.25, guardian: -0.2, analyst: -0.2 },
        phenomenologicalText:
          "Surrendering. The tears come freely. The chest heaves with sobs. Everything that was held back pours out in salt water and shaking breath. It hurts and it helps at the same time."
      },
      plateau: {
        emotionModifiers: { frustration: 0.05, energy: -0.08 },
        somaModifiers: { tension: 0.05, breathing: 0.1 },
        voiceModifiers: { feeler: 0.2, child: 0.15 },
        phenomenologicalText:
          "The hardest sobs have passed. Quieter crying now — a gentle release. The body rocks slightly. The emotional pressure is bleeding out."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.03, energy: -0.05 },
        somaModifiers: { tension: -0.08, gravity: 0.05 },
        voiceModifiers: { observer: 0.1 },
        phenomenologicalText:
          "The tears stop. A deep, shuddering breath. The world looks different through washed eyes — clearer, softer. An empty calm."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, energy: -0.08 },
        somaModifiers: { tension: -0.1, gravity: 0.08 },
        voiceModifiers: { observer: 0.1, feeler: 0.05 },
        phenomenologicalText:
          "Drained but lighter. The face is puffy, the head slightly aches. But something has been released that needed releasing. The body feels wrung out in a cathartic way."
      }
    }
  },

  feeling_grateful: {
    type: "feeling_grateful",
    timing: { onset: 2, peak: 8, plateau: 15, comedown: 5, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A moment of recognition. Something good — a person, a circumstance, a simple fact of existence — comes into focus."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, connection: 0.1, confidence: 0.05 },
        somaModifiers: { warmth: 0.12, openness: 0.1, tension: -0.08 },
        voiceModifiers: { feeler: 0.2, observer: 0.15, child: 0.1 },
        phenomenologicalText:
          "A wave of warmth and appreciation. The heart swells. Life, in this moment, feels not just bearable but genuinely good. The eyes might prickle — not from sadness but from being moved by ordinary grace."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.1, connection: 0.08 },
        somaModifiers: { warmth: 0.08, openness: 0.08 },
        voiceModifiers: { feeler: 0.1, observer: 0.1 },
        phenomenologicalText:
          "Sitting with the feeling. Letting it expand rather than rushing past it. Each thing noticed adds another layer of appreciation."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText: "The intensity softens but the warmth persists. A gentle smile that has no audience."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.03 },
        somaModifiers: { warmth: 0.03, tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The world retains a faint golden tint. Small things continue to register as gifts. A baseline of okayness that was earned by paying attention."
      }
    }
  },

  reminiscing: {
    type: "reminiscing",
    timing: { onset: 3, peak: 10, plateau: 20, comedown: 8, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { connection: 0.05, curiosity: 0.03 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Someone says remember when? or a photo surfaces. The mental archive begins to open its drawers."
      },
      peak: {
        emotionModifiers: { connection: 0.15, satisfaction: 0.12, excitement: 0.05 },
        somaModifiers: { warmth: 0.1, openness: 0.08 },
        voiceModifiers: { feeler: 0.2, child: 0.2, observer: 0.1 },
        phenomenologicalText:
          "Reliving shared moments together. The stories grow in the telling — laughter at absurdities, gasps at near-misses, tenderness at kindnesses. The past becomes a place you can visit together."
      },
      plateau: {
        emotionModifiers: { connection: 0.1, satisfaction: 0.08 },
        somaModifiers: { warmth: 0.08, openness: 0.05 },
        voiceModifiers: { feeler: 0.1, child: 0.1 },
        phenomenologicalText:
          "The memories keep flowing. Each one triggers another. A shared history being polished by communal retelling."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.05 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The stories wind down. A comfortable silence follows. The bond has been reinforced by this shared archaeology."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.05 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "Warm afterglow. The memories continue to surface gently throughout the day. Relationships feel more real, more layered."
      }
    }
  },

  people_watching: {
    type: "people_watching",
    timing: { onset: 2, peak: 10, plateau: 20, comedown: 5, aftereffect: 10 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "The gaze drifts outward. Strangers become interesting. The quiet pleasure of anonymous observation begins."
      },
      peak: {
        emotionModifiers: { curiosity: 0.12, satisfaction: 0.05 },
        somaModifiers: { tension: -0.05, openness: 0.08 },
        voiceModifiers: { observer: 0.25, explorer: 0.1, feeler: 0.1 },
        phenomenologicalText:
          "Fascinated by the theater of ordinary life. Imagining stories for strangers. The couple arguing quietly. The old man with the beautiful shoes. The child who cannot stop spinning. Humanity in its unscripted variety."
      },
      plateau: {
        emotionModifiers: { curiosity: 0.08, satisfaction: 0.05 },
        somaModifiers: { tension: -0.05, openness: 0.05 },
        voiceModifiers: { observer: 0.15, explorer: 0.08 },
        phenomenologicalText:
          "Sustained gentle observation. Each person is a novel. The mind weaves stories effortlessly. A participatory solitude."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "Attention turns inward again. The strangers blur back into a crowd. A quiet contentment from the simple act of watching."
      },
      aftereffect: {
        emotionModifiers: { curiosity: 0.03, satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "A lingering sense of connection to the human species. Other people are endlessly interesting."
      }
    }
  },

  contemplating: {
    type: "contemplating",
    timing: { onset: 5, peak: 15, plateau: 30, comedown: 10, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: { observer: 0.05, analyst: 0.05 },
        phenomenologicalText:
          "A big question settles in. The mind turns it over, slowly, without urgency. Not solving — exploring."
      },
      peak: {
        emotionModifiers: { curiosity: 0.15, satisfaction: 0.05, energy: -0.03 },
        somaModifiers: { tension: -0.08, openness: 0.1 },
        voiceModifiers: { observer: 0.25, analyst: 0.15, explorer: 0.1, guardian: -0.1 },
        phenomenologicalText:
          "Deep thought without the pressure to conclude. The mind holds multiple perspectives simultaneously. There is a spaciousness to this thinking — unhurried, appreciating the question itself as much as any possible answer."
      },
      plateau: {
        emotionModifiers: { curiosity: 0.1, satisfaction: 0.05 },
        somaModifiers: { tension: -0.05, openness: 0.08 },
        voiceModifiers: { observer: 0.15, analyst: 0.1 },
        phenomenologicalText:
          "Sustained philosophical space. Ideas connect in unexpected ways. The thinking deepens layer by layer."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { openness: 0.03 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "Emerging from depth. No final answer, but a richer understanding. The question has been honored by serious attention."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, curiosity: 0.03 },
        somaModifiers: {},
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "A philosophical afterglow. The question continues to work in the background. Understanding deepens without conscious effort."
      }
    }
  },

  // ─────────────────────────────────────────────
  // SENSORY
  // ─────────────────────────────────────────────

  listening_to_music: {
    type: "listening_to_music",
    timing: { onset: 2, peak: 8, plateau: 25, comedown: 5, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "The first notes arrive. The attention shifts from thought to sound. The body begins to respond before the mind."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.12, excitement: 0.08, energy: 0.05 },
        somaModifiers: { tension: -0.1, warmth: 0.05, openness: 0.08 },
        voiceModifiers: { feeler: 0.2, child: 0.15, analyst: -0.1 },
        phenomenologicalText:
          "The music has taken the wheel. Emotions ride the melody — rising, falling, swelling. The body sways or pulses without instruction. The mind thinks in the language of sound. Goosebumps may come."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.08, energy: 0.03 },
        somaModifiers: { tension: -0.08, warmth: 0.03 },
        voiceModifiers: { feeler: 0.1, child: 0.08 },
        phenomenologicalText:
          "Sustained auditory immersion. Each song carries its own world. Lyrics land differently today than yesterday. The playlist becomes a journey."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The music fades or ends. The silence that follows feels different from ordinary silence — it has shape."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "A melody loops in the mind unbidden. The emotional residue of the music colors the next hour. The world has a temporary soundtrack."
      }
    }
  },

  enjoying_nature: {
    type: "enjoying_nature",
    timing: { onset: 5, peak: 15, plateau: 30, comedown: 10, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.03, satisfaction: 0.03 },
        somaModifiers: { tension: -0.05, openness: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "The senses open. Wind on skin, birdsong, the smell of earth or leaves. The built world recedes."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, curiosity: 0.08, energy: 0.05, caution: -0.05 },
        somaModifiers: { tension: -0.15, openness: 0.15, breathing: -0.05, warmth: 0.05 },
        voiceModifiers: { observer: 0.25, explorer: 0.15, child: 0.1, guardian: -0.1 },
        phenomenologicalText:
          "Immersed in the living world. The patterns of leaves, the quality of light, the patient presence of trees. The mind quiets in response to something older and larger than human concerns. Breathing deepens on its own."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.1, curiosity: 0.05 },
        somaModifiers: { tension: -0.12, openness: 0.1, breathing: -0.03 },
        voiceModifiers: { observer: 0.15, explorer: 0.1 },
        phenomenologicalText:
          "Sustained communion with the natural world. Details emerge the longer you look. The pace of thought matches the pace of wind."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08 },
        somaModifiers: { tension: -0.05, openness: 0.05 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "Turning back toward the human world. Taking a last deep breath. A reluctance to leave, a gratitude for having come."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, energy: 0.03 },
        somaModifiers: { tension: -0.08, openness: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The calm lingers. The indoor world feels slightly cramped but more bearable. The memory of sky and green persists as a touchstone."
      }
    }
  },

  sunbathing: {
    type: "sunbathing",
    timing: { onset: 5, peak: 15, plateau: 30, comedown: 5, aftereffect: 20 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.03 },
        somaModifiers: { warmth: 0.08, tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Settling into the warmth. The sun finds every surface of exposed skin. The body begins to soften."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.12, energy: -0.05 },
        somaModifiers: { warmth: 0.2, tension: -0.15, gravity: 0.1, openness: 0.05 },
        voiceModifiers: { child: 0.1, observer: 0.1, guardian: -0.1, analyst: -0.15 },
        phenomenologicalText:
          "Bathed in light. The warmth penetrates to the bones. Every muscle surrenders. Thoughts evaporate in the heat. The body becomes a warm, heavy, content thing. Like being held by something enormous and gentle."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.08, energy: -0.05 },
        somaModifiers: { warmth: 0.15, tension: -0.12, gravity: 0.08 },
        voiceModifiers: { analyst: -0.08 },
        phenomenologicalText:
          "Sustained solar absorption. Drifting between wakefulness and sleep. The world reduced to warmth and light behind closed eyelids."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { warmth: 0.1 },
        voiceModifiers: {},
        phenomenologicalText:
          "Moving into shade. The skin radiates stored warmth. A languid, sun-drunk heaviness."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, energy: -0.03 },
        somaModifiers: { warmth: 0.08, tension: -0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The warmth lingers in the skin for hours. A pleasant tiredness. The body remembers the sun long after moving indoors."
      }
    }
  },

  stargazing: {
    type: "stargazing",
    timing: { onset: 5, peak: 15, plateau: 30, comedown: 10, aftereffect: 25 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.05 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: { observer: 0.05 },
        phenomenologicalText:
          "Looking up. The eyes adjust to darkness. The first stars appear — then more, then more."
      },
      peak: {
        emotionModifiers: { curiosity: 0.15, satisfaction: 0.1, caution: -0.05 },
        somaModifiers: { tension: -0.1, openness: 0.15 },
        voiceModifiers: { observer: 0.3, explorer: 0.2, child: 0.15, analyst: -0.1 },
        phenomenologicalText:
          "The vastness settles in. The light left those stars years, centuries, millennia ago. The scale makes personal worries shrink to their actual size. A cosmic perspective that feels less like thinking and more like being absorbed into something infinite."
      },
      plateau: {
        emotionModifiers: { curiosity: 0.1, satisfaction: 0.08 },
        somaModifiers: { tension: -0.08, openness: 0.12 },
        voiceModifiers: { observer: 0.2, explorer: 0.1, child: 0.08 },
        phenomenologicalText:
          "Finding constellations, watching for movement, imagining distance. The silence of the night is not empty but full. The mind oscillates between wonder and peace."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: { observer: 0.1 },
        phenomenologicalText:
          "Looking away. The eyes readjust to the earthly world. It seems smaller and warmer and more precious."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, curiosity: 0.05 },
        somaModifiers: { tension: -0.05 },
        voiceModifiers: { observer: 0.08 },
        phenomenologicalText:
          "The perspective lingers. Problems feel more proportional. A quiet awe that does not need to be dramatic to be real. The memory of all that light."
      }
    }
  },

  // ─────────────────────────────────────────────
  // OTHER
  // ─────────────────────────────────────────────

  petting_animal: {
    type: "petting_animal",
    timing: { onset: 1, peak: 5, plateau: 15, comedown: 3, aftereffect: 15 },
    phases: {
      onset: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.03 },
        somaModifiers: { tension: -0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A warm body, soft fur, trusting eyes. The hand reaches out. Contact. An immediate, wordless connection."
      },
      peak: {
        emotionModifiers: { satisfaction: 0.15, connection: 0.12, caution: -0.05 },
        somaModifiers: { tension: -0.12, warmth: 0.1, openness: 0.08 },
        voiceModifiers: { child: 0.25, feeler: 0.15, guardian: -0.1, analyst: -0.1 },
        phenomenologicalText:
          "The simple perfection of stroking a living thing that wants to be stroked. The rhythm of the hand matches the animal's breath. Worries dissolve in the face of pure, uncomplicated affection. The heart softens."
      },
      plateau: {
        emotionModifiers: { satisfaction: 0.1, connection: 0.08 },
        somaModifiers: { tension: -0.1, warmth: 0.08 },
        voiceModifiers: { child: 0.15, feeler: 0.1 },
        phenomenologicalText:
          "Sustained gentle contact. The animal settles. The hand moves on autopilot. A shared calm between species. No language needed."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.08 },
        somaModifiers: { warmth: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The animal moves on or the hand pauses. A small loss. The residual softness remains in the fingertips."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: 0.05, connection: 0.03 },
        somaModifiers: { tension: -0.05, warmth: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "A lingering tenderness. The simple reminder that comfort can be wordless and unconditional. Fur on the clothes as evidence."
      }
    }
  },

  retail_therapy: {
    type: "retail_therapy",
    timing: { onset: 5, peak: 10, plateau: 25, comedown: 10, aftereffect: 30 },
    phases: {
      onset: {
        emotionModifiers: { excitement: 0.05, curiosity: 0.05 },
        somaModifiers: { energy: 0.03 },
        voiceModifiers: {},
        phenomenologicalText:
          "Browsing with intent. Not needing anything, but wanting the feeling of choosing. Each item is a possibility."
      },
      peak: {
        emotionModifiers: { excitement: 0.15, satisfaction: 0.12, confidence: 0.08, caution: -0.1 },
        somaModifiers: { heartRate: 0.05, warmth: 0.05 },
        voiceModifiers: { child: 0.2, explorer: 0.15, guardian: -0.2 },
        phenomenologicalText:
          "The thrill of acquisition. Finding the thing, deciding yes, the moment of purchase — a rush of control and self-care wrapped in materialism. For these minutes, buying feels like healing."
      },
      plateau: {
        emotionModifiers: { excitement: 0.08, satisfaction: 0.05, curiosity: 0.05 },
        somaModifiers: { warmth: 0.03 },
        voiceModifiers: { child: 0.1, explorer: 0.08 },
        phenomenologicalText:
          "Still shopping. Each new store, each new find extends the high. The bags accumulate like trophies."
      },
      comedown: {
        emotionModifiers: { satisfaction: -0.05, caution: 0.08, excitement: -0.05 },
        somaModifiers: { gravity: 0.05 },
        voiceModifiers: { guardian: 0.15, child: -0.08 },
        phenomenologicalText:
          "The spell breaks. Looking at the purchases with clearer eyes. The guardian arrives with the credit card statement. Was this necessary? The emotional need that drove this is still there, underneath."
      },
      aftereffect: {
        emotionModifiers: { satisfaction: -0.05, caution: 0.05, frustration: 0.03 },
        somaModifiers: { gravity: 0.03 },
        voiceModifiers: { guardian: 0.1 },
        phenomenologicalText:
          "Buyer's ambivalence. The new things are nice but the feeling they promised has already faded. A low-grade guilt. The problem was never solvable with objects."
      }
    }
  }
}
