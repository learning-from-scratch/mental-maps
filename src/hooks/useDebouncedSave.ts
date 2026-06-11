import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useDebouncedSave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  enabled: boolean,
  delayMs = 1500,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const saveRef = useRef(save);
  const skipFirst = useRef(true);

  saveRef.current = save;

  useEffect(() => {
    if (!enabled) return;

    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    setStatus('idle');
    const timer = setTimeout(() => {
      setStatus('saving');
      saveRef
        .current(value)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'));
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, enabled, delayMs]);

  return status;
}
