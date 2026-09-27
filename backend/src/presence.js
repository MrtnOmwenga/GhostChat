// Tracks how many open connections each user has, so a user with two tabs only goes offline when
// the last one closes. Redis keeps the count shared when several server instances run behind a
// load balancer; the in-memory store is for a single instance and tests.

class MemoryPresence {
  constructor() {
    this.counts = new Map();
  }

  async connect(userId) {
    const count = (this.counts.get(userId) || 0) + 1;
    this.counts.set(userId, count);
    return count === 1;
  }

  async disconnect(userId) {
    const count = (this.counts.get(userId) || 1) - 1;
    if (count <= 0) this.counts.delete(userId);
    else this.counts.set(userId, count);
    return count <= 0;
  }

  async online(userIds) {
    return userIds.filter((id) => this.counts.has(id));
  }
}

class RedisPresence {
  constructor(client) {
    this.client = client;
    this.key = 'ghostchat:presence';
  }

  async connect(userId) {
    return (await this.client.hIncrBy(this.key, userId, 1)) === 1;
  }

  async disconnect(userId) {
    const count = await this.client.hIncrBy(this.key, userId, -1);
    if (count <= 0) await this.client.hDel(this.key, userId);
    return count <= 0;
  }

  async online(userIds) {
    if (userIds.length === 0) return [];
    const counts = await this.client.hmGet(this.key, userIds);
    return userIds.filter((id, i) => Number(counts[i]) > 0);
  }
}

module.exports = { MemoryPresence, RedisPresence };
