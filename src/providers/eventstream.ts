// Parser for the AWS binary event-stream framing used by Kiro's
// generateAssistantResponse endpoint (vnd.amazon.eventstream).
//
// Frame layout (all integers big-endian):
//   [0:4]   total length (including CRCs)
//   [4:8]   headers length
//   [8:12]  prelude CRC (not validated — upstream is trusted)
//   [12:12+headerLen]  headers
//   [12+headerLen : total-4]  payload
//   [total-4:total]  message CRC (not validated)

export interface AwsEvent {
  headers: Record<string, string | number | boolean>;
  payload: Buffer;
}

const MAX_FRAME = 8 * 1024 * 1024;

export class AwsEventStreamParser {
  private buf: Buffer = Buffer.alloc(0);

  /** Feed a chunk; returns all complete frames it completed. Throws on framing errors. */
  push(chunk: Buffer): AwsEvent[] {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);
    const events: AwsEvent[] = [];
    while (true) {
      if (this.buf.length < 12) break;
      const totalLen = this.buf.readUInt32BE(0);
      if (totalLen < 16 || totalLen > MAX_FRAME) {
        throw new Error(`Invalid event-stream frame length: ${totalLen}`);
      }
      if (this.buf.length < totalLen) break;
      const headerLen = this.buf.readUInt32BE(4);
      if (headerLen > totalLen - 16) {
        throw new Error(`Invalid event-stream header length: ${headerLen}`);
      }
      const headerStart = 12;
      const payloadStart = headerStart + headerLen;
      events.push({
        headers: parseHeaders(this.buf.subarray(headerStart, payloadStart)),
        payload: Buffer.from(this.buf.subarray(payloadStart, totalLen - 4)),
      });
      this.buf = this.buf.subarray(totalLen);
    }
    return events;
  }
}

function parseHeaders(buf: Buffer): Record<string, string | number | boolean> {
  const headers: Record<string, string | number | boolean> = {};
  let pos = 0;
  while (pos < buf.length) {
    const nameLen = buf.readUInt8(pos);
    pos += 1;
    if (pos + nameLen + 1 > buf.length) break; // malformed trailing bytes
    const name = buf.subarray(pos, pos + nameLen).toString('utf8');
    pos += nameLen;
    const valueType = buf.readUInt8(pos);
    pos += 1;
    switch (valueType) {
      case 0:
        headers[name] = true;
        pos += 1;
        break;
      case 1:
        headers[name] = false;
        pos += 1;
        break;
      case 2:
        headers[name] = pos + 1 <= buf.length ? buf.readUInt8(pos) : 0;
        pos += 1;
        break;
      case 3:
        headers[name] = buf.readInt16BE(pos);
        pos += 2;
        break;
      case 4:
        headers[name] = buf.readInt32BE(pos);
        pos += 4;
        break;
      case 5:
        headers[name] = Number(buf.readBigInt64BE(pos));
        pos += 8;
        break;
      case 6: {
        const len = buf.readUInt16BE(pos);
        pos += 2;
        headers[name] = buf.subarray(pos, pos + len).toString('base64');
        pos += len;
        break;
      }
      case 7: {
        const len = buf.readUInt16BE(pos);
        pos += 2;
        headers[name] = buf.subarray(pos, pos + len).toString('utf8');
        pos += len;
        break;
      }
      case 8:
        headers[name] = Number(buf.readBigInt64BE(pos));
        pos += 8;
        break;
      case 9:
        headers[name] = buf.subarray(pos, pos + 16).toString('hex');
        pos += 16;
        break;
      default:
        return headers; // unknown value type — stop parsing headers
    }
  }
  return headers;
}

/** Build a frame (used by tests). */
export function buildFrame(payload: Buffer, headers: Record<string, string> = {}): Buffer {
  const headerBuf = Buffer.alloc(256);
  let pos = 0;
  for (const [name, value] of Object.entries(headers)) {
    headerBuf.writeUInt8(name.length, pos);
    pos += 1;
    headerBuf.write(name, pos, 'utf8');
    pos += Buffer.byteLength(name, 'utf8');
    headerBuf.writeUInt8(7, pos); // string value
    pos += 1;
    const valueBytes = Buffer.from(value, 'utf8');
    headerBuf.writeUInt16BE(valueBytes.length, pos);
    pos += 2;
    valueBytes.copy(headerBuf, pos);
    pos += valueBytes.length;
  }
  const headerLen = pos;
  const totalLen = 12 + headerLen + payload.length + 4;
  const frame = Buffer.alloc(totalLen);
  frame.writeUInt32BE(totalLen, 0);
  frame.writeUInt32BE(headerLen, 4);
  frame.writeUInt32BE(0, 8); // prelude CRC placeholder
  headerBuf.subarray(0, headerLen).copy(frame, 12);
  payload.copy(frame, 12 + headerLen);
  frame.writeUInt32BE(0, totalLen - 4); // message CRC placeholder
  return frame;
}
