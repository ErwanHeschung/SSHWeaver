import type { ConsoleConnection } from "@/types/console";
import { describeSerial, stopBitsLabel } from "@/types/serial";

function haystack(c: ConsoleConnection): string {
  const { portName, baudRate, dataBits, parity, stopBits, flowControl } = c.settings;
  return [
    c.name,
    portName,
    String(baudRate),
    String(dataBits),
    parity,
    stopBitsLabel(stopBits),
    flowControl,
    describeSerial(c.settings),
    c.status,
    c.isFavorite ? "favorite" : "",
  ]
    .join(" ")
    .toLowerCase();
}

export function filterConsoleConnections(
  connections: ConsoleConnection[],
  query: string,
): ConsoleConnection[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return connections;

  return connections.filter((c) => {
    const text = haystack(c);
    return tokens.every((token) => text.includes(token));
  });
}
