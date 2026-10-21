import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

function capture(): { stream: Writable; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const lines = (): Record<string, unknown>[] =>
    chunks
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, lines };
}

describe("createLogger", () => {
  it("writes JSON lines with the service name", () => {
    const { stream, lines } = capture();
    const logger = createLogger({ level: "info", service: "test", destination: stream });

    logger.child({ runId: "r1" }).info("started");

    expect(lines()[0]).toMatchObject({ service: "test", runId: "r1", msg: "started" });
  });

  it("redacts secrets at the top level and one level deep", () => {
    const { stream, lines } = capture();
    const logger = createLogger({ level: "info", service: "test", destination: stream });

    logger.info(
      { password: "p", site: { apiKey: "k" }, headers: { authorization: "Bearer t" } },
      "connect",
    );

    const [line] = lines();
    expect(JSON.stringify(line)).not.toMatch(/"p"|"k"|Bearer/);
    expect(line).toMatchObject({
      password: "[redacted]",
      site: { apiKey: "[redacted]" },
      headers: { authorization: "[redacted]" },
    });
  });
});
