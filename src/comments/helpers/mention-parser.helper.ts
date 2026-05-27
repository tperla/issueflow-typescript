export function extractMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/gi) ?? [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}
