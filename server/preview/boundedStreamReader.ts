import type { Readable } from 'node:stream';

export type BoundedStream = Readable & AsyncIterable<string | Uint8Array>;

export async function readBoundedBytes(
  stream: BoundedStream,
  maximumBytes: number,
  tooLarge: () => Error,
  onLimit: () => void = () => {
    stream.destroy();
  },
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const value = toBytes(chunk);
    size += value.byteLength;
    if (size > maximumBytes) {
      onLimit();
      throw tooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedText(
  stream: BoundedStream,
  options: {
    maximumBytes: number;
    encoding?: string;
    truncateAtLimit?: boolean;
    stopAfterHead?: boolean;
    tooLarge: () => Error;
    onLimit?: () => void;
  },
): Promise<string> {
  const decoder = createTextDecoder(options.encoding);
  let size = 0;
  let result = '';

  for await (const chunk of stream) {
    const value = toBytes(chunk);
    const remainingBytes = options.maximumBytes - size;
    if (value.byteLength > remainingBytes) {
      if (!options.truncateAtLimit) {
        options.onLimit?.();
        throw options.tooLarge();
      }
      result += decoder.decode(value.subarray(0, Math.max(0, remainingBytes)), { stream: true });
      options.onLimit?.();
      // Do not flush the decoder here: a truncated UTF-8 sequence must not turn
      // into a replacement character at the bounded stream boundary.
      return result;
    }
    size += value.byteLength;
    result += decoder.decode(value, { stream: true });

    if (options.stopAfterHead) {
      const headEnd = result.search(/<\/head\s*>/i);
      if (headEnd !== -1) {
        const endTagEnd = result.indexOf('>', headEnd) + 1;
        options.onLimit?.();
        return result.slice(0, endTagEnd);
      }
    }
  }
  return result + decoder.decode();
}

function createTextDecoder(encoding: string | undefined): TextDecoder {
  if (!encoding) return new TextDecoder();

  try {
    return new TextDecoder(encoding);
  } catch {
    // A malformed charset declaration must not make an otherwise readable
    // page fail. UTF-8 is the safe default for the web here.
    return new TextDecoder();
  }
}

function toBytes(chunk: string | Uint8Array): Uint8Array {
  return typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
}
