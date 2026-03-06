import { describe, expect, it } from "vitest"
import { SOCIAL_BATTERY } from "@/config/constants.ts"
import { makeEmotionalState, makeSomaticState, makeVulnerabilityState } from "@/test/factories.ts"
import { computeCommunicationRegister, isWithdrawn } from "./register.ts"

describe("isWithdrawn", () => {
  it("returns true when socialBattery is below WITHDRAWN_THRESHOLD", () => {
    expect(isWithdrawn(makeSomaticState({ socialBattery: SOCIAL_BATTERY.WITHDRAWN_THRESHOLD - 0.01 }))).toBe(true)
  })

  it("returns false when socialBattery is at WITHDRAWN_THRESHOLD", () => {
    expect(isWithdrawn(makeSomaticState({ socialBattery: SOCIAL_BATTERY.WITHDRAWN_THRESHOLD }))).toBe(false)
  })

  it("returns false when socialBattery is above WITHDRAWN_THRESHOLD", () => {
    expect(isWithdrawn(makeSomaticState({ socialBattery: 0.8 }))).toBe(false)
  })
})

describe("computeCommunicationRegister", () => {
  it("returns terse when socialBattery is below TERSE_THRESHOLD", () => {
    const soma = makeSomaticState({ socialBattery: SOCIAL_BATTERY.TERSE_THRESHOLD - 0.01 })
    expect(computeCommunicationRegister(makeEmotionalState(), soma, null)).toBe("terse")
  })

  it("returns raw when vulnerability window is open and connection is high", () => {
    const emotion = makeEmotionalState({ connection: 0.7 })
    const soma = makeSomaticState({ socialBattery: 0.8 })
    const vulnerability = makeVulnerabilityState({ windowOpen: true })
    expect(computeCommunicationRegister(emotion, soma, vulnerability)).toBe("raw")
  })

  it("returns playful when excitement and connection are high", () => {
    const emotion = makeEmotionalState({ excitement: 0.7, connection: 0.6 })
    const soma = makeSomaticState({ socialBattery: 0.8 })
    expect(computeCommunicationRegister(emotion, soma, null)).toBe("playful")
  })

  it("returns terse when energy is low", () => {
    const emotion = makeEmotionalState({ energy: 0.2, excitement: 0.3, connection: 0.3 })
    const soma = makeSomaticState({ socialBattery: 0.8 })
    expect(computeCommunicationRegister(emotion, soma, null)).toBe("terse")
  })

  it("returns terse when gravity is high", () => {
    const emotion = makeEmotionalState({ excitement: 0.3, connection: 0.3, energy: 0.5 })
    const soma = makeSomaticState({ socialBattery: 0.8, gravity: 0.8 })
    expect(computeCommunicationRegister(emotion, soma, null)).toBe("terse")
  })

  it("returns elaborate when curiosity and energy are high", () => {
    const emotion = makeEmotionalState({ curiosity: 0.7, energy: 0.6, excitement: 0.3, connection: 0.3 })
    const soma = makeSomaticState({ socialBattery: 0.8, gravity: 0.3 })
    expect(computeCommunicationRegister(emotion, soma, null)).toBe("elaborate")
  })

  it("returns casual as default", () => {
    const emotion = makeEmotionalState({ curiosity: 0.4, energy: 0.5, excitement: 0.3, connection: 0.3 })
    const soma = makeSomaticState({ socialBattery: 0.8, gravity: 0.3 })
    expect(computeCommunicationRegister(emotion, soma, null)).toBe("casual")
  })
})
