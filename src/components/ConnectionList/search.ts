import type { Connection } from "@/types/connection";

function haystack(c: Connection): string {
  return [
    c.name,
    c.username,
    c.host,
    String(c.port),
    `${c.username}@${c.host}:${c.port}`,
    c.status,
    c.isFavorite ? "favorite" : "",
  ]
    .join(" ")
    .toLowerCase();
}

export function filterConnections(
  connections: Connection[],
  query: string,
): Connection[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return connections;

  return connections.filter((c) => {
    const text = haystack(c);
    return tokens.every((token) => text.includes(token));
  });
}
