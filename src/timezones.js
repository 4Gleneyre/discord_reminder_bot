export const TIMEZONE_CHOICES = [
  { name: "Eastern US", value: "America/New_York" },
  { name: "Central US", value: "America/Chicago" },
  { name: "Pacific US", value: "America/Los_Angeles" },
  { name: "Mountain US", value: "America/Denver" },
  { name: "Alaska US", value: "America/Anchorage" },
  { name: "Hawaii US", value: "Pacific/Honolulu" },
  { name: "UTC", value: "UTC" },
  { name: "London", value: "Europe/London" },
  { name: "Central Europe", value: "Europe/Berlin" },
  { name: "India", value: "Asia/Kolkata" },
  { name: "Japan", value: "Asia/Tokyo" },
  { name: "Australia Eastern", value: "Australia/Sydney" }
];

export function timezoneLabel(zone) {
  return TIMEZONE_CHOICES.find((choice) => choice.value === zone)?.name ?? zone;
}
