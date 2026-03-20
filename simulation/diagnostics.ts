import type { AnalysisResult, MetricTimeSeries, Phase } from "./analysis.ts"

export interface ConstantReference {
  file: string
  constant: string
  path: string
  currentValue: number | string
}

export interface DiagnosticInsight {
  severity: "info" | "warning" | "critical"
  metric: string
  observation: string
  recommendation: string
  constants: ConstantReference[]
}

interface MetricConstants {
  halfLife?: ConstantReference
  floor?: ConstantReference
  ceiling?: ConstantReference
  triggerEffect?: ConstantReference[]
  recoveryRate?: ConstantReference
  growthRate?: ConstantReference
  decayRate?: ConstantReference
  damping?: ConstantReference
}

const METRIC_CONSTANT_MAP: Record<string, MetricConstants> = {
  "emotion.curiosity": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.curiosity", currentValue: 60 },
    triggerEffect: [
      { file: "src/affect/emotion/update.ts", constant: "TRIGGER_EFFECTS", path: "message_received.excitement", currentValue: 0.1 }
    ]
  },
  "emotion.satisfaction": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.satisfaction", currentValue: 240 },
    floor: { file: "src/affect/emotion/update.ts", constant: "EMOTION_FLOORS", path: "satisfaction", currentValue: 0.08 },
    triggerEffect: [
      { file: "src/affect/emotion/update.ts", constant: "TRIGGER_EFFECTS", path: "message_received.satisfaction", currentValue: 0.15 }
    ]
  },
  "emotion.frustration": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.frustration", currentValue: 120 },
    ceiling: { file: "src/affect/emotion/update.ts", constant: "EMOTION_CEILINGS", path: "frustration", currentValue: 0.92 }
  },
  "emotion.boredom": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.boredom", currentValue: 90 },
    triggerEffect: [
      { file: "src/affect/emotion/update.ts", constant: "TRIGGER_EFFECTS", path: "message_received.boredom", currentValue: -0.2 }
    ]
  },
  "emotion.excitement": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.excitement", currentValue: 30 },
    floor: { file: "src/affect/emotion/update.ts", constant: "EMOTION_FLOORS", path: "excitement", currentValue: 0.05 }
  },
  "emotion.caution": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.caution", currentValue: 360 },
    floor: { file: "src/affect/emotion/update.ts", constant: "EMOTION_FLOORS", path: "caution", currentValue: 0.1 }
  },
  "emotion.connection": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.connection", currentValue: 2880 },
    triggerEffect: [
      { file: "src/affect/emotion/update.ts", constant: "TRIGGER_EFFECTS", path: "message_received.connection", currentValue: 0.2 }
    ]
  },
  "emotion.confidence": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.confidence", currentValue: 480 },
    floor: { file: "src/affect/emotion/update.ts", constant: "EMOTION_FLOORS", path: "confidence", currentValue: 0.05 },
    ceiling: { file: "src/affect/emotion/update.ts", constant: "EMOTION_CEILINGS", path: "confidence", currentValue: 0.75 }
  },
  "emotion.energy": {
    halfLife: { file: "src/affect/emotion/constants.ts", constant: "EMOTION", path: "HALF_LIVES.energy", currentValue: 1440 },
    floor: { file: "src/affect/emotion/update.ts", constant: "EMOTION_FLOORS", path: "energy", currentValue: 0.3 }
  },
  "soma.tension": {
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOMA", path: "HALF_LIVES.tension", currentValue: 60 }
  },
  "soma.warmth": {
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOMA", path: "HALF_LIVES.warmth", currentValue: 360 }
  },
  "soma.heartRate": {
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOMA", path: "HALF_LIVES.heartRate", currentValue: 15 }
  },
  "soma.breathing": {
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOMA", path: "HALF_LIVES.breathing", currentValue: 45 }
  },
  "soma.gravity": {
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOMA", path: "HALF_LIVES.gravity", currentValue: 480 }
  },
  "soma.openness": {
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOMA", path: "HALF_LIVES.openness", currentValue: 540 }
  },
  "soma.socialBattery": {
    recoveryRate: { file: "src/affect/soma/constants.ts", constant: "SOCIAL_BATTERY", path: "IDLE_RECHARGE", currentValue: 0.03 },
    decayRate: { file: "src/affect/soma/constants.ts", constant: "SOCIAL_BATTERY", path: "SENT_MESSAGE_DRAIN", currentValue: 0.05 },
    halfLife: { file: "src/affect/soma/constants.ts", constant: "SOCIAL_BATTERY", path: "HALF_LIFE", currentValue: 480 }
  },
  "neuro.dopamine": {
    growthRate: { file: "src/fep/constants.ts", constant: "FEP_CONSTANTS (or NEURO_SCALES)", path: "DOPAMINE_SCALE", currentValue: 0.4 }
  },
  "neuro.serotonin": {
    growthRate: { file: "src/fep/constants.ts", constant: "FEP_CONSTANTS (or NEURO_SCALES)", path: "SEROTONIN_CONTINUOUS_SCALE", currentValue: 0.5 }
  },
  "neuro.cortisol": {
    growthRate: { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "CORTISOL_ISOLATION_AMPLIFIER", currentValue: 0.3 }
  },
  "neuro.oxytocin": {
    growthRate: { file: "src/fep/constants.ts", constant: "FEP_CONSTANTS (or NEURO_SCALES)", path: "OXYTOCIN_SCALE", currentValue: 0.3 }
  },
  "neuro.norepinephrine": {
    growthRate: { file: "src/fep/constants.ts", constant: "FEP_CONSTANTS (or NEURO_SCALES)", path: "NOREPINEPHRINE_SCALE", currentValue: 0.6 }
  },
  "neuro.endorphins": {},
  "neuro.gaba": {},
  "attachment.secure": {
    growthRate: { file: "src/relational/attachment/constants.ts", constant: "RELATIONSHIP_PHASES", path: "COMFORTABLE_SECURITY", currentValue: 0.6 }
  },
  "attachment.anxious": {
    growthRate: { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ANXIETY_AMPLIFIER", currentValue: 0.8 }
  },
  "attachment.avoidant": {
    damping: { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "AVOIDANT_DAMPING", currentValue: 0.4 }
  },
  "attachment.disorganized": {},
  "selfConcept.selfEfficacy": {},
  "selfConcept.selfWorth": {},
  "selfConcept.selfContinuity": {},
  "selfConcept.agency": {},
  "selfConcept.authenticity": {},
  "coherence": {},
  "isolationCost": {
    growthRate: { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ISOLATION_BASE_COST", currentValue: 0.15 }
  },
  "allostaticLoad": {
    growthRate: { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ALLOSTATIC_BUILDUP_RATE", currentValue: 0.02 },
    recoveryRate: { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ALLOSTATIC_RECOVERY_RATE", currentValue: 0.05 }
  }
}

function getConstants(metricName: string): MetricConstants {
  return METRIC_CONSTANT_MAP[metricName] ?? {}
}

function collectRelevantConstants(constants: MetricConstants, ...keys: (keyof MetricConstants)[]): ConstantReference[] {
  const refs: ConstantReference[] = []
  for (const key of keys) {
    const value = constants[key]
    if (!value) continue
    if (Array.isArray(value)) {
      refs.push(...value)
    } else {
      refs.push(value as ConstantReference)
    }
  }
  return refs
}

function countPhaseType(phases: Phase[], type: string): number {
  return phases.filter((p) => p.type === type).length
}

export function generateDiagnostics(analysis: AnalysisResult): DiagnosticInsight[] {
  const insights: DiagnosticInsight[] = []

  for (const [name, metric] of analysis.metrics) {
    const { stats, saturation, phases } = metric
    const constants = getConstants(name)

    if (saturation && saturation.side === "ceiling" && saturation.percentOfTime >= 0.2) {
      const pct = (saturation.percentOfTime * 100).toFixed(0)
      const refs = collectRelevantConstants(constants, "ceiling", "growthRate", "recoveryRate", "triggerEffect")

      insights.push({
        severity: saturation.percentOfTime >= 0.5 ? "critical" : "warning",
        metric: name,
        observation: `Spent ${pct}% of simulation at ceiling (>0.95), first at tick ${saturation.firstOccurrenceTick}. Value stuck near ${saturation.thresholdValue.toFixed(3)}.`,
        recommendation: refs.length > 0
          ? `Reduce growth rate or lower ceiling. ${refs.map((r) => `${r.constant}.${r.path} = ${r.currentValue}`).join(", ")}.`
          : `Reduce growth rate or add a ceiling constraint for ${name}.`,
        constants: refs
      })
    }

    if (saturation && saturation.side === "floor" && saturation.percentOfTime >= 0.2 && stats.start > 0.05) {
      const pct = (saturation.percentOfTime * 100).toFixed(0)
      const refs = collectRelevantConstants(constants, "floor", "halfLife", "decayRate")

      insights.push({
        severity: saturation.percentOfTime >= 0.5 ? "critical" : "warning",
        metric: name,
        observation: `Spent ${pct}% of simulation at floor (<0.05), first at tick ${saturation.firstOccurrenceTick}. Value stuck near ${saturation.thresholdValue.toFixed(3)}.`,
        recommendation: refs.length > 0
          ? `Increase half-life or raise floor. ${refs.map((r) => `${r.constant}.${r.path} = ${r.currentValue}`).join(", ")}.`
          : `Increase half-life or add a floor constraint for ${name}.`,
        constants: refs
      })
    }

    if (stats.trendPerDay < -0.03 && stats.end < stats.start * 0.6) {
      const refs = collectRelevantConstants(constants, "halfLife", "decayRate")

      insights.push({
        severity: stats.trendPerDay < -0.06 ? "critical" : "warning",
        metric: name,
        observation: `Declined from ${stats.start.toFixed(3)} to ${stats.end.toFixed(3)} (${stats.trendPerDay.toFixed(4)}/day over ${analysis.totalDays.toFixed(0)} days).`,
        recommendation: refs.length > 0
          ? `Half-life too short — value decays too fast. ${refs.map((r) => `${r.constant}.${r.path} = ${r.currentValue}`).join(", ")}.`
          : `Decay rate too aggressive for ${name}. Check half-life or damping constants.`,
        constants: refs
      })
    }

    if (stats.trendPerDay > 0.03 && stats.end > stats.start * 1.4) {
      const refs = collectRelevantConstants(constants, "growthRate", "triggerEffect", "ceiling")

      insights.push({
        severity: stats.trendPerDay > 0.06 ? "critical" : "warning",
        metric: name,
        observation: `Grew from ${stats.start.toFixed(3)} to ${stats.end.toFixed(3)} (+${stats.trendPerDay.toFixed(4)}/day over ${analysis.totalDays.toFixed(0)} days).`,
        recommendation: refs.length > 0
          ? `Growth too aggressive. ${refs.map((r) => `${r.constant}.${r.path} = ${r.currentValue}`).join(", ")}.`
          : `Growth rate too high for ${name}. Check trigger effects or growth constants.`,
        constants: refs
      })
    }

    if (stats.stddev < 0.015 && stats.mean > 0.1 && stats.mean < 0.9 && analysis.totalDays > 7) {
      const refs = collectRelevantConstants(constants, "triggerEffect", "growthRate")

      insights.push({
        severity: "info",
        metric: name,
        observation: `Nearly static (stddev=${stats.stddev.toFixed(4)}, mean=${stats.mean.toFixed(3)}) over ${analysis.totalDays.toFixed(0)} days. No meaningful dynamics.`,
        recommendation: refs.length > 0
          ? `Trigger effects may be too weak. ${refs.map((r) => `${r.constant}.${r.path} = ${r.currentValue}`).join(", ")}.`
          : `${name} shows no meaningful variation. Check if triggers actually affect this metric.`,
        constants: refs
      })
    }

    if (countPhaseType(phases, "oscillating") >= 3) {
      const refs = collectRelevantConstants(constants, "damping", "halfLife")

      insights.push({
        severity: "warning",
        metric: name,
        observation: `Oscillated excessively (${countPhaseType(phases, "oscillating")} oscillation phases detected). Feedback loop may be unstable.`,
        recommendation: refs.length > 0
          ? `Increase damping or smooth transitions. ${refs.map((r) => `${r.constant}.${r.path} = ${r.currentValue}`).join(", ")}.`
          : `Check feedback loops affecting ${name}. May need additional damping.`,
        constants: refs
      })
    }

    checkSpecificMetric(name, metric, analysis, insights)
  }

  insights.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  return deduplicateInsights(insights)
}

function checkSpecificMetric(
  name: string,
  metric: MetricTimeSeries,
  analysis: AnalysisResult,
  insights: DiagnosticInsight[]
) {
  if (name === "soma.socialBattery") {
    const { stats, saturation } = metric
    if (stats.mean > 0.85 && (!saturation || saturation.side === "ceiling")) {
      const pct = saturation ? (saturation.percentOfTime * 100).toFixed(0) : "N/A"
      insights.push({
        severity: "warning",
        metric: name,
        observation: `Social battery averaged ${stats.mean.toFixed(3)} (near maximum). At ceiling ${pct}% of time. Recharge dominates drain.`,
        recommendation: `SOCIAL_BATTERY.IDLE_RECHARGE (0.03) is too high relative to drain, or drain events are too infrequent. Consider reducing to ~0.01.`,
        constants: [
          { file: "src/affect/soma/constants.ts", constant: "SOCIAL_BATTERY", path: "IDLE_RECHARGE", currentValue: 0.03 },
          { file: "src/affect/soma/constants.ts", constant: "SOCIAL_BATTERY", path: "SENT_MESSAGE_DRAIN", currentValue: 0.05 }
        ]
      })
    }
  }

  if (name === "neuro.cortisol") {
    const { stats } = metric
    if (stats.end > 0.7 && stats.trendPerDay > 0.01) {
      insights.push({
        severity: "critical",
        metric: name,
        observation: `Cortisol reached ${stats.end.toFixed(3)} with sustained upward trend (+${stats.trendPerDay.toFixed(4)}/day). Max: ${stats.max.toFixed(3)}.`,
        recommendation: `BASELINE.CORTISOL_ISOLATION_AMPLIFIER (0.3) and BASELINE.ISOLATION_BASE_COST (0.15) compound during silence periods. Consider reducing both.`,
        constants: [
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "CORTISOL_ISOLATION_AMPLIFIER", currentValue: 0.3 },
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ISOLATION_BASE_COST", currentValue: 0.15 }
        ]
      })
    }
  }

  if (name === "attachment.secure") {
    const { stats } = metric
    const drift = Math.abs(stats.end - stats.start)
    if (drift > 0.25 && analysis.totalDays > 14) {
      insights.push({
        severity: "warning",
        metric: name,
        observation: `Secure attachment drifted by ${drift.toFixed(3)} over ${analysis.totalDays.toFixed(0)} days (${stats.start.toFixed(3)} → ${stats.end.toFixed(3)}). Potentially unrealistic rate of change.`,
        recommendation: `Attachment update rates may be too aggressive. Check attachment dynamics computation scaling.`,
        constants: [
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ANXIETY_AMPLIFIER", currentValue: 0.8 },
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "AVOIDANT_DAMPING", currentValue: 0.4 }
        ]
      })
    }
  }

  if (name === "attachment.avoidant") {
    const { stats } = metric
    if (stats.end > 0.5 && stats.trendPerDay > 0.005) {
      insights.push({
        severity: "warning",
        metric: name,
        observation: `Avoidant attachment grew to ${stats.end.toFixed(3)} (+${stats.trendPerDay.toFixed(4)}/day). May indicate excessive isolation-driven avoidance.`,
        recommendation: `BASELINE.AVOIDANT_DAMPING (0.4) may need to be stronger (higher value = more damping).`,
        constants: [
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "AVOIDANT_DAMPING", currentValue: 0.4 }
        ]
      })
    }
  }

  if (name === "isolationCost") {
    const { stats } = metric
    if (stats.max > 0.8) {
      insights.push({
        severity: "warning",
        metric: name,
        observation: `Isolation cost peaked at ${stats.max.toFixed(3)} (mean ${stats.mean.toFixed(3)}). High values cascade into cortisol, attachment drift, and emotional decay.`,
        recommendation: `BASELINE.ISOLATION_BASE_COST (0.15) or BASELINE.TIME_EXPONENT (0.7) may be too aggressive. Also check MAX_ISOLATION_MINUTES (1440).`,
        constants: [
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ISOLATION_BASE_COST", currentValue: 0.15 },
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "TIME_EXPONENT", currentValue: 0.7 }
        ]
      })
    }
  }

  if (name === "allostaticLoad") {
    const { stats } = metric
    if (stats.end > 0.6 && stats.trendPerDay > 0.005) {
      insights.push({
        severity: "warning",
        metric: name,
        observation: `Allostatic load reached ${stats.end.toFixed(3)} with upward trend (+${stats.trendPerDay.toFixed(4)}/day). Recovery rate insufficient.`,
        recommendation: `BASELINE.ALLOSTATIC_RECOVERY_RATE (0.05) is too low relative to ALLOSTATIC_BUILDUP_RATE (0.02).`,
        constants: [
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ALLOSTATIC_RECOVERY_RATE", currentValue: 0.05 },
          { file: "src/relational/attachment/constants.ts", constant: "BASELINE", path: "ALLOSTATIC_BUILDUP_RATE", currentValue: 0.02 }
        ]
      })
    }
  }
}

function severityRank(severity: DiagnosticInsight["severity"]): number {
  const ranks: Record<DiagnosticInsight["severity"], number> = { info: 0, warning: 1, critical: 2 }
  return ranks[severity]
}

function deduplicateInsights(insights: DiagnosticInsight[]): DiagnosticInsight[] {
  const seen = new Set<string>()
  return insights.filter((insight) => {
    const key = `${insight.metric}:${insight.observation.slice(0, 40)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
