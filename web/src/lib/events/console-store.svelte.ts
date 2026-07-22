export interface ConsoleSpan {
  text: string;
  classes: string[];
}

export interface ConsoleLine {
  id: number;
  spans: ConsoleSpan[];
  overwrite?: boolean;
}

export interface BacklogData {
  stream_id: string;
  cursor: number;
  revision: string;
  lines: ConsoleLine[];
  transient: ConsoleLine | null;
}

export interface ConsoleEvent {
  type: string;
  stream_id: string;
  seq: number;
  t?: number;
  lines?: ConsoleLine[];
  revision?: string;
  [key: string]: any;
}

const encoder = new TextEncoder();

function getLineBytes(line: ConsoleLine | null): number {
  if (!line) return 0;
  let bytes = 0;
  for (const span of line.spans) {
    if (span.text) {
      bytes += encoder.encode(span.text).length;
    }
  }
  return bytes;
}

export class ConsoleStore {
  streamId = $state<string | null>(null);
  seq = $state<number>(0);
  committedRows = $state<ConsoleLine[]>([]);
  transientRow = $state<ConsoleLine | null>(null);
  connectionState = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
  gapState = $state<boolean>(false);
  latestRevision = $state<string | null>(null);

  maxLines: number;
  maxBytes: number;
  private currentBytes = 0;

  constructor(maxLines = 10000, maxBytes = 4 * 1024 * 1024) {
    this.maxLines = maxLines;
    this.maxBytes = maxBytes;
  }

  get rows(): ConsoleLine[] {
    return this.transientRow ? [...this.committedRows, this.transientRow] : this.committedRows;
  }

  installBacklog(backlog: BacklogData) {
    this.streamId = backlog.stream_id;
    this.seq = backlog.cursor;
    this.latestRevision = backlog.revision;
    this.transientRow = backlog.transient;
    this.committedRows = [...backlog.lines];
    this.gapState = false;

    this.recalculateBytesAndPrune();
  }

  apply(event: ConsoleEvent): 'ok' | 'resync' | 'restart' {
    if (this.streamId !== null && event.stream_id !== this.streamId) {
      return 'restart';
    }

    if (event.seq <= this.seq) {
      return 'ok';
    }

    if (this.streamId !== null && event.seq > this.seq + 1) {
      this.gapState = true;
      return 'resync';
    }

    if (this.streamId === null) {
      this.streamId = event.stream_id;
    }

    this.seq = event.seq;
    if (event.revision) {
      this.latestRevision = event.revision;
    }

    if (event.lines && event.lines.length > 0) {
      for (const line of event.lines) {
        if (line.overwrite) {
          this.transientRow = line;
        } else {
          this.transientRow = null;
          this.committedRows = [...this.committedRows, line];
          this.currentBytes += getLineBytes(line);
        }
      }
      this.prune();
    }

    return 'ok';
  }

  private recalculateBytesAndPrune() {
    let bytes = 0;
    for (const row of this.committedRows) {
      bytes += getLineBytes(row);
    }
    this.currentBytes = bytes;
    this.prune();
  }

  private prune() {
    let transientBytes = getLineBytes(this.transientRow);
    while (
      this.committedRows.length > 0 &&
      (this.committedRows.length > this.maxLines || (this.currentBytes + transientBytes) > this.maxBytes)
    ) {
      const removed = this.committedRows[0];
      this.committedRows = this.committedRows.slice(1);
      this.currentBytes -= getLineBytes(removed);
    }
  }
}

export const consoleStore = new ConsoleStore();
