import type { StateSnapshot } from "./observer.ts"

export interface TimeSeriesStats {
  start: number
  end: number
  min: number
  max: number
  mean: number
  stddev: number
  trendPerDay: number
}

export interface SaturationInfo {
  metric: string
  side: "ceiling" | "floor"
  percentOfTime: number
  firstOccurrenceTick: number
  firstOccurrenceTimestamp: string
  thresholdValue: number
}

export type PhaseType = "stable" | "rising" | "falling" | "oscillating" | "saturated_high" | "saturated_low"

export interface Phase {
  type: PhaseType
  startTick: number
  endTick: number
  startTimestamp: string
  endTimestamp: string
  startDay: number
  endDay: number
  meanValue: number
  deltaOverPhase: number
  ratePerDay: number
}

export interface WeeklyAggregate {
  weekNumber: number
  startDay: number
  endDay: number
  means: Record<string, number>
  deltas: Record<string, number>
}

export interface MetricTimeSeries {
  name: string
  stats: TimeSeriesStats
  saturation: SaturationInfo | null
  phases: Phase[]
}

export interface AnalysisResult {
  metrics: Map<string, MetricTimeSeries>
  weeklyAggregates: WeeklyAggregate[]
  saturations: SaturationInfo[]
  highVarianceMetrics: string[]
  tooStableMetrics: string[]
  totalDays: number
}

export function extractAllMetrics(snapshots: StateSnapshot[]): Map<string, number[]> {
  const metrics = new Map<string, number[]>()

  const emotionKeys = Object.keys(snapshots[0]!.emotion) as (keyof typeof snapshots[0]["emotion"])[]
  for (const key of emotionKeys) {
    metrics.set(`emotion.${key}`, snapshots.map((s) => s.emotion[key]))
  }

  const somaKeys = Object.keys(snapshots[0]!.soma) as (keyof typeof snapshots[0]["soma"])[]
  for (const key of somaKeys) {
    metrics.set(`soma.${key}`, snapshots.map((s) => s.soma[key]))
  }

  const neuroNames = ["dopamine", "serotonin", "norepinephrine", "oxytocin", "cortisol", "endorphins", "gaba"] as const
  for (const name of neuroNames) {
    metrics.set(`neuro.${name}`, snapshots.map((s) => s.neuromodulation[name].level))
  }

  const attachmentKeys = Object.keys(snapshots[0]!.attachment) as (keyof typeof snapshots[0]["attachment"])[]
  for (const key of attachmentKeys) {
    metrics.set(`attachment.${key}`, snapshots.map((s) => s.attachment[key]))
  }

  const selfConceptKeys = Object.keys(snapshots[0]!.selfConcept) as (keyof typeof snapshots[0]["selfConcept"])[]
  for (const key of selfConceptKeys) {
    metrics.set(`selfConcept.${key}`, snapshots.map((s) => s.selfConcept[key]))
  }

  const regionKeys = Object.keys(snapshots[0]!.regionalActivation) as (keyof typeof snapshots[0]["regionalActivation"])[]
  for (const key of regionKeys) {
    metrics.set(`region.${key}`, snapshots.map((s) => s.regionalActivation[key]))
  }

  metrics.set("inflammationLevel", snapshots.map((s) => s.inflammationLevel))
  metrics.set("sensitizationPeak", snapshots.map((s) => s.sensitizationPeak))
  metrics.set("vulnerabilityPeak", snapshots.map((s) => s.vulnerabilityPeak))
  metrics.set("coherence", snapshots.map((s) => s.coherence.integrationScore))
  metrics.set("isolationCost", snapshots.map((s) => s.isolationCost))
  metrics.set("allostaticLoad", snapshots.map((s) => s.allostaticLoad))

  return metrics
}

export function computeStats(values: number[], ticksPerDay: number): TimeSeriesStats {
  const n = values.length
  const start = values[0]!
  const end = values.at(-1)!

  let min = Infinity
  let max = -Infinity
  let sum = 0

  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }

  const mean = sum / n

  let varianceSum = 0
  for (const v of values) {
    varianceSum += (v - mean) ** 2
  }
  const stddev = Math.sqrt(varianceSum / n)

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  for (const [i, v] of values.entries()) {
    sumX += i
    sumY += v
    sumXY += i * v
    sumX2 += i * i
  }
  const slopePerSample = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const trendPerDay = slopePerSample * ticksPerDay

  return { start, end, min, max, mean, stddev, trendPerDay }
}

