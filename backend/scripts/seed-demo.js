// Seeds two demo users, a direct conversation and a room with messages of every shape the UI has
// to handle: one-word replies, long paragraphs, line breaks, emoji, and unbroken long strings.
//
//   npm run seed                      creates demo users maya and leo (replacing earlier demo data)
//   npm run seed -- "Test A" TestB    uses existing accounts: the first two get the direct
//                                     conversation, everyone listed joins the room. Their own
//                                     messages are left alone; running twice adds the messages twice.
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

  const existing = process.argv.slice(2);
  let people;
  let nightOwls;
  if (existing.length > 0) {
    if (existing.length < 2) throw new Error('Name at least two existing users');
    people = await Promise.all(existing.map(async (username) => {
      const user = await User.findOne({ username });
      if (!user) throw new Error(`No user named "${username}"`);
      return user;
    }));
    nightOwls = await Room.findOne({ name: 'Night Owls' });
    if (nightOwls) {
      await Room.updateOne({ _id: nightOwls._id }, { $addToSet: { members: { $each: people.map((u) => u._id) } } });
    } else {
      nightOwls = await Room.create({
        name: 'Night Owls', passwordHash: await bcrypt.hash(PASSWORD, 12), creator: people[0]._id, members: people.map((u) => u._id),
      });
    }
  } else {
    const names = ['maya', 'leo'];
    const old = await User.find({ username: { $in: names } });
    await Message.deleteMany({ from: { $in: old.map((u) => u._id) } });
    await Room.deleteMany({ name: 'Night Owls' });
    await User.deleteMany({ username: { $in: names } });
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    people = await User.create(names.map((username) => ({ username, passwordHash })));
    nightOwls = await Room.create({ name: 'Night Owls', passwordHash, creator: people[0]._id, members: people.map((u) => u._id) });
  }

  // The scripts are written for two speakers; "maya" and "leo" map onto the first two people,
  // and room lines rotate through everyone listed.
  const speaker = { maya: people[0], leo: people[1] };

  // Spread the conversation over the last couple of hours so timestamps vary.
  const start = Date.now() - 2 * 60 * 60 * 1000;
  const step = (i) => new Date(start + i * 7 * 60 * 1000);
  await Message.insertMany([
    ...dm.map(([from, text], i) => {
      const sender = speaker[from];
      const recipient = speaker[from === 'maya' ? 'leo' : 'maya'];
      return { from: sender._id, fromUsername: sender.username, to: recipient._id, text, createdAt: step(i) };
    }),
    ...room.map(([, text], i) => {
      const sender = people[i % people.length];
      return { from: sender._id, fromUsername: sender.username, room: nightOwls._id, text, createdAt: step(i + dm.length) };
    }),
  ]);

  const who = people.map((u) => u.username).join(', ');
  console.log(`Seeded ${dm.length} direct messages between ${people[0].username} and ${people[1].username},`);
  console.log(`and ${room.length} messages in "Night Owls" (members: ${who}; room password "${PASSWORD}").`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
