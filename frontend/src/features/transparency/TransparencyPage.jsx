import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeftLong, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';
import IconButton from '../../ui/IconButton';
import style from './TransparencyPage.module.css';
import api from '../../lib/api';
import { acceptHead } from '../../lib/log';
import { keysOf } from '../../lib/messaging';
import { sodium as loadSodium, signingFingerprint } from '../../lib/crypto';

const short = (h) => (h ? `${h.slice(0, 12)}…${h.slice(-6)}` : '');
const hexOf = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const InclusionPath = ({ item, head }) => (
  <li className={style.proof}>
    <p>
      <strong>{`Key version ${item.version}`}</strong>
      {` · log entry #${item.index} · `}
      {item.path.ok ? <span className={style.ok}>included ✓</span> : <span className={style.bad}>not proven</span>}
    </p>
    <ol className={style.path} aria-label={`Inclusion proof for key version ${item.version}`}>
      <li><code>{`leaf ${short(item.leafHash)}`}</code></li>
      {item.path.steps.map((step, i) => (
        // Proof steps have no identity beyond their position.
        // eslint-disable-next-line react/no-array-index-key
        <li key={i}>
          <code>{`${step.side === 'left' ? 'hash(sibling ‖ ·)' : 'hash(· ‖ sibling)'}  sibling ${short(hexOf(step.sibling))}`}</code>
        </li>
      ))}
      <li><code>{`= root ${short(head.rootHash)}`}</code></li>
    </ol>
  </li>
);

/** The key transparency log, made visible (docs/DESIGN.md §5.3, §9). */
const TransparencyPage = () => {
  const navigate = useNavigate();
  const check = useSelector((state) => state.chat.log);
  const [head, setHead] = useState(null);
  const [keyPrint, setKeyPrint] = useState('');
  const [entries, setEntries] = useState([]);
  const [anchors, setAnchors] = useState([]);
  const [mine, setMine] = useState(null);

  useEffect(() => {
    (async () => {
      const sodium = await loadSodium();
      const [{ data: h }, { data: k }, { data: e }, { data: a }] = await Promise.all([
        api.get('/log/head'), api.get('/log/key'), api.get('/log/entries'), api.get('/log/anchors'),
      ]);
      await acceptHead(h);
      setHead(h);
      setKeyPrint(signingFingerprint(sodium, k.publicKey));
      setEntries(e);
      setAnchors(a);
      const me = await api.get('/auth/me').then((r) => r.data).catch(() => null);
      if (me) {
        const history = await keysOf(me.id);
        setMine({ paths: history.logPaths.filter(Boolean), head: history.logHead });
      }
    })().catch(() => {});
  }, []);

  return (
    <div className={style.page}>
      <header className={style.bar}>
        <IconButton icon={FaArrowLeftLong} label="Back" onClick={() => navigate(-1)} />
        <h1>Key transparency log</h1>
      </header>
      <main className={style.main}>
        <p className={style.lead}>
          Every key GhostChat users publish is appended to this log, a Merkle tree the server signs. Your browser
          checks that the keys it uses are in the log and that the log only ever grows, so the server can&apos;t show
          different people different keys or quietly rewrite history. Once a day its root is timestamped on Bitcoin.
        </p>

        <section className={style.card} aria-label="Log status">
          {check && !check.ok ? (
            <p className={style.bad}><FaTriangleExclamation aria-hidden="true" />{` ${check.problems[0]}`}</p>
          ) : (
            <p className={style.ok}><FaCircleCheck aria-hidden="true" /> Signed by the log key and consistent with everything this browser has seen</p>
          )}
          {head && (
            <dl className={style.facts}>
              <dt>Entries</dt><dd>{head.size}</dd>
              <dt>Root hash</dt><dd><code>{head.rootHash}</code></dd>
              <dt>Signed</dt><dd>{new Date(head.timestamp).toLocaleString()}</dd>
              <dt>Log key</dt><dd><code>{keyPrint}</code>{' (pinned by this browser on first use)'}</dd>
            </dl>
          )}
        </section>

        {mine && (
          <section className={style.card} aria-label="Your key entries">
            <h2>Your keys in the log</h2>
            <ol className={style.proofs}>
              {mine.paths.map((item) => <InclusionPath key={item.version} item={item} head={mine.head} />)}
            </ol>
          </section>
        )}

        <section className={style.card} aria-label="Bitcoin anchors">
          <h2>Bitcoin anchors</h2>
          {anchors.length === 0 ? <p className={style.muted}>No anchors yet: the first one is made within a day of the log starting.</p> : (
            <ul className={style.anchors}>
              {anchors.map((a) => (
                <li key={a.id}>
                  <span>{`${a.size} entries · root ${short(a.rootHash)} · ${new Date(a.createdAt).toLocaleDateString()}`}</span>
                  <span>
                    {a.status === 'confirmed'
                      ? <a href={`https://mempool.space/block/${a.bitcoinHeight}`} target="_blank" rel="noreferrer">{`confirmed in block ${a.bitcoinHeight} ✓`}</a>
                      : 'pending Bitcoin confirmation'}
                    {' · '}
                    <a href={`/api/log/anchors/${a.id}.ots`}>download proof</a>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={style.muted}>Verify a proof yourself with the OpenTimestamps client: <code>ots verify -d &lt;root hash&gt; proof.ots</code></p>
        </section>

        <section className={style.card} aria-label="Recent log entries">
          <h2>Recent entries</h2>
          <table className={style.table}>
            <thead><tr><th>#</th><th>User</th><th>Change</th><th>Date</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.index}>
                  <td>{e.index}</td>
                  <td>{e.accountActive ? e.username : `${e.username} (deleted)`}</td>
                  <td className={e.type === 'reset' ? style.bad : ''}>{`${e.type} v${e.version}`}</td>
                  <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
};

export default TransparencyPage;
