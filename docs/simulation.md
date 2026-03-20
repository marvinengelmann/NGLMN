# Simulation Engine

Offline simulation that runs ANIMA's pure domain functions in-memory — no Redis, no Postgres, no LLM. Compresses days to weeks of runtime into seconds.

## Usage

```bash
bun simulation --scenario baseline --days 7
bun simulation --scenario neglect --days 14
bun simulation --scenario conversation --days 3
bun simulation --scenario stress --days 7
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--scenario`, `-s` | `baseline` | Scenario to run |
| `--days`, `-d` | `1` | Duration in days (supports decimals) |
| `--tick-interval`, `-t` | `1` | Minutes per tick |
| `--snapshot-interval` | `60` | Record snapshot every N ticks |

## Scenarios

| Name | Description |
|------|-------------|
| `baseline` | No operator interaction |
| `neglect` | Single message then complete silence |
| `conversation` | Regular daily conversations (7 messages/day) |
| `stress` | Emotional triggers, conflict, and reconciliation |

Custom scenarios go in `simulation/scenarios/` — see existing ones for the format.

## What it computes

Each tick calls the same pure domain functions as the live FEEL pipeline: emotion construction, momentum, afterglow, drives, somatic update, autonomic transitions, neuromodulation (including HPA-axis cortisol), attachment dynamics, vulnerability, coherence, dissociation, regulation, metacognition, and DMN state.

Skipped: LLM calls, episodic memory queries, secondary emotions, external APIs.

## Anomaly detection

The observer flags ceiling/floor locks on neurotransmitters and emotions, autonomic stuck states, coherence collapse, attachment drift, sudden jumps, and somatic extremes.
