// Minimal in-memory stand-ins for Firestore and Firebase Auth, just enough for the logic under test.
// Transactions are serialised and applied atomically, like Firestore's (a failed create() applies nothing).
export function fakeDb() {
  const store = new Map();
  let chain = Promise.resolve();
  const ref = (collection, id) => ({
    path: `${collection}/${id}`, id,
    async get() { return snap(`${collection}/${id}`); },
    async set(data) { store.set(`${collection}/${id}`, structuredClone(data)); },
    async create(data) { if (store.has(`${collection}/${id}`)) throw new Error('ALREADY_EXISTS'); store.set(`${collection}/${id}`, structuredClone(data)); },
    async delete() { store.delete(`${collection}/${id}`); },
    async update(patch) { const key = `${collection}/${id}`; if (!store.has(key)) throw new Error('NOT_FOUND'); store.set(key, { ...store.get(key), ...patch }); },
  });
  const snap = path => ({ exists: store.has(path), id: path.split('/')[1], data: () => structuredClone(store.get(path)) });
  return {
    store,
    collection: name => ({
      doc: id => ref(name, id),
      async get() {
        const docs = [...store.entries()].filter(([key]) => key.startsWith(name + '/')).map(([key]) => snap(key));
        return { docs };
      },
    }),
    runTransaction(fn) {
      const run = async () => {
        const writes = [];
        const tx = {
          get: async r => snap(r.path),
          create: (r, data) => writes.push({ kind: 'create', r, data }),
          set: (r, data) => writes.push({ kind: 'set', r, data }),
          update: (r, data) => writes.push({ kind: 'update', r, data }),
        };
        const result = await fn(tx);
        const seen = new Set();
        for (const w of writes) {
          if (w.kind === 'create' && (store.has(w.r.path) || seen.has(w.r.path))) throw new Error('ALREADY_EXISTS ' + w.r.path);
          if (w.kind === 'update' && !store.has(w.r.path)) throw new Error('NOT_FOUND ' + w.r.path);
          seen.add(w.r.path);
        }
        for (const w of writes) {
          const prior = store.get(w.r.path) || {};
          store.set(w.r.path, w.kind === 'update' ? { ...prior, ...structuredClone(w.data) } : structuredClone(w.data));
        }
        return result;
      };
      const next = chain.then(run, run);
      chain = next.catch(() => {});
      return next;
    },
  };
}

export function fakeAuth() {
  const users = new Map();
  let n = 0;
  return {
    users,
    async createUser({ email, disabled }) {
      if ([...users.values()].some(u => u.email === email)) { const e = new Error('exists'); e.code = 'auth/email-already-exists'; throw e; }
      n += 1; const user = { uid: `uid${n}`, email, disabled: Boolean(disabled) }; users.set(user.uid, user); return user;
    },
    async updateUser(uid, patch) { users.set(uid, { ...users.get(uid), ...patch }); },
    async deleteUser(uid) { users.delete(uid); },
    // Test tokens look like "tok:<uid>:<email>".
    async verifyIdToken(token) { const [kind, uid, email] = String(token).split(':'); if (kind !== 'tok' || !uid) throw new Error('bad token'); return { uid, email }; },
  };
}

export const testConfig = {
  bankId: 'P663', bankName: 'The North Bank', ifsc: 'MAHA0K6P3DY', portalUrl: 'http://localhost:5173/',
  adminEmail: 'admin@test.example', adminPassword: 'test-admin-pass', allowedOrigins: ['http://localhost:5173'],
  smtp: { host: '', user: '', pass: '' }, mailFrom: 'x',
};
