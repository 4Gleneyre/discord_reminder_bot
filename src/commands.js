import { SlashCommandBuilder } from "discord.js";
import { TIMEZONE_CHOICES } from "./timezones.js";

export const commandData = [
  new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Create a reminder in this channel.")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("What should I remind you about?")
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Reminder date as YYYY-MM-DD.")
        .setRequired(true)
        .setMaxLength(10)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Reminder time, like 8:30 PM or 20:30.")
        .setRequired(true)
        .setMaxLength(20)
    )
    .addStringOption((option) =>
      option
        .setName("timezone")
        .setDescription("Timezone for the reminder.")
        .setRequired(true)
        .addChoices(...TIMEZONE_CHOICES)
    )
    .addUserOption((option) =>
      option
        .setName("mention")
        .setDescription("Who should be mentioned when the reminder fires? Defaults to you.")
    ),
  new SlashCommandBuilder()
    .setName("reminders")
    .setDescription("List your active reminders."),
  new SlashCommandBuilder()
    .setName("cancelreminder")
    .setDescription("Cancel one of your active reminders.")
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("Reminder ID from /reminders.")
        .setRequired(true)
        .setMaxLength(12)
    )
].map((command) => command.toJSON());
