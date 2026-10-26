import { Duplex } from "node:stream";
import { describe, expect, it } from "vitest";
import { acceptSocket } from "../../src/websocket.js";

/**
 * A PEER'S WORK IS LINEAR IN WHAT IT SENDS. The live wire's server half
 * caps a message's bytes; it also caps how many fragments one message may
 * come in, refuses a continuation with no message begun, and joins a frame
 * trickled in small chunks once, when it has all arrived — so one seat
 * cannot stall the event loop every other seat is served on.
 */

const MASK = Buffer.from([1, 2, 3, 4]);

/** A masked client frame. */
function frame(opcode: number, payload: Buffer, fin: boolean): Buffer {
  const length = payload.length;
  const header = length < 126 ? Buffer.alloc(2) : length < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = (fin ? 0x80 : 0) | opcode;
  if (length < 126) header[1] = 0x80 | length;
  else if (length < 65536) {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] = masked[i]! ^ MASK[i % 4]!;
  return Buffer.concat([header, MASK, masked]);
}

/** A socket over an in-memory stream: what it wrote, what it heard, and whether it closed. */
function socket() {
  const written: Buffer[] = [];
  const messages: string[] = [];
  let closed = false;
  const stream = new Duplex({
    read() {},
    write(chunk: Buffer, _encoding, done) {
      written.push(Buffer.from(chunk));
      done();
    },
  });
  acceptSocket(stream, "dGhlIHNhbXBsZSBub25jZQ==", Buffer.alloc(0), { message: (text) => messages.push(text), close: () => void (closed = true) });
  const closeCode = () => {
    const close = written.find((chunk) => chunk[0] === 0x88);
    return close ? close.readUInt16BE(2) : undefined;
  };
  return { stream, messages, closeCode, closed: () => closed };
}

describe("a live socket pays for a message once", () => {
  it("closes a message that comes in more fragments than any message needs, without delivering it", () => {
    const { stream, messages, closeCode, closed } = socket();
    const empty = frame(0x0, Buffer.alloc(0), false);
    const many = Buffer.concat([frame(0x1, Buffer.from("x"), false), ...Array.from({ length: 32_000 }, () => empty)]);
    const started = performance.now();
    stream.emit("data", many);
    const took = performance.now() - started;
    expect(closed()).toBe(true);
    expect(closeCode()).toBe(1008);
    expect(messages).toEqual([]);
    // Was ~870 ms when every fragment summed every one before it.
    expect(took).toBeLessThan(250);
  });

  it("refuses a continuation when no message has begun", () => {
    const { stream, messages, closeCode } = socket();
    stream.emit("data", frame(0x0, Buffer.from("orphan"), true));
    expect(closeCode()).toBe(1002);
    expect(messages).toEqual([]);
  });

  it("still hears a message sent in a few fragments", () => {
    const { stream, messages, closeCode } = socket();
    stream.emit("data", Buffer.concat([frame(0x1, Buffer.from("he"), false), frame(0x0, Buffer.from("ll"), false), frame(0x0, Buffer.from("o"), true)]));
    expect(messages).toEqual(["hello"]);
    expect(closeCode()).toBeUndefined();
  });

  it("joins a large frame trickled in small chunks once, when it has all arrived", () => {
    const { stream, messages } = socket();
    const text = "y".repeat(4 * 1024 * 1024);
    const whole = frame(0x1, Buffer.from(text), true);
    const started = performance.now();
    for (let at = 0; at < whole.length; at += 1024) stream.emit("data", whole.subarray(at, at + 1024));
    const took = performance.now() - started;
    expect(messages).toHaveLength(1);
    expect(messages[0]!.length).toBe(text.length);
    // Was ~730 ms when every chunk copied everything before it.
    expect(took).toBeLessThan(300);
  });

  it("hears two frames that arrive in one chunk, and one split across a header", () => {
    const { stream, messages } = socket();
    const two = Buffer.concat([frame(0x1, Buffer.from("one"), true), frame(0x1, Buffer.from("two".repeat(100)), true)]);
    stream.emit("data", two.subarray(0, 1));
    stream.emit("data", two.subarray(1, 10));
    stream.emit("data", two.subarray(10, 12));
    stream.emit("data", two.subarray(12));
    expect(messages).toEqual(["one", "two".repeat(100)]);
  });
});
