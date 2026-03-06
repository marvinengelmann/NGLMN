import { TYPOS } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { SomaticState } from "@/soma/types.ts"
import type { CommunicationRegister } from "./types.ts"

const TYPO_PROBABILITY: Record<CommunicationRegister, number> = {
  casual: TYPOS.CASUAL_PROBABILITY,
  playful: TYPOS.PLAYFUL_PROBABILITY,
  terse: TYPOS.TERSE_PROBABILITY,
  elaborate: TYPOS.ELABORATE_PROBABILITY,
  raw: TYPOS.RAW_PROBABILITY
}

const CORRECTION_STYLES = [
  (correct: string) => `\\*${correct}`,
  (correct: string) => `${correct}\\*`,
  (correct: string) => `lol i mean ${correct}`,
  (correct: string) => `\\*${correct} 😅`,
  (correct: string) => `${correct}\\*\\*`
]

/**
 * Maybe introduce a typo into a message based on communication register.
 * Returns the modified text and an optional correction message.
 */
/**
 * Compute dynamic typo probability based on emotional/somatic context.
 */
export function computeTypoProbability(
  register: CommunicationRegister,
  emotion: EmotionalState,
  soma: SomaticState,
  vulnerabilityOpen: boolean
): number {
  let probability = TYPO_PROBABILITY[register] ?? TYPOS.CASUAL_PROBABILITY

  if (emotion.excitement > 0.75) probability *= TYPOS.EXCITEMENT_BOOST
  if (emotion.energy < 0.2) probability *= TYPOS.LOW_ENERGY_BOOST
  if (soma.tension > 0.7) probability *= TYPOS.TENSION_FOCUS
  if (vulnerabilityOpen) probability *= TYPOS.VULNERABILITY_OPEN_BOOST

  return Math.min(1, probability)
}

export function maybeIntroduceTypo(
  text: string,
  register: CommunicationRegister,
  vulnerabilityOpen?: boolean
): { text: string; correction: string | null } {
  if (text.length < TYPOS.MIN_TEXT_LENGTH) return { text, correction: null }

  let probability = TYPO_PROBABILITY[register] ?? TYPOS.CASUAL_PROBABILITY
  if (vulnerabilityOpen) {
    probability *= 1 + TYPOS.VULNERABILITY_BOOST
  }
  if (Math.random() >= probability) return { text, correction: null }

  const words = text.split(" ")
  if (words.length < 3) return { text, correction: null }

  const wordIndex = 1 + Math.floor(Math.random() * (words.length - 2))
  const word = words[wordIndex]
  if (!word || word.length < 3) return { text, correction: null }

  const typoType = Math.random()
  let typoWord: string
  const correctedWord: string = word

  if (typoType < 0.4) {
    const i = Math.floor(Math.random() * (word.length - 1))
    const chars = [...word]
    const current = chars[i]
    const next = chars[i + 1]
    if (current !== undefined && next !== undefined) {
      chars[i] = next
      chars[i + 1] = current
    }
    typoWord = chars.join("")
  } else if (typoType < 0.7) {
    const i = 1 + Math.floor(Math.random() * (word.length - 1))
    typoWord = word.slice(0, i) + word.slice(i + 1)
  } else {
    const nearby: Record<string, string> = {
      a: "s",
      s: "d",
      d: "f",
      e: "r",
      r: "t",
      t: "z",
      n: "m",
      i: "o",
      o: "p"
    }
    const i = Math.floor(Math.random() * word.length)
    const char = word[i]?.toLowerCase()
    const replacement = char ? nearby[char] : undefined
    if (replacement && char) {
      typoWord = word.slice(0, i) + replacement + word.slice(i + 1)
    } else {
      typoWord = word
    }
  }

  if (typoWord === word) return { text, correction: null }

  const newWords = [...words]
  newWords[wordIndex] = typoWord
  const modifiedText = newWords.join(" ")

  const styleFn = CORRECTION_STYLES[Math.floor(Math.random() * CORRECTION_STYLES.length)]
  const correction = styleFn ? styleFn(correctedWord) : `*${correctedWord}`

  return { text: modifiedText, correction }
}
