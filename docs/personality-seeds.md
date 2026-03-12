# Personality Seeds

Seeds use a 3-word mnemonic format with BIP39 words (e.g. `crystal-dawn-flame`). Each seed deterministically generates a complete personality DNA including Big Five traits, personality type, emotional baseline, values, aesthetics, and communication style.

## Format

- **Structure:** `word-word-word` (3 lowercase BIP39 words, hyphen-separated)
- **Word list:** [BIP39 English](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt) (2048 words)
- **Entropy:** 2048³ = 8,589,934,592 unique personalities
- **Examples:** `crystal-dawn-flame`, `frozen-tide-raven`, `amber-pulse-drift`

## How It Works

1. The 3-word seed is joined into a UTF-8 string (e.g. `"crystal-dawn-flame"`)
2. SHA-256 hashes the string; the first 8 bytes become a 64-bit seed
3. The seed feeds a deterministic PRNG (splitmix64)
4. The PRNG generates Big Five traits, from which all other personality dimensions are derived
