import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { DateTime } from "luxon";
import { parseReminderDateTime } from "./parse-reminder-time.js";
import { ReminderStore } from "./reminder-store.js";
import { timezoneLabel } from "./timezones.js";

const { DISCORD_TOKEN, REMINDERS_FILE = "data/reminders.json" } = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("Set DISCORD_TOKEN in .env before starting the bot.");
}

const store = new ReminderStore(REMINDERS_FILE);
await store.load();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}.`);
  void sendDueReminders();
  setInterval(() => {
    void sendDueReminders();
  }, 15_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    if (interaction.commandName === "remind") {
      await handleRemind(interaction);
      return;
    }

    if (interaction.commandName === "reminders") {
      await handleReminders(interaction);
      return;
    }

    if (interaction.commandName === "cancelreminder") {
      await handleCancelReminder(interaction);
    }
  } catch (error) {
    console.error(error);
    const message = "Something went wrong while handling that reminder.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
});

async function handleRemind(interaction) {
  const text = interaction.options.getString("text", true).trim();
  const date = interaction.options.getString("date", true);
  const time = interaction.options.getString("time", true);
  const timezone = interaction.options.getString("timezone", true);
  const mentionUser = interaction.options.getUser("mention");

  const parsed = parseReminderDateTime({ date, time, timezone });
  if (!parsed.ok) {
    await interaction.reply({ content: parsed.message, flags: MessageFlags.Ephemeral });
    return;
  }

  const reminder = {
    id: randomUUID().slice(0, 8),
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    targetUserId: mentionUser?.id ?? interaction.user.id,
    text,
    timezone,
    localDateTime: parsed.reminderAt.toFormat("yyyy-MM-dd HH:mm ZZZZ"),
    remindAt: parsed.reminderAt.toUTC().toISO(),
    createdAt: new Date().toISOString()
  };

  await store.add(reminder);

  await interaction.reply({
    content: `Reminder set: ${reminder.text}\nMention: <@${reminder.targetUserId}>\nTime: ${formatReminderTime(reminder)}\nID: \`${reminder.id}\``
  });
}

async function handleReminders(interaction) {
  const reminders = store.activeForUser(interaction.user.id);

  if (reminders.length === 0) {
    await interaction.reply({ content: "You do not have any active reminders.", flags: MessageFlags.Ephemeral });
    return;
  }

  const lines = reminders.slice(0, 20).map((reminder) => {
    return `\`${reminder.id}\` - ${formatReminderTime(reminder)} - ${reminder.text}`;
  });

  const suffix = reminders.length > 20 ? `\n\nShowing 20 of ${reminders.length} active reminders.` : "";
  await interaction.reply({ content: `${lines.join("\n")}${suffix}`, flags: MessageFlags.Ephemeral });
}

async function handleCancelReminder(interaction) {
  const id = interaction.options.getString("id", true).trim();
  const reminder = await store.cancel(id, interaction.user.id);

  if (!reminder) {
    await interaction.reply({
      content: "I could not find an active reminder with that ID for you.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({
    content: `Cancelled reminder \`${reminder.id}\`: ${reminder.text}`
  });
}

async function sendDueReminders() {
  const dueReminders = store.due();

  for (const reminder of dueReminders) {
    try {
      const channel = await client.channels.fetch(reminder.channelId);
      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${reminder.channelId} is not text-based or could not be found.`);
      }

      await channel.send({
        content: `<@${reminder.targetUserId ?? reminder.userId}> reminder: ${reminder.text}`
      });
      await store.markSent(reminder.id);
    } catch (error) {
      console.error(`Failed to send reminder ${reminder.id}:`, error);
    }
  }
}

function formatReminderTime(reminder) {
  const when = DateTime.fromISO(reminder.remindAt, { zone: "utc" }).setZone(reminder.timezone);
  return `${when.toFormat("ccc, LLL d, yyyy 'at' h:mm a")} ${timezoneLabel(reminder.timezone)}`;
}

await client.login(DISCORD_TOKEN);
