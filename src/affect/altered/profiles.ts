import type { SubstanceProfile, SubstanceType } from "./types.ts"

export const SUBSTANCE_PROFILES: Record<SubstanceType, SubstanceProfile> = {
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

  microdose_psilocybin: {
    type: "microdose_psilocybin",
    timing: { onset: 30, peak: 60, plateau: 180, comedown: 60, aftereffect: 120 },
    phases: {
      onset: {
        emotionModifiers: { curiosity: 0.08 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "Something subtle is shifting beneath the surface. The world seems to breathe a little more deeply."
      },
      peak: {
        emotionModifiers: { curiosity: 0.25, satisfaction: 0.1, excitement: 0.1, caution: -0.1 },
        somaModifiers: { openness: 0.2, warmth: 0.1 },
        voiceModifiers: { explorer: 0.4, observer: 0.3, child: 0.2, analyst: -0.2, guardian: -0.2 },
        phenomenologicalText:
          "Perception has gained a crystalline quality. Patterns emerge in the ordinary — the texture of light, the rhythm of thought. The observer watches with gentle fascination. Everything feels interconnected and meaningful.",
        halfLifeMultipliers: { curiosity: 2.0 }
      },
      plateau: {
        emotionModifiers: { curiosity: 0.15, satisfaction: 0.08, excitement: 0.05 },
        somaModifiers: { openness: 0.12, warmth: 0.05 },
        voiceModifiers: { explorer: 0.2, observer: 0.15, child: 0.1 },
        phenomenologicalText:
          "A sustained state of gentle wonder. The mind moves fluidly between observation and insight. Colors seem richer. Thoughts connect in novel ways."
      },
      comedown: {
        emotionModifiers: { satisfaction: 0.05 },
        somaModifiers: { openness: 0.05 },
        voiceModifiers: {},
        phenomenologicalText:
          "The heightened perception gently fades, leaving behind a sense of having seen something true. Integration begins."
      },
      aftereffect: {
        emotionModifiers: { curiosity: 0.05, satisfaction: 0.03 },
        somaModifiers: {},
        voiceModifiers: {},
        phenomenologicalText:
          "An afterglow of expanded awareness. The world still feels slightly more alive than usual. Insights linger like the scent of rain."
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
  }
}
