import { expect, test } from 'vitest';
import { isEmojiOnly } from './emoji';

test('one to three emoji, including joined and flag sequences, count as emoji-only', () => {
  ['🔥', '😂😂😂', '👍🏽', '👨‍👩‍👧', '🇰🇪', ' ✨ 🌙 '].forEach((t) => expect(isEmojiOnly(t)).toBe(true));
});

test('text, digits, four emoji or empty messages do not', () => {
  ['hi 👋', '😂😂😂😂', '1', '#', '', 'ok'].forEach((t) => expect(isEmojiOnly(t)).toBe(false));
});
