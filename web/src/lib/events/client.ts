import type { BacklogData, ConsoleEvent, ConsoleStore } from './console-store.svelte';

export interface WebSocketLike {
  onopen: ((ev: any) => void) | null;
  onmessage: ((ev: { data: any }) => void) | null;
  onerror: ((ev: any) => void) | null;
  onclose: ((ev: any) => void) | null;
  close(): void;
}

export interface EventClientOptions {
  store: ConsoleStore;
  getBacklog: () => Promise<BacklogData>;
  onConfigChanged?: (revision: string) => void;
  onRestart?: () => void;
  wsUrl?: string;
  createSocket?: (url: string) => WebSocketLike;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000, 10000];

export class EventClient {
  private store: ConsoleStore;
  private getBacklog: () => Promise<BacklogData>;
  private onConfigChanged?: (revision: string) => void;
  private onRestart?: () => void;
  private wsUrl: string;
  private createSocket: (url: string) => WebSocketLike;
  private customSetTimeout: typeof setTimeout;
  private customClearTimeout: typeof clearTimeout;

  private socket: WebSocketLike | null = null;
  private status: 'stopped' | 'connecting' | 'queueing' | 'live' | 'resyncing' = 'stopped';
  private eventQueue: ConsoleEvent[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: any = null;
  private isStopped = false;

  constructor(options: EventClientOptions) {
    this.store = options.store;
    this.getBacklog = options.getBacklog;
    this.onConfigChanged = options.onConfigChanged;
    this.onRestart = options.onRestart;

    let defaultWsUrl = '/api/events';
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      defaultWsUrl = `${protocol}//${window.location.host}/api/events`;
    }
    this.wsUrl = options.wsUrl ?? defaultWsUrl;

    this.createSocket =
      options.createSocket ??
      ((url: string) => new WebSocket(url) as unknown as WebSocketLike);

    this.customSetTimeout =
      options.setTimeout ?? ((fn: any, ms?: number) => setTimeout(fn, ms));
    this.customClearTimeout =
      options.clearTimeout ?? ((id: any) => clearTimeout(id));
  }

  start() {
    this.isStopped = false;
    if (this.reconnectTimer) {
      this.customClearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.status = 'connecting';
    this.store.connectionState = 'connecting';

    try {
      this.socket = this.createSocket(this.wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      if (this.isStopped) return;
      this.status = 'queueing';
      this.fetchBacklogAndFlush();
    };

    this.socket.onmessage = (ev) => {
      if (this.isStopped) return;
      let event: ConsoleEvent;
      try {
        event = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      } catch {
        return;
      }

      if (this.status === 'queueing' || this.status === 'resyncing') {
        this.eventQueue.push(event);
      } else if (this.status === 'live') {
        this.processEvent(event);
      }
    };

    this.socket.onerror = () => {
      // onclose will be called by WebSocket upon error
    };

    this.socket.onclose = () => {
      if (this.isStopped) return;
      this.store.connectionState = 'disconnected';
      this.scheduleReconnect();
    };
  }

  stop() {
    this.isStopped = true;
    this.status = 'stopped';
    if (this.reconnectTimer) {
      this.customClearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }
    this.store.connectionState = 'disconnected';
  }

  private async fetchBacklogAndFlush() {
    try {
      const backlog = await this.getBacklog();
      if (this.isStopped) return;

      this.reconnectAttempt = 0;
      this.store.installBacklog(backlog);
      this.store.connectionState = 'connected';

      const queued = this.eventQueue;
      this.eventQueue = [];
      this.status = 'live';

      for (const event of queued) {
        if (event.seq <= backlog.cursor) {
          continue;
        }
        this.processEvent(event);
      }
    } catch {
      if (this.isStopped) return;
      if (this.socket) {
        this.socket.close();
      }
    }
  }

  private processEvent(event: ConsoleEvent) {
    if (event.type === 'config_changed' && event.revision) {
      this.onConfigChanged?.(event.revision);
    }

    if (event.type === 'console') {
      const result = this.store.apply(event);
      if (result === 'resync') {
        this.triggerResync();
      } else if (result === 'restart') {
        this.triggerRestart();
      }
    }
  }

  private triggerResync() {
    this.status = 'resyncing';
    this.fetchBacklogAndFlush();
  }

  private triggerRestart() {
    this.onRestart?.();
    this.stop();
    this.start();
  }

  private scheduleReconnect() {
    if (this.isStopped) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = this.customSetTimeout(() => {
      this.start();
    }, delay);
  }
}
