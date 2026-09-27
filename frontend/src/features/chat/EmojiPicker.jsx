import React, { useEffect, useRef } from 'react';
import dataSource from 'emoji-picker-element-data/en/emojibase/data.json?url';
import style from './Conversation.module.css';

/**
 * The emoji picker is a web component loaded only when first opened. Its data file is bundled and
 * served from our own origin: the library's default is a CDN, which would tell a third party when
 * people use GhostChat (and the CSP blocks it anyway).
 */
const EmojiPicker = ({ onPick, close }) => {
  const host = useRef(null);

  useEffect(() => {
    let picker;
    let cancelled = false;
    import('emoji-picker-element').then(({ Picker }) => {
      if (cancelled) return;
      picker = new Picker({ dataSource, locale: 'en' });
      picker.classList.add('dark');
      picker.addEventListener('emoji-click', (event) => onPick(event.detail.unicode));
      host.current.appendChild(picker);
    });
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      picker?.remove();
    };
  }, [onPick, close]);

  return <div ref={host} className={style.emojiPicker} role="dialog" aria-label="Emoji picker" />;
};

export default EmojiPicker;
