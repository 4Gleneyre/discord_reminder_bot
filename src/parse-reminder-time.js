import { DateTime } from "luxon";

const DATE_FORMAT = "yyyy-MM-dd";
const TIME_FORMATS = ["H:mm", "HH:mm", "h:mm a", "hh:mm a"];

export function parseReminderDateTime({ date, time, timezone, now = DateTime.now() }) {
  const datePart = DateTime.fromFormat(date.trim(), DATE_FORMAT, { zone: timezone });

  if (!datePart.isValid) {
    return {
      ok: false,
      message: "Use the date format YYYY-MM-DD, for example 2026-06-14."
    };
  }

  const normalizedTime = time.trim().toUpperCase().replace(/\s+/g, " ");
  const timePart = TIME_FORMATS
    .map((format) => DateTime.fromFormat(normalizedTime, format, { zone: timezone }))
    .find((candidate) => candidate.isValid);

  if (!timePart) {
    return {
      ok: false,
      message: "Use a time like 08:30, 20:30, or 8:30 PM."
    };
  }

  const reminderAt = datePart.set({
    hour: timePart.hour,
    minute: timePart.minute,
    second: 0,
    millisecond: 0
  });

  if (!reminderAt.isValid) {
    return {
      ok: false,
      message: `That date/time is not valid in ${timezone}.`
    };
  }

  if (reminderAt <= now.setZone(timezone)) {
    return {
      ok: false,
      message: "That reminder time is in the past. Pick a future date and time."
    };
  }

  return {
    ok: true,
    reminderAt
  };
}
