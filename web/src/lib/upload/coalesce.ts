/**
 * Collapse a burst of calls per key into one trailing call.
 *
 * Uploading 330 files fires 330 completions; invalidating the dataset query
 * on each one would refetch the whole file list 330 times, and every refetch
 * re-reads every caption on disk. One refetch after the burst settles is
 * both correct and enough.
 */
export function coalesceByKey(
  fn: (key: string) => void,
  delayMs = 300
): (key: string) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return (key: string) => {
    const existing = timers.get(key);
    if (existing !== undefined) clearTimeout(existing);

    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        fn(key);
      }, delayMs)
    );
  };
}
