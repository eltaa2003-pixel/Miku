import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Arithmetic', () => {
  it('adds numbers', () => {
    assert.strictEqual(1 + 1, 2);
  });
});

describe('Command parsing', () => {
  const parseCommand = (text, prefix) => {
    if (!text) return { usedPrefix: '', command: '', args: [], text: '' };
    const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
    const re = prefix instanceof RegExp
      ? prefix
      : new RegExp(str2Regex(String(prefix)));
    const match = re.exec(text);
    if (!match) return { usedPrefix: '', command: '', args: [], text };
    const usedPrefix = match[0];
    const noPrefix = text.slice(usedPrefix.length).trim();
    const [command, ...args] = noPrefix.split` `.filter((v) => v);
    return { usedPrefix, command: command || '', args: args || [], text: noPrefix };
  };

  it('parses prefix and command', () => {
    const result = parseCommand('.help foo bar', '.');
    assert.strictEqual(result.usedPrefix, '.');
    assert.strictEqual(result.command, 'help');
    assert.deepStrictEqual(result.args, ['foo', 'bar']);
  });
});
