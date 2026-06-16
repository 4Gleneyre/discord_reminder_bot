import { InteractionResponseFlags, InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { DateTime } from "luxon";
import { parseReminderDateTime } from "../src/parse-reminder-time.js";
import { timezoneLabel } from "../src/timezones.js";

const DISCORD_API = "https://discord.com/api/v10";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/interactions") {
      return safeHandleInteraction(request, env, ctx);
    }

    if (request.method === "POST" && url.pathname === "/tick") {
      return handleTick(request, env);
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_controller, env) {
    await processDueReminders(env);
  }
};

async function safeHandleInteraction(request, env, ctx) {
  try {
    const response = await handleInteraction(request, env, ctx);
    console.log("Interaction response ready", {
      status: response.status,
      contentType: response.headers.get("Content-Type")
    });
    return response;
  } catch (error) {
    console.error("Interaction failed", error?.stack ?? error);
    return ephemeral("Something went wrong while handling that reminder.");
  }
}

async function handleInteraction(request, env, ctx) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  console.log("Interaction request received", {
    hasSignature: Boolean(signature),
    hasTimestamp: Boolean(timestamp),
    rawBodyLength: rawBody.length
  });

  const valid = await verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!valid) {
    console.warn("Bad Discord request signature");
    return new Response("Bad request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody);
  console.log("Interaction verified", {
    type: interaction.type,
    commandName: interaction.data?.name,
    id: interaction.id
  });

  if (interaction.type === InteractionType.PING) {
    console.log("Responding to Discord ping");
    return json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return ephemeral("I only know slash commands right now.");
  }

  if (interaction.data.name === "remind") {
    return deferReminderCreation(interaction, env, ctx);
  }

  if (interaction.data.name === "reminders") {
    return listReminders(interaction, env);
  }

  if (interaction.data.name === "cancelreminder") {
    return cancelReminder(interaction, env);
  }

  return ephemeral("Unknown command.");
}

function deferReminderCreation(interaction, env, ctx) {
  console.log("Handling remind command");
  const options = optionMap(interaction.data.options ?? []);
  const text = stringOption(options, "text").trim();
  const date = stringOption(options, "date");
  const time = stringOption(options, "time");
  const timezone = stringOption(options, "timezone");
  const mentionUserId = options.get("mention")?.value;

  const parsed = parseReminderDateTime({ date, time, timezone });
  if (!parsed.ok) {
    return ephemeral(parsed.message);
  }

  ctx.waitUntil(createReminder(interaction, env, {
    text,
    timezone,
    mentionUserId,
    parsed
  }));

  return deferredMessage();
}

async function createReminder(interaction, env, reminderInput) {
  const { text, timezone, mentionUserId, parsed } = reminderInput;
  const id = crypto.randomUUID().slice(0, 8);
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const targetUserId = mentionUserId ?? userId;
  const remindAt = parsed.reminderAt.toUTC().toISO();

  try {
    await withRetry(() => env.DB.prepare(
      `INSERT INTO reminders (
        id, guild_id, channel_id, user_id, target_user_id, text, timezone,
        local_date_time, remind_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        interaction.guild_id ?? null,
        interaction.channel_id,
        userId,
        targetUserId,
        text,
        timezone,
        parsed.reminderAt.toFormat("yyyy-MM-dd HH:mm ZZZZ"),
        remindAt,
        new Date().toISOString()
      )
      .run());

    await editOriginalInteractionResponse(
      interaction,
      `Reminder set: ${text}\nMention: <@${targetUserId}>\nTime: ${formatReminderTime({
        remindAt,
        timezone
      })}\nID: \`${id}\``
    );
  } catch (error) {
    console.error("Failed to create reminder after deferring response", error?.stack ?? error);
    await editOriginalInteractionResponse(interaction, "Something went wrong while setting that reminder.");
  }
}

async function listReminders(interaction, env) {
  console.log("Handling reminders command");
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const { results } = await withRetry(() => env.DB.prepare(
    `SELECT id, text, timezone, remind_at AS remindAt
     FROM reminders
     WHERE user_id = ? AND sent_at IS NULL AND cancelled_at IS NULL
     ORDER BY remind_at ASC
     LIMIT 21`
  )
    .bind(userId)
    .all());

  if (results.length === 0) {
    console.log("No active reminders found", { userId });
    return ephemeral("You do not have any active reminders.");
  }

  const lines = results.slice(0, 20).map((reminder) => {
    return `\`${reminder.id}\` - ${formatReminderTime(reminder)} - ${reminder.text}`;
  });
  const suffix = results.length > 20 ? `\n\nShowing 20 of at least ${results.length} active reminders.` : "";
  console.log("Active reminders listed", { userId, count: results.length });
  return ephemeral(`${lines.join("\n")}${suffix}`);
}

async function cancelReminder(interaction, env) {
  console.log("Handling cancelreminder command");
  const options = optionMap(interaction.data.options ?? []);
  const id = stringOption(options, "id").trim();
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const cancelledAt = new Date().toISOString();

  const result = await withRetry(() => env.DB.prepare(
    `UPDATE reminders
     SET cancelled_at = ?
     WHERE id = ? AND user_id = ? AND sent_at IS NULL AND cancelled_at IS NULL`
  )
    .bind(cancelledAt, id, userId)
    .run());

  if (!result.meta.changes) {
    return ephemeral("I could not find an active reminder with that ID for you.");
  }

  return message(`Cancelled reminder \`${id}\`.`);
}

async function handleTick(request, env) {
  if (!authorizedTick(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const result = await processDueReminders(env);
  return json(result);
}

async function processDueReminders(env) {
  const now = new Date().toISOString();
  const { results } = await withRetry(() => env.DB.prepare(
    `SELECT id, channel_id AS channelId, user_id AS userId, target_user_id AS targetUserId, text
     FROM reminders
     WHERE sent_at IS NULL AND cancelled_at IS NULL AND remind_at <= ?
     ORDER BY remind_at ASC
     LIMIT 50`
  )
    .bind(now)
    .all());

  const outcomes = [];
  for (const reminder of results) {
    outcomes.push(await sendReminder(reminder, env));
  }

  return {
    ok: true,
    checkedAt: now,
    due: results.length,
    sent: outcomes.filter((outcome) => outcome.ok).length,
    failed: outcomes.filter((outcome) => !outcome.ok).length
  };
}

async function sendReminder(reminder, env) {
  const content = `<@${reminder.targetUserId ?? reminder.userId}> reminder: ${reminder.text}`;
  const response = await fetch(`${DISCORD_API}/channels/${reminder.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to send reminder ${reminder.id}: ${response.status} ${errorText}`);
    return { ok: false, id: reminder.id, status: response.status };
  }

  await withRetry(() => env.DB.prepare("UPDATE reminders SET sent_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), reminder.id)
    .run());
  return { ok: true, id: reminder.id };
}

async function withRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn("D1 operation failed", {
        attempt,
        attempts,
        message: error?.message ?? String(error)
      });
      if (attempt < attempts) {
        await sleep(75 * attempt);
      }
    }
  }
  throw lastError;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function authorizedTick(request, env) {
  const url = new URL(request.url);
  const header = request.headers.get("X-Tick-Secret");
  const query = url.searchParams.get("secret");
  return Boolean(env.TICK_SECRET) && (header === env.TICK_SECRET || query === env.TICK_SECRET);
}

function optionMap(options) {
  return new Map(options.map((option) => [option.name, option]));
}

function stringOption(options, name) {
  const option = options.get(name);
  return typeof option?.value === "string" ? option.value : "";
}

function formatReminderTime(reminder) {
  const when = DateTime.fromISO(reminder.remindAt, { zone: "utc" }).setZone(reminder.timezone);
  return `${when.toFormat("ccc, LLL d, yyyy 'at' h:mm a")} ${timezoneLabel(reminder.timezone)}`;
}

function message(content) {
  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content }
  });
}

function deferredMessage() {
  return json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  });
}

function ephemeral(content) {
  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  });
}

async function editOriginalInteractionResponse(interaction, content) {
  const response = await fetch(
    `${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to edit interaction response: ${response.status} ${errorText}`);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
