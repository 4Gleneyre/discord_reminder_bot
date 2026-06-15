import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class ReminderStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.reminders = [];
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.reminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      this.reminders = [];
      await this.save();
    }
  }

  async save() {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(
      tempPath,
      `${JSON.stringify({ reminders: this.reminders }, null, 2)}\n`,
      "utf8"
    );
    await rename(tempPath, this.filePath);
  }

  active() {
    return this.reminders.filter((reminder) => !reminder.sentAt && !reminder.cancelledAt);
  }

  activeForUser(userId) {
    return this.active()
      .filter((reminder) => reminder.userId === userId)
      .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
  }

  async add(reminder) {
    this.reminders.push(reminder);
    await this.save();
  }

  async cancel(id, userId) {
    const reminder = this.reminders.find(
      (candidate) => candidate.id === id && candidate.userId === userId && !candidate.sentAt && !candidate.cancelledAt
    );

    if (!reminder) {
      return null;
    }

    reminder.cancelledAt = new Date().toISOString();
    await this.save();
    return reminder;
  }

  due(now = new Date()) {
    return this.active().filter((reminder) => new Date(reminder.remindAt) <= now);
  }

  async markSent(id) {
    const reminder = this.reminders.find((candidate) => candidate.id === id);
    if (!reminder) {
      return;
    }

    reminder.sentAt = new Date().toISOString();
    await this.save();
  }
}
