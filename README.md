# Clorn

A Discord bot for [Torn City](https://www.torn.com) powered by Claude AI. Talk to it in natural language and it queries the Torn API for you.

## Features

- **Natural language interface** — ask questions in plain English or Czech, Claude figures out which API calls to make
- **Player lookup** — search players by name or ID (profile, stats, faction, status)
- **Bar tracking** — check nerve, energy, happy, life with time-to-full calculations
- **Market prices** — look up item prices on bazaar and item market
- **Faction info** — faction stats, member lists
- **Financial overview** — cash, bank, vault, networth breakdown, stocks
- **Monitoring alerts** — get notified when your bars hit a target value (one-shot or recurring)
- **Slash commands** — `/torn`, `/bars`, `/money`, `/lookup`, `/market`, `/register`
- **Conversation memory** — bot remembers context for 10 minutes

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript
- **Discord**: discord.js v14
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) with tool use
- **Database**: PostgreSQL via Drizzle ORM
- **Scheduler**: `cron` package for monitor polling

## Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- PostgreSQL running locally
- A [Discord bot application](https://discord.com/developers/applications) with:
  - `bot` + `applications.commands` scopes
  - **Message Content Intent** enabled
- An [Anthropic API key](https://console.anthropic.com/)
- A [Torn API key](https://www.torn.com/preferences.php#tab=api)

### Installation

```bash
git clone https://github.com/itIsMaku/clorn.git
cd clorn
bun install
```

### Docker (recommended)

```bash
git clone https://github.com/itIsMaku/clorn.git
cd clorn
./setup.sh
```

The setup script will prompt for your tokens, auto-generate encryption keys, and start everything with Docker Compose (bot + PostgreSQL).

```bash
docker compose logs -f bot    # view logs
docker compose down            # stop
docker compose up -d           # start again
```

### Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ENCRYPTION_KEY` | 64 hex chars for AES-256-GCM encryption of stored Torn API keys. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/clorn`) |
| `CLAUDE_MODEL` | Claude model to use (default: `claude-sonnet-4-6`) |

### Database

Create the database and run migrations:

```bash
createdb clorn
bun run db:generate   # only if you changed the schema
bun run dev           # migrations run automatically on startup
```

### Running

```bash
bun run dev       # development with hot reload
bun run build     # production build
bun run start     # run production build
```

## Usage

### Registration

DM the bot or use the slash command:

```
!register <your_torn_api_key>
/register api_key:<your_torn_api_key>
```

The API key is encrypted with AES-256-GCM before storage.

### Talking to the bot

Mention the bot in a server channel or DM it directly:

```
@Clorn How many nerve do I have?
@Clorn Look up player tebski
@Clorn What's the price of Xanax?
@Clorn Notify me when my nerve hits 15
@Clorn Set up a recurring alert for full energy
```

### Slash Commands

| Command | Description |
|---|---|
| `/torn query:...` | Ask anything |
| `/bars` | Check your bars |
| `/money` | Financial overview |
| `/lookup player:...` | Look up a player |
| `/market item:...` | Check market prices |
| `/register api_key:...` | Register your Torn API key (ephemeral response) |

### Bot Commands

| Command | Description |
|---|---|
| `!register <key>` | Register Torn API key (DM only) |
| `!reset` | Clear conversation history |

## Architecture

```
src/
  index.ts              # Entry point
  config.ts             # Env validation
  discord/
    client.ts           # Discord.js setup
    handler.ts          # Message handler
    commands.ts         # Slash command registration + handling
  agent/
    loop.ts             # Claude tool-use loop
    system-prompt.ts    # System prompt
    tools.ts            # Tool registry
    conversation.ts     # Conversation persistence
  tools/                # Individual tool implementations
  torn/
    client.ts           # Torn API HTTP client with rate limiting + cache
    player-cache.ts     # Player name → ID resolution
  monitor/
    scheduler.ts        # CronJob (30s tick)
    executor.ts         # Bar checking + Discord notifications
  crypto/
    keys.ts             # AES-256-GCM encrypt/decrypt
  db/
    schema.ts           # Drizzle schema (users, monitors, conversations)
    connection.ts       # PostgreSQL connection
```

## How It Works

1. User sends a message → Discord handler picks it up
2. Message + conversation history sent to Claude with available tools
3. Claude decides which Torn API tools to call
4. Tools execute, results go back to Claude
5. Claude formats a response → sent to Discord
6. Conversation saved for 10-minute context window

Monitors run on a 30-second cron tick, checking bars via the Torn API and sending Discord notifications when conditions are met.

## License

[MIT](LICENSE)
