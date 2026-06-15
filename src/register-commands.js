import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandData } from "./commands.js";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  throw new Error("Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID in .env before registering commands.");
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
  { body: commandData }
);

console.log(`Registered ${commandData.length} slash commands for guild ${DISCORD_GUILD_ID}.`);
