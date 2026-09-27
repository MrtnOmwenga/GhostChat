import React from 'react';
import style from './icon-button.module.css';

/** An icon that behaves as a button: focusable, keyboard-operable, and named for screen readers. */
const IconButton = ({ icon: Icon, label, size = 20, className = '', ...props }) => (
  <button type="button" className={`${style.iconButton} ${className}`} aria-label={label} title={label} {...props}>
    <Icon size={size} aria-hidden="true" />
  </button>
);

export default IconButton;
