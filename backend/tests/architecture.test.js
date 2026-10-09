const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// docs/architecture.yaml is drawn as a diagram on the portfolio site, where nothing would notice
// it going stale. So it is checked here, next to the code it describes.
const root = path.join(__dirname, '..', '..');
const architecture = yaml.load(fs.readFileSync(path.join(root, 'docs/architecture.yaml'), 'utf8'));
const ids = new Set(architecture.parts.map((part) => part.id));
const ID = /^[a-z][a-z0-9-]*$/;

test('every part has an id of its own, a known lane, and something to say', () => {
  const lanes = new Set(architecture.lanes.map((lane) => lane.id));
  expect(ids.size).toBe(architecture.parts.length);
  for (const part of architecture.parts) {
    expect(part.id).toMatch(ID);
    expect(lanes.has(part.lane)).toBe(true);
    for (const text of [part.name, part.what, part.detail]) expect(text.trim()).not.toBe('');
    if (part.story !== undefined) expect(part.story).toMatch(ID);
  }
});

test('every file a part names exists', () => {
  const missing = architecture.parts.flatMap((part) => part.code
    .filter((file) => !fs.existsSync(path.join(root, file))).map((file) => `${part.id}: ${file}`));
  expect(missing).toEqual([]);
  for (const part of architecture.parts) expect(part.code.length).toBeGreaterThan(0);
});

test('connections join parts that exist', () => {
  for (const { from, to } of architecture.connections) expect([ids.has(from), ids.has(to)]).toEqual([true, true]);
});

test('every step of a flow travels along a drawn connection', () => {
  const drawn = new Set(architecture.connections.flatMap(({ from, to }) => [`${from} ${to}`, `${to} ${from}`]));
  for (const flow of architecture.flows) {
    expect(flow.id).toMatch(ID);
    expect(flow.steps.length).toBeGreaterThan(1);
    for (const step of flow.steps) expect(drawn.has(`${step.from} ${step.to}`) ? '' : `${flow.id}: ${step.from} to ${step.to}`).toBe('');
  }
});

test('a test file named as proof exists', () => {
  for (const flow of architecture.flows) {
    for (const [file] of (flow.proof || '').matchAll(/\b(?:backend|frontend|e2e)\/[\w./-]+\.js\b/g)) expect(fs.existsSync(path.join(root, file)) ? '' : file).toBe('');
  }
});
