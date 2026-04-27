export const LOCKED_PUBLISH_SECTIONS = [
  "memory",
  "understand_trabzon",
  "waiting_to_read",
];

export function isPublishSectionLocked(section: string) {
  return LOCKED_PUBLISH_SECTIONS.includes(section);
}