export function detectSaturation(
  values: number[],
  snapshots: StateSnapshot[],
  metricName: string
): SaturationInfo | null {
  const ceilingThreshold = 0.95
  const floorThreshold = 0.05

  let ceilingCount = 0
  let floorCount = 0
  let firstCeilingIdx = -1
  let firstFloorIdx = -1

  for (const [i, v] of values.entries()) {
    if (v >= ceilingThreshold) {
      ceilingCount++
      if (firstCeilingIdx === -1) firstCeilingIdx = i
    }
    if (v <= floorThreshold) {
      floorCount++
      if (firstFloorIdx === -1) firstFloorIdx = i
    }
  }

  const ceilingPercent = ceilingCount / values.length
  const floorPercent = floorCount / values.length

  if (ceilingPercent >= 0.05 && ceilingPercent >= floorPercent) {
    return {
      metric: metricName,
      side: "ceiling",
      percentOfTime: ceilingPercent,
      firstOccurrenceTick: snapshots[firstCeilingIdx]!.tickNumber,
      firstOccurrenceTimestamp: snapshots[firstCeilingIdx]!.timestamp,
      thresholdValue: values[firstCeilingIdx]!
    }
  }

  if (floorPercent >= 0.05) {
    return {
      metric: metricName,
      side: "floor",
      percentOfTime: floorPercent,
      firstOccurrenceTick: snapshots[firstFloorIdx]!.tickNumber,
      firstOccurrenceTimestamp: snapshots[firstFloorIdx]!.timestamp,
      thresholdValue: values[firstFloorIdx]!
    }
  }

  return null
}

export function detectPhases(
  values: number[],
  snapshots: StateSnapshot[],
  ticksPerDay: number
): Phase[] {
  if (values.length < 4) return []

  const windowSize = Math.max(4, Math.floor(values.length / 20))
  const classifications: { type: PhaseType; tick: number; timestamp: string; value: number; day: number }[] = []

  for (let i = 0; i <= values.length - windowSize; i += Math.max(1, Math.floor(windowSize / 2))) {
    const window = values.slice(i, i + windowSize)
    const tick = snapshots[i]!.tickNumber
    const timestamp = snapshots[i]!.timestamp
    const day = i / ticksPerDay

    const windowMean = window.reduce((a, b) => a + b, 0) / window.length

    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumX2 = 0
    for (const [j, v] of window.entries()) {
      sumX += j
      sumY += v
      sumXY += j * v
      sumX2 += j * j
    }
    const n = window.length
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    let windowVariance = 0
    for (const v of window) {
      windowVariance += (v - windowMean) ** 2
    }
    const windowStddev = Math.sqrt(windowVariance / n)

    let type: PhaseType
    if (windowMean >= 0.93) {
      type = "saturated_high"
    } else if (windowMean <= 0.07) {
      type = "saturated_low"
    } else if (windowStddev > 0.08 && Math.abs(slope) < 0.001) {
      type = "oscillating"
    } else if (slope > 0.001) {
      type = "rising"
    } else if (slope < -0.001) {
      type = "falling"
    } else {
      type = "stable"
    }

    classifications.push({ type, tick, timestamp, value: windowMean, day })
  }

  if (classifications.length === 0) return []

  const phases: Phase[] = []
  let currentPhase = classifications[0]!
  let phaseStart = currentPhase

  for (const c of classifications.slice(1)) {
    if (c.type !== currentPhase.type) {
      phases.push({
        type: currentPhase.type,
        startTick: phaseStart.tick,
        endTick: c.tick,
        startTimestamp: phaseStart.timestamp,
        endTimestamp: c.timestamp,
        startDay: Math.floor(phaseStart.day),
        endDay: Math.floor(c.day),
        meanValue: (phaseStart.value + currentPhase.value) / 2,
        deltaOverPhase: currentPhase.value - phaseStart.value,
        ratePerDay: c.day !== phaseStart.day ? (currentPhase.value - phaseStart.value) / (c.day - phaseStart.day) : 0
      })
      phaseStart = c
    }
    currentPhase = c
  }

  const lastClassification = classifications.at(-1)!
  phases.push({
    type: currentPhase.type,
    startTick: phaseStart.tick,
    endTick: lastClassification.tick,
    startTimestamp: phaseStart.timestamp,
    endTimestamp: lastClassification.timestamp,
    startDay: Math.floor(phaseStart.day),
    endDay: Math.floor(lastClassification.day),
    meanValue: (phaseStart.value + lastClassification.value) / 2,
    deltaOverPhase: lastClassification.value - phaseStart.value,
    ratePerDay: lastClassification.day !== phaseStart.day
      ? (lastClassification.value - phaseStart.value) / (lastClassification.day - phaseStart.day)
      : 0
  })

  const merged = mergeShortPhases(phases, 3)
  return merged.filter((p) => p.endDay - p.startDay >= 2 || merged.length <= 3)
}

