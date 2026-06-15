import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { parseReminderDateTime } from "../src/parse-reminder-time.js";

describe("parseReminderDateTime", () => {
  it("parses 24-hour Central time", () => {
    const result = parseReminderDateTime({
      date: "2026-06-14",
      time: "20:30",
      timezone: "America/Chicago",
      now: DateTime.fromISO("2026-06-14T12:00:00", { zone: "America/Chicago" })
    });

    assert.equal(result.ok, true);
    assert.equal(result.reminderAt.toUTC().toISO(), "2026-06-15T01:30:00.000Z");
  });

  it("parses AM/PM Eastern time", () => {
    const result = parseReminderDateTime({
      date: "2026-12-14",
      time: "8:30 PM",
      timezone: "America/New_York",
      now: DateTime.fromISO("2026-12-14T12:00:00", { zone: "America/New_York" })
    });

    assert.equal(result.ok, true);
    assert.equal(result.reminderAt.hour, 20);
    assert.equal(result.reminderAt.zoneName, "America/New_York");
  });

  it("rejects past reminders", () => {
    const result = parseReminderDateTime({
      date: "2026-06-14",
      time: "8:30 AM",
      timezone: "America/Chicago",
      now: DateTime.fromISO("2026-06-14T12:00:00", { zone: "America/Chicago" })
    });

    assert.equal(result.ok, false);
    assert.match(result.message, /past/);
  });
});
