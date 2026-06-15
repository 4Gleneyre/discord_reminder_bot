# Discord Reminder Bot

A small Discord reminder app for personal servers. It lets you create timezone-aware reminders with slash commands and sends each reminder back to the same channel where it was created.

The production deployment runs on Cloudflare Workers with D1 storage and a one-minute scheduled trigger. The older gateway bot in `src/index.js` is still available for local development, but production does not need an always-on VM.

## Features

- `/remind` creates a reminder from text, date, time, timezone, and optionally who to mention.
- Eastern US and Central US are pinned first in the timezone choices.
- `/reminders` lists your active reminders.
- `/cancelreminder` cancels one of your active reminders by ID.
- Production reminders are saved in Cloudflare D1.
- A scheduled Worker tick checks for due reminders every minute.
- The legacy local bot saves reminders to `data/reminders.json`.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env`:

   ```bash
   cp .env.example .env
   ```

3. Fill in:

   - `DISCORD_TOKEN`: your bot token from the Discord Developer Portal.
   - `DISCORD_CLIENT_ID`: the application/client ID.
   - `DISCORD_GUILD_ID`: your personal server ID.

4. Invite the bot to your server with these scopes and permissions:

   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `View Channels`, `Read Message History`

5. Register slash commands for your server:

   ```bash
   npm run register
   ```

6. Start the legacy local gateway bot, if needed:

   ```bash
   npm start
   ```

## Cloudflare Worker Deployment

Production uses:

- Worker URL: `https://discord-reminder-bot.jayfu03.workers.dev`
- Discord interactions endpoint: `/interactions`
- Manual tick endpoint: `/tick?secret=...`
- D1 database: `discord-reminder-bot-db`
- Cloudflare scheduled trigger: every minute

Deploy code:

```bash
npm run deploy:worker
```

Apply D1 migrations:

```bash
npm run d1:migrate
```

Required Worker secrets:

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put TICK_SECRET
```

The scheduled trigger is configured in `wrangler.jsonc`, so cron-job.org is not required for the current production setup.

## Usage

Create a reminder:

```text
/remind text:"Take out trash" date:"2026-06-14" time:"8:30 PM" timezone:"Central US" mention:"@Jay"
```

If you leave `mention` blank, the reminder mentions whoever created it.

List your active reminders:

```text
/reminders
```

Cancel a reminder:

```text
/cancelreminder id:"abc12345"
```

Dates should be `YYYY-MM-DD`. Times can be `HH:mm`, `h:mm AM`, or `h:mm PM`.
