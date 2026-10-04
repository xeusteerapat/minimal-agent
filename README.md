# minimal-agent

A minimal terminal AI agent built on the [AI SDK](https://ai-sdk.dev) `ToolLoopAgent`.
It can run against a hosted model with your own API key, or a local model through Ollama.

How it works behind the scenes (Thai): [docs/how-it-works.th.md](docs/how-it-works.th.md)

## Setup

```sh
pnpm install
cp .env.example .env   # then edit .env
pnpm start
```

### Fancy terminal UI

`pnpm start:tui` runs `src/tui.tsx`, the same `ToolLoopAgent` with an [Ink](https://github.com/vadimdemedes/ink) interface:
a header, a bordered input box, a spinner while the model thinks, live tool-call status (`…` / `✓` / `✗`),
and replies rendered as Markdown with syntax-highlighted code blocks (`marked` + `marked-terminal`).

## Choosing a model

| `PROVIDER`         | Needs               | Default `MODEL`     |
| ------------------ | ------------------- | ------------------- |
| `ollama` (default) | Ollama running      | `qwen3.5:9b`        |
| `openai`           | `OPENAI_API_KEY`    | `gpt-5.6`           |
| `anthropic`        | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` |

For Ollama, pull a model that supports tool calling first (`ollama pull qwen3.5:9b`).
`OLLAMA_BASE_URL` can point at any OpenAI-compatible server (LM Studio, llama.cpp, vLLM).

Variables can also be passed inline: `PROVIDER=openai OPENAI_API_KEY=sk-... pnpm start`.

## Tools

- `getCurrentTime`: returns the current time.
- `readFile`: reads a text file inside the current working directory.

Add more in `src/tools.ts`.

## Manual agent loop

`pnpm start:manual` runs `src/manual.ts`, the same agent without `ToolLoopAgent`.
It calls `streamText` once per step with tool definitions that have no `execute`, runs the
requested tools itself, appends the results as `tool` messages, and loops until the model
stops calling tools (or `MAX_STEPS` is reached). Tool errors are sent back to the model as
`error-text` results so it can recover.
