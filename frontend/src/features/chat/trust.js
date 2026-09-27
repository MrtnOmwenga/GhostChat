/**
 * What a record's verification means for the UI. `link: null` means the previous message isn't
 * loaded yet, so the link couldn't be checked; that's not a failure.
 */
export function trustOf(record) {
  const v = record.verification || {};
  if (v.signature === true && v.link !== false) {
    if (record.kind === 'deleted') return { level: 'ok', label: 'Deletion signed by the author' };
    return v.link === null
      ? { level: 'partial', label: 'Signature verified; earlier messages not loaded' }
      : { level: 'ok', label: 'Signature and chain link verified' };
  }
  return { level: 'bad', label: v.problems?.[0] || 'Could not be verified' };
}
