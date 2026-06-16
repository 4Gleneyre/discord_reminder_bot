import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ReminderStore } from "../src/reminder-store.js";

describe("ReminderStore", () => {
  it("serializes concurrent saves without losing reminders", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reminder-store-"));
    const filePath = join(dir, "reminders.json");

    try {
      const store = new ReminderStore(filePath);
      await store.load();

      await Promise.all(Array.from({ length: 25 }, (_, index) => {
        return store.add({
          id: `id-${index}`,
          userId: "user-1",
          remindAt: new Date(Date.UTC(2026, 5, 16, 12, index)).toISOString()
        });
      }));

      const saved = JSON.parse(await readFile(filePath, "utf8"));
      assert.equal(saved.reminders.length, 25);
      assert.deepEqual(
        saved.reminders.map((reminder) => reminder.id).sort(),
        Array.from({ length: 25 }, (_, index) => `id-${index}`).sort()
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
