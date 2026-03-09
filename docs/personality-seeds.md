# Personality Seeds

Seeds use a human-readable `xxx-xxx` format (6 base36 characters, `0-9a-z`). Each seed deterministically generates a complete personality DNA including Big Five traits, personality type, emotional baseline, values, aesthetics, and communication style.

## Format

- **Characters:** `0-9a-z` (base36)
- **Length:** 6 characters split by hyphen → `xxx-xxx`
- **Range:** `000-000` to `zik-0zj` (0 to 2,147,483,647)
- **Total:** 2,147,483,648 unique personalities

## Example Seeds by Personality Type

| Type | Seed |
|------|------|
| INFP | `000-000` |
| ENFP | `000-001` |
| INTP | `000-002` |
| ISTP | `000-003` |
| ENTP | `000-004` |
| INTJ | `000-006` |
| ISTJ | `000-007` |
| ESTJ | `000-008` |
| ESFP | `000-009` |
| ISFP | `000-00f` |
| INFJ | `000-00g` |
| ENFJ | `000-00k` |
| ESTP | `000-00n` |
| ENTJ | `000-00o` |
| ESFJ | `000-00v` |
| ISFJ | `000-00w` |

## How It Works

1. The seed string is decoded from base36 to a number
2. The number is XOR-scrambled with a fixed salt (`0x27D4EB2F`) for optimal distribution
3. The scrambled value feeds a deterministic PRNG (mulberry32)
4. The PRNG generates Big Five traits, from which all other personality dimensions are derived
