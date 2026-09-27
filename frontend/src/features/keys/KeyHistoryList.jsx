import React from 'react';
import style from './Keys.module.css';

const describe = (event) => {
  if (event.type === 'create') return 'Account created';
  if (event.type === 'rotate') return event.authorised ? 'Keys rotated · signed by the previous key ✓' : 'Rotation NOT authorised by the previous key';
  return 'Keys reset · not linked to the previous key';
};

/** A user's key history as a timeline, from their verified sigchain. */
const KeyHistoryList = ({ events }) => (
  <ol className={style.history} aria-label="Key history">
    {[...events].reverse().map((event) => (
      <li key={event.version} className={event.type === 'reset' || event.authorised === false ? style.warn : ''}>
        <span className={style.version}>{`v${event.version}`}</span>
        <span>
          <strong>{describe(event)}</strong>
          <span className={style.when}>
            {new Date(event.createdAt).toLocaleString()}
            {event.reason ? ` · ${event.reason}` : ''}
          </span>
        </span>
      </li>
    ))}
  </ol>
);

export default KeyHistoryList;
