const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const EMOJI_CLUSTER = /^(\p{Extended_Pictographic}|\p{Regional_Indicator})/u;

/** True for messages of one to three emoji and nothing else; those render large. */
export function isEmojiOnly(text) {
  const trimmed = text.replace(/\s+/g, '');
  if (!trimmed || !segmenter) return false;
  const clusters = [...segmenter.segment(trimmed)].map((s) => s.segment);
  return clusters.length <= 3 && clusters.every((c) => EMOJI_CLUSTER.test(c));
}
