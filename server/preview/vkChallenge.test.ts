import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getVkChallengeAnswer } from './vkChallenge.js';

const url = new URL('https://vk.ru/challenge.html?hash429=challenge&redirect=/wall-1_2');

describe('getVkChallengeAnswer', () => {
  it('decodes arithmetic and lookup operations in reverse order', () => {
    const html = `var codes = [[(function(e) {return e + 1;}),(function(e) {return e - 2;}),(function(e) {return e ^ 3;}),(function(){return 65;})],[(function(e) {var map = {"42":66,"5":8};return map[e];}),(function(){return 42;})]];var token = '';`;
    const answer = getVkChallengeAnswer(html, url);
    expect(answer?.searchParams.get('key')).toBe(createHash('md5').update('challenge:AB').digest('hex'));
    expect(answer?.searchParams.get('redirect')).toBe('/wall-1_2');
    expect(url.searchParams.has('key')).toBe(false);
  });

  it('replaces an existing answer instead of appending duplicate keys', () => {
    const html = `var codes = [[(function(){return 65;})]];var token = '';`;
    const answered = new URL(url);
    answered.searchParams.set('key', 'old');
    expect(getVkChallengeAnswer(html, answered)?.searchParams.getAll('key')).toEqual([
      createHash('md5').update('challenge:A').digest('hex'),
    ]);
  });

  it.each([
    '<html>Sign in</html>',
    `var codes = [[(function(){return process.exit();})]];var token = '';`,
    `var codes = [[(function(e) {return eval(e);}),(function(){return 65;})]];var token = '';`,
    `var codes = [[(function(e) {var map = {"4":66};return map[e];}),(function(){return 42;})]];var token = '';`,
    `var codes = [[(function(e) {var map = {"4":};return map[e];}),(function(){return 4;})]];var token = '';`,
    `var codes = [[(function(){return 65536;})]];var token = '';`,
    `var codes = [[(function(){return -1;})]];var token = '';`,
  ])('rejects unsupported or malformed code without executing it', (html) => {
    expect(getVkChallengeAnswer(html, url)).toBeNull();
  });

  it('requires the challenge hash', () => {
    expect(getVkChallengeAnswer(`var codes = [[(function(){return 65;})]];var token = '';`,
      new URL('https://vk.ru/challenge.html'))).toBeNull();
  });
});
