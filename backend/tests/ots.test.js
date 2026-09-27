const fixture = require('../../test-vectors/ots/calendar-responses.json');
const ots = require('../src/services/ots');

const digest = Buffer.from(fixture.digest, 'hex');
const responses = Object.entries(fixture.calendars).map(([url, hex]) => ({ url, bytes: Buffer.from(hex, 'hex') }));

test('real calendar responses parse, and serialize back byte for byte', () => {
  responses.forEach(({ bytes }) => expect(ots.serialize(ots.parse(bytes)).equals(bytes)).toBe(true));
});

// Pool addresses hand the digest to one of their calendars, which the attestation names.
test('each response carries a pending attestation naming the calendar to upgrade from', () => {
  responses.forEach(({ bytes }) => {
    const [p] = ots.pending(ots.parse(bytes), digest);
    expect(p.uri).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(p.commitment.length).toBeGreaterThanOrEqual(32); // often a hash with a nonce appended
  });
});

test('merged calendars keep every attestation; the file starts with the OTS magic', () => {
  const merged = ots.merge(responses.map((r) => ots.parse(r.bytes)));
  expect(ots.pending(merged, digest)).toHaveLength(responses.length);
  const file = ots.otsFile(digest, merged);
  expect(file.subarray(1, 15).toString()).toBe('OpenTimestamps');
  expect(ots.serialize(ots.parse(ots.serialize(merged))).equals(ots.serialize(merged))).toBe(true);
});

test('unknown operations and truncated input are rejected, not guessed', () => {
  expect(() => ots.parse(Buffer.from([0x67, 0x00]))).toThrow(/unsupported/);
  expect(() => ots.parse(responses[0].bytes.subarray(0, 20))).toThrow(/truncated/);
});
