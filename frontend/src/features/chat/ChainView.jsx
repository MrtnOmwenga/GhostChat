import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FaXmark, FaArrowDown } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import IconButton from '../../ui/IconButton';
import style from './ChainView.module.css';
import { trustOf } from './trust';
import { loadFullChain } from '../../lib/messaging';

const short = (hash) => hash.slice(0, 8);

/** The conversation drawn as the hash chain it is: each block names the hash of the one before. */
const ChainView = ({ conversation, title, onSelect, close }) => {
  const [loading, setLoading] = useState(true);
  const records = useSelector((state) => state.chat.messages[conversation]) || [];

  useEffect(() => {
    loadFullChain(conversation).catch((error) => toast.error(error.message)).finally(() => setLoading(false));
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [conversation, close]);

  const broken = records.filter((r) => trustOf(r).level === 'bad').length;

  return (
    <div className={style.backdrop} onClick={close} role="presentation">
      <section className={style.panel} role="dialog" aria-modal="true" aria-labelledby="chain-title" onClick={(e) => e.stopPropagation()}>
        <header className={style.header}>
          <div>
            <h2 id="chain-title">{`Chain · ${title}`}</h2>
            <p className={broken ? style.summaryBad : style.summaryOk}>
              {loading ? 'Loading the whole chain…' : `${records.length} messages · ${broken === 0 ? 'every link and signature verified' : `${broken} could not be verified`}`}
            </p>
          </div>
          <IconButton icon={FaXmark} label="Close" onClick={close} />
        </header>
        <ol className={style.chain} aria-label="Message chain">
          <li className={style.genesis}>genesis</li>
          {records.map((record) => {
            const trust = trustOf(record);
            return (
              <li key={record.seq} className={style.item}>
                <FaArrowDown aria-hidden="true" className={`${style.arrow} ${record.verification?.link === false ? style.brokenArrow : ''}`} />
                <button type="button" className={`${style.block} ${style[trust.level]} ${record.kind === 'deleted' ? style.deleted : ''}`} onClick={() => onSelect(record.seq)} aria-label={`Message ${record.seq}: ${trust.label}`}>
                  <span className={style.seq}>{`#${record.seq}`}</span>
                  <span className={style.who}>{record.senderName}</span>
                  <code className={style.hash}>{`prev ${short(record.prev)} → ${short(record.hash)}`}</code>
                  <span className={style.what}>{record.kind === 'deleted' ? 'deleted' : (record.kind === 'event' ? record.text : trust.label)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};

export default ChainView;
