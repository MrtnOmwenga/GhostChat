const zlib = require('zlib');

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A real PNG (a colour gradient) carrying `comment` in a text chunk, standing in for the metadata
 * (camera, GPS position) a phone photo carries.
 */
function png(width, height, comment) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) row.set([(x * 255) / width, (y * 255) / height, 160], 1 + x * 3);
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('tEXt', Buffer.from(`Comment\0${comment}`, 'latin1')),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Every stored (encrypted) file, as one buffer. */
async function storedFileBytes(db) {
  const chunks = await db.collection('files.chunks').find().toArray();
  return Buffer.concat(chunks.map((c) => Buffer.from(c.data.buffer)));
}

module.exports = { png, storedFileBytes };
