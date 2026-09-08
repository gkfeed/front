import { createHash } from 'node:crypto';

// VK's public interstitial encodes a salt as small arithmetic functions.
// Interpret only that grammar; never execute JavaScript from a remote page.
export function getVkChallengeAnswer(html: string, pageUrl: URL): URL | null {
  const hash = pageUrl.searchParams.get('hash429');
  const source = html.match(/var codes = (\[\[.{1,30000}?\]\]);var token = '';/)?.[1];
  if (!hash || !source) return null;
  const groups = source.slice(2, -2).split('],[');
  if (groups.length > 128) return null;
  let salt = '';
  for (const group of groups) {
    const functions = group.split('),(').map((value) => value.replace(/^\(|\)$/g, ''));
    if (functions.length > 32) return null;
    const initial = functions.pop()?.match(/^function\(\)\s*\{return (-?\d+);\}$/);
    if (!initial) return null;
    let value = Number(initial[1]);
    for (const operation of functions.reverse()) {
      const arithmetic = operation.match(/^function\(e\)\s*\{return e ([+^-]) (-?\d+);\}$/);
      const mapping = operation.match(/^function\(e\)\s*\{var map = (\{["\d:,-]+\});return map\[e\];\}$/);
      if (arithmetic) {
        const operand = Number(arithmetic[2]);
        if (!Number.isSafeInteger(operand)) return null;
        value = arithmetic[1] === '+' ? value + operand
          : arithmetic[1] === '-' ? value - operand : value ^ operand;
      } else if (mapping) {
        try {
          const entries: Record<string, number> = JSON.parse(mapping[1]!);
          value = entries[String(value)]!;
        } catch {
          return null;
        }
      } else {
        return null;
      }
      if (!Number.isSafeInteger(value)) return null;
    }
    if (!Number.isInteger(value) || value < 0 || value > 65535) return null;
    salt += String.fromCharCode(value);
  }
  const answer = new URL(pageUrl);
  answer.searchParams.set('key', createHash('md5').update(`${hash}:${salt}`).digest('hex'));
  return answer;
}
