import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";

/**
 * THE SERVER HALF OF A WEBSOCKET, AS MUCH OF IT AS THE LIVE WIRE NEEDS (FR-05).
 *
 * `graview serve` answers `/graview/live` through Node's `upgrade` event.
 * The `ws` package would do it, and would be this package's first
 * dependency beyond `@graview/core` for something a Worker or Durable
 * Object host never runs (it has `WebSocketPair`), and that every client
 * of it — a page, Node 22's own `WebSocket` — already speaks. The server
 * half of RFC 6455 for text messages is small: the handshake, unmasking
 * client frames, fragments, ping and close. Binary messages are refused
 * with 1003; the wire is JSON.
 */

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** No message on the live wire comes close; a frame claiming more is a client to close. */
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

export interface ServerSocket {
  send(text: string): void;
  close(code?: number, reason?: string): void;
}

export interface SocketEvents {
  message(text: string): void;
  close(): void;
}

/** The `Sec-WebSocket-Accept` for a client's key. */
export function acceptKey(key: string): string {
  return createHash("sha1").update(key + GUID).digest("base64");
}

/** Answers the upgrade with 101 and speaks frames on the socket from then on. */
export function acceptSocket(stream: Duplex, key: string, head: Buffer, events: SocketEvents): ServerSocket {
  stream.write(
    ["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${acceptKey(key)}`, "", ""].join("\r\n"),
  );
  (stream as { setNoDelay?: (noDelay: boolean) => void }).setNoDelay?.(true);
  let open = true;
  let buffered: Buffer = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
  let parts: Buffer[] = [];
  let partsOpcode = 0;

  const frame = (opcode: number, payload: Buffer): Buffer => {
    const length = payload.length;
    const header = length < 126 ? Buffer.alloc(2) : length < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    if (length < 126) header[1] = length;
    else if (length < 65536) {
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    return Buffer.concat([header, payload]);
  };

  const finish = () => {
    if (!open) return;
    open = false;
    events.close();
  };

  const close = (code = 1000, reason = "") => {
    if (!open) return;
    const body = Buffer.alloc(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    try {
      stream.write(frame(0x8, body));
      stream.end();
    } catch {
      // Already gone.
    }
    finish();
  };

  const read = () => {
    while (buffered.length >= 2) {
      const first = buffered[0]!;
      const second = buffered[1]!;
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let at = 2;
      if (length === 126) {
        if (buffered.length < 4) return;
        length = buffered.readUInt16BE(2);
        at = 4;
      } else if (length === 127) {
        if (buffered.length < 10) return;
        const big = buffered.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE_BYTES)) return close(1009, "Too big.");
        length = Number(big);
        at = 10;
      }
      // A client's frames are masked, always (RFC 6455 §5.1).
      if (!masked) return close(1002, "A client's frames are masked.");
      if (buffered.length < at + 4 + length) return;
      const mask = buffered.subarray(at, at + 4);
      const payload = Buffer.from(buffered.subarray(at + 4, at + 4 + length));
      for (let i = 0; i < payload.length; i++) payload[i] = payload[i]! ^ mask[i % 4]!;
      buffered = buffered.subarray(at + 4 + length);

      if (opcode === 0x8) {
        try {
          stream.write(frame(0x8, payload.subarray(0, 2)));
          stream.end();
        } catch {
          // Already gone.
        }
        return finish();
      }
      if (opcode === 0x9) {
        stream.write(frame(0xa, payload));
        continue;
      }
      if (opcode === 0xa) continue;
      if (opcode === 0x1 || opcode === 0x2) {
        parts = [payload];
        partsOpcode = opcode;
      } else if (opcode === 0x0) {
        parts.push(payload);
      } else {
        return close(1002, "An opcode this server does not speak.");
      }
      if (parts.reduce((sum, part) => sum + part.length, 0) > MAX_MESSAGE_BYTES) return close(1009, "Too big.");
      if (!fin) continue;
      const message = Buffer.concat(parts);
      parts = [];
      if (partsOpcode !== 0x1) return close(1003, "The live wire is text.");
      events.message(message.toString("utf8"));
    }
  };

  stream.on("data", (chunk: Buffer) => {
    buffered = buffered.length === 0 ? chunk : Buffer.concat([buffered, chunk]);
    read();
  });
  stream.on("end", finish);
  stream.on("close", finish);
  stream.on("error", finish);
  if (buffered.length > 0) queueMicrotask(read);

  return {
    send(text) {
      if (!open) return;
      stream.write(frame(0x1, Buffer.from(text, "utf8")));
    },
    close,
  };
}
