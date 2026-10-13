import { Transform } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { redactAuthUrls } from "../src/lib/server/log-redaction.mjs";

/** Buffer complete lines so a credential split across writes cannot escape. */
export function createLogRedactor() {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let discarding = false;
  const limit = 64 * 1024;
  function consume(stream, text, final = false) {
    pending += text;
    let newline;
    while ((newline = pending.indexOf("\n")) !== -1) {
      const line = pending.slice(0, newline + 1);
      pending = pending.slice(newline + 1);
      if (!discarding) stream.push(line.length > limit
        ? "[oversized log line omitted]\n" : redactAuthUrls(line));
      discarding = false;
    }
    if (pending.length > limit) {
      if (!discarding) stream.push("[oversized log line omitted]\n");
      discarding = true;
      pending = "";
    }
    if (final && pending && !discarding) stream.push(redactAuthUrls(pending));
  }
  return new Transform({
    transform(chunk, encoding, callback) {
      consume(this, decoder.write(chunk));
      callback();
    },
    flush(callback) {
      consume(this, decoder.end(), true);
      callback();
    },
  });
}