function mergeShortPhases(phases: Phase[], minDays: number): Phase[] {
  if (phases.length <= 1) return phases

  const merged: Phase[] = [phases[0]!]

  for (const phase of phases.slice(1)) {
    const prev = merged.at(-1)!
    const prevDuration = prev.endDay - prev.startDay
    const currentDuration = phase.endDay - phase.startDay

    if (prevDuration < minDays || (currentDuration < minDays && phase.type === prev.type)) {
      prev.endTick = phase.endTick
      prev.endTimestamp = phase.endTimestamp
      prev.endDay = phase.endDay
      prev.meanValue = (prev.meanValue + phase.meanValue) / 2
      prev.deltaOverPhase = prev.deltaOverPhase + phase.deltaOverPhase
      const totalDays = prev.endDay - prev.startDay
      prev.ratePerDay = totalDays > 0 ? prev.deltaOverPhase / totalDays : 0
    } else {
      merged.push({ ...phase })
    }
  }

  return merged
}

export function computeWeeklyAggregates(
  snapshots: StateSnapshot[],
  metrics: Map<string, number[]>,
  ticksPerDay: number
): WeeklyAggregate[] {
  const ticksPerWeek = ticksPerDay * 7
  const totalTicks = snapshots.at(-1)!.tickNumber
  const totalWeeks = Math.ceil(totalTicks / ticksPerWeek)

  const weeks: WeeklyAggregate[] = []

  for (const weekNum of Array.from({ length: totalWeeks }, (_, i) => i)) {
    const weekStartTick = weekNum * ticksPerWeek
    const weekEndTick = (weekNum + 1) * ticksPerWeek

    const indicesInWeek: number[] = []
    for (const [i, s] of snapshots.entries()) {
      if (s.tickNumber >= weekStartTick && s.tickNumber < weekEndTick) {
        indicesInWeek.push(i)
      }
    }

    if (indicesInWeek.length === 0) continue

    const means: Record<string, number> = {}
    const deltas: Record<string, number> = {}

    for (const [name, values] of metrics) {
      const weekValues = indicesInWeek.map((i) => values[i]!)
      const weekMean = weekValues.reduce((a, b) => a + b, 0) / weekValues.length
      means[name] = weekMean

      const prevWeek = weeks.at(-1)
      deltas[name] = prevWeek ? weekMean - (prevWeek.means[name] ?? weekMean) : 0
    }

    weeks.push({
      weekNumber: weekNum + 1,
      startDay: weekNum * 7 + 1,
      endDay: Math.min((weekNum + 1) * 7, Math.ceil(totalTicks / ticksPerDay)),
      means,
      deltas
    })
  }

  return weeks
}

export function analyzeSnapshots(
  snapshots: StateSnapshot[],
  tickIntervalMinutes: number,
  snapshotInterval: number
): AnalysisResult {
  if (snapshots.length < 2) {
    return {
      metrics: new Map(),
      weeklyAggregates: [],
      saturations: [],
      highVarianceMetrics: [],
      tooStableMetrics: [],
      totalDays: 0
    }
  }

  const ticksPerDay = 1440 / tickIntervalMinutes
  const snapshotsPerDay = ticksPerDay / snapshotInterval
  const totalTicks = snapshots.at(-1)!.tickNumber
  const totalDays = totalTicks / ticksPerDay

  const allMetrics = extractAllMetrics(snapshots)
  const metricResults = new Map<string, MetricTimeSeries>()
  const saturations: SaturationInfo[] = []
  const highVarianceMetrics: string[] = []
  const tooStableMetrics: string[] = []

  for (const [name, values] of allMetrics) {
    const stats = computeStats(values, snapshotsPerDay)
    const saturation = detectSaturation(values, snapshots, name)
    const phases = detectPhases(values, snapshots, snapshotsPerDay)

    metricResults.set(name, { name, stats, saturation, phases })

    if (saturation && saturation.percentOfTime >= 0.2) {
      saturations.push(saturation)
    }

    if (stats.stddev > 0.12) {
      highVarianceMetrics.push(name)
    }

    if (stats.stddev < 0.02 && stats.mean > 0.1 && stats.mean < 0.9) {
      tooStableMetrics.push(name)
    }
  }

  saturations.sort((a, b) => b.percentOfTime - a.percentOfTime)

  const weeklyAggregates = computeWeeklyAggregates(snapshots, allMetrics, ticksPerDay)

  return {
    metrics: metricResults,
    weeklyAggregates,
    saturations,
    highVarianceMetrics,
    tooStableMetrics,
    totalDays
  }
}
