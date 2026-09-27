// Seeds two demo users, a direct conversation and a room with messages of every shape the UI has
// to handle: one-word replies, long paragraphs, line breaks, emoji, and unbroken long strings.
// Re-running replaces the previous demo data.  Usage: npm run seed
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/user');
const Room = require('../src/models/room');
const Message = require('../src/models/message');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ghostchat';
const PASSWORD = 'correct horse';

const dm = [
  ['maya', 'hey 👋'],
  ['leo', 'hi!'],
  ['maya', 'Did you see the new GhostChat build?'],
  ['leo', 'yes'],
  ['leo', 'The layout finally works on my phone. The old one had that white border and the sidebar was cut off, so I basically only used it on the laptop.'],
  ['maya', 'ok'],
  ['maya', 'Here is a proper test of a long message, because long messages are where chat layouts usually break. It should wrap cleanly inside the bubble, keep a comfortable line length, never push the page sideways, and leave the timestamp tucked in the corner where it belongs. If you can read this without scrolling horizontally on a phone, the bubble max-width and overflow-wrap are doing their job. 🎉'],
  ['leo', 'Line one\nLine two\nLine three, after two line breaks above'],
  ['maya', 'https://example.com/a/very/long/link/that/keeps/going/and/going/without/any/spaces/to/break/on/so/the/bubble/has/to/wrap/it/anywhere?query=string&with=parameters'],
  ['leo', 'Supercalifragilisticexpialidocious-and-then-some-more-characters-with-no-spaces-at-all'],
  ['maya', '😂😂😂'],
  ['leo', '🔥'],
  ['maya', 'Emoji mixed into text 🌙✨ works too, right? 👀'],
  ['leo', 'k'],
  ['maya', 'Last one: a medium-length message to see how the spacing looks between bubbles of different sizes.'],
];

const room = [
  ['maya', 'Welcome to Night Owls 🦉'],
  ['leo', 'Thanks for the invite'],
  ['maya', 'Rooms show who said what, so this message should have my name above it.'],
  ['leo', 'Yep, and mine too. Long room messages should wrap exactly like direct ones, even when the sender name is longer than the text.'],
  ['maya', '👍'],
];

(async () => {
  const { hostname } = new URL(MONGODB_URI.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
  if (!['localhost', '127.0.0.1', 'mongo'].includes(hostname)) {
    throw new Error(`Refusing to seed a non-local database (${hostname})`);
  }
  await mongoose.connect(MONGODB_URI);

  const names = ['maya', 'leo'];
  const old = await User.find({ username: { $in: names } });
  await Message.deleteMany({ from: { $in: old.map((u) => u._id) } });
  await Room.deleteMany({ name: 'Night Owls' });
  await User.deleteMany({ username: { $in: names } });

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [maya, leo] = await User.create(names.map((username) => ({ username, passwordHash })));
  const users = { maya, leo };
  const nightOwls = await Room.create({ name: 'Night Owls', passwordHash, creator: maya._id, members: [maya._id, leo._id] });

  // Spread the conversation over the last couple of hours so timestamps vary.
  const start = Date.now() - 2 * 60 * 60 * 1000;
  const step = (i) => new Date(start + i * 7 * 60 * 1000);
  await Message.insertMany([
    ...dm.map(([from, text], i) => ({
      from: users[from]._id, fromUsername: from, to: users[from === 'maya' ? 'leo' : 'maya']._id, text, createdAt: step(i),
    })),
    ...room.map(([from, text], i) => ({
      from: users[from]._id, fromUsername: from, room: nightOwls._id, text, createdAt: step(i + dm.length),
    })),
  ]);

  console.log(`Seeded users maya and leo (password: "${PASSWORD}"), room "Night Owls" (same password),`);
  console.log(`${dm.length} direct and ${room.length} room messages.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
