import * as fs from "fs";

export class EchoSuppressor {
  private queue: { wrapped: string; clean: string }[] = [];

  public add(wrapped: string, clean: string) {
    this.queue.push({ wrapped, clean });
  }

  public process(data: string): string {
    let result = data;

    while (this.queue.length > 0) {
      const current = this.queue[0];
      const match = this.findMatchWithAnsi(result, current.wrapped);

      if (match) {
        console.log(`[ZenTerminal] EchoSuppressor: MATCH FOUND!`);
        this.queue.shift();
        result =
          result.substring(0, match.start) +
          current.clean +
          result.substring(match.end);
        continue;
      }

      if (this.queue.length > 1) {
        const next = this.queue[1];
        const nextMatch = this.findMatchWithAnsi(result, next.wrapped);
        if (nextMatch) {
          console.log(
            `[ZenTerminal] EchoSuppressor: MATCH FOUND FOR NEXT ITEM!`,
          );
          this.queue.splice(0, 2);
          result =
            result.substring(0, nextMatch.start) +
            next.clean +
            result.substring(nextMatch.end);
          continue;
        }
      }

      break;
    }

    return result;
  }

  private findMatchWithAnsi(
    data: string,
    wrapped: string,
  ): { start: number; end: number } | null {
    let dataPos = 0;
    while (dataPos < data.length) {
      let dIdx = dataPos;
      let wIdx = 0;

      while (dIdx < data.length && wIdx < wrapped.length) {
        let d = data[dIdx];

        if (d === "\x1b") {
          if (dIdx + 1 < data.length) {
            if (data[dIdx + 1] === "[") {
              let j = dIdx + 2;
              while (
                j < data.length &&
                (data.charCodeAt(j) < 0x40 || data.charCodeAt(j) > 0x7e)
              ) {
                j++;
              }
              if (j < data.length) {
                dIdx = j + 1;
                continue;
              }
            } else if (data[dIdx + 1] === "]") {
              let j = dIdx + 2;
              while (j < data.length) {
                if (data[j] === "\u0007") {
                  j++;
                  break;
                }
                if (
                  data[j] === "\x1b" &&
                  j + 1 < data.length &&
                  data[j + 1] === "\\"
                ) {
                  j += 2;
                  break;
                }
                j++;
              }
              dIdx = j;
              continue;
            }
          }
        }

        if (d === "\r") {
          dIdx++;
          continue;
        }

        const w = wrapped[wIdx];
        if (w === "\r") {
          wIdx++;
          continue;
        }

        if (d === w) {
          dIdx++;
          wIdx++;
        } else {
          break;
        }
      }

      if (wIdx === wrapped.length) {
        return { start: dataPos, end: dIdx };
      }
      dataPos++;
    }
    return null;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export function stripAnsi(str: string): string {
  if (!str) return "";
  return str
    .replace(/\x1b\[[0-9;?]*[A-Za-z~]/g, "")
    .replace(/\x1b\].*?(\x07|\x1b\\)/g, "");
}

export function stripMarkers(
  chunk: string,
  activeActionId: string | null,
): string {
  if (!activeActionId || !chunk) return chunk;

  const startMarker = `ZEN_CMD_START: ${activeActionId}`;
  const endMarker = `ZEN_CMD_END: ${activeActionId}`;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const ansi = "\\x1b\\[[0-9;?]*[A-Za-z~]|\\x1b\\].*?(?:\\x07|\\x1b\\\\)";
  // messy patterns that can surround a marker:
  // includes \r ONLY if NOT followed by \n (to protect \r\n delimiters)
  const messy = `(?:${ansi}|\\r(?!\\n)|[\\x00-\\x09\\x0B-\\x0C\\x0E-\\x1F\\x7F]| )*`;
  const markerBody = (m: string) => `${messy}${esc(m)}${messy}`;

  const delim = "(\\r\\n|\\n|\\r|;|\\&)";

  // Start Pattern: consume marker and TRAILING delimiter
  const startRegex = new RegExp(
    `(?:(?:echo\\s+["']?${markerBody(startMarker)}["']?\\s*(?:;|\\&|\\r\\n|\\n|\\r)\\s*)|${markerBody(startMarker)}${delim}|${markerBody(startMarker)}$)`,
    "g",
  );

  // End Pattern: consume LEADING delimiter and marker
  const endRegex = new RegExp(
    `(?:${delim}${markerBody(endMarker)}|^${markerBody(endMarker)}|${delim}?\\s*echo\\s+["']?${markerBody(endMarker)}["']?|(?:;|\\&|^)\\s*echo\\s+["']?${markerBody(endMarker)}["']?)`,
    "g",
  );

  let result = chunk.replace(startRegex, "").replace(endRegex, "");

  return result;
}
