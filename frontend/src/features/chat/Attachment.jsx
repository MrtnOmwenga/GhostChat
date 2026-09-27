import React, { useEffect, useState } from 'react';
import { FaFileLines, FaDownload, FaXmark, FaTriangleExclamation } from 'react-icons/fa6';
import IconButton from '../../ui/IconButton';
import { openFile } from '../../lib/messaging';
import { formatBytes, isInlineImage, thumbUrl } from '../../lib/media';
import style from './Attachment.module.css';

function saveAs(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** A full-size image over the conversation, with a download button. */
export const Lightbox = ({ image, close }) => {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className={style.lightbox} onClick={close} role="presentation">
      <div className={style.lightboxInner} role="dialog" aria-modal="true" aria-label={image.file.name} onClick={(e) => e.stopPropagation()}>
        <div className={style.lightboxBar}>
          <span className={style.name}>{image.file.name}</span>
          <IconButton icon={FaDownload} label="Download" onClick={() => saveAs(image.url, image.file.name)} />
          <IconButton icon={FaXmark} label="Close" onClick={close} />
        </div>
        <img src={image.url} alt={image.file.name} />
      </div>
    </div>
  );
};

/**
 * An attachment inside a message. Images download and decrypt as soon as they're shown, with the
 * embedded thumbnail as a placeholder; other files only when asked for.
 */
const Attachment = ({ file, onOpenImage }) => {
  const image = isInlineImage(file.mime);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!image) return undefined;
    let live = true;
    setError(null);
    openFile(file).then((u) => live && setUrl(u), (e) => live && setError(e.message));
    return () => { live = false; };
  }, [file, image]);

  if (image) {
    const thumb = thumbUrl(file);
    const ratio = file.width && file.height ? { aspectRatio: `${file.width} / ${file.height}` } : undefined;
    return (
      <span className={style.imageWrap}>
        <button type="button" className={style.image} style={ratio} disabled={!url} onClick={() => onOpenImage({ url, file })} aria-label={`Open image ${file.name}`}>
          {(url || thumb) && <img src={url || thumb} alt={file.name} className={url ? '' : style.placeholder} data-state={url ? 'full' : 'thumbnail'} />}
        </button>
        {error && (
          <span className={style.error} role="alert">
            <FaTriangleExclamation aria-hidden="true" />
            {` Image not shown: ${error}`}
          </span>
        )}
      </span>
    );
  }

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      saveAs(await openFile(file), file.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className={style.fileWrap}>
      <span className={style.file}>
        <FaFileLines aria-hidden="true" className={style.fileIcon} />
        <span className={style.fileText}>
          <span className={style.name}>{file.name}</span>
          <span className={style.size}>{formatBytes(file.bytes ?? file.size)}</span>
        </span>
        <button type="button" className={style.download} onClick={download} disabled={busy} aria-label={`Download ${file.name}`}>
          <FaDownload aria-hidden="true" />
        </button>
      </span>
      {error && (
        <span className={style.error} role="alert">
          <FaTriangleExclamation aria-hidden="true" />
          {` Download failed: ${error}`}
        </span>
      )}
    </span>
  );
};

export default Attachment;
