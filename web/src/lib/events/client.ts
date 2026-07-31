import type { GalleryVariant, GallerySampleStatus } from '../api/types';
import type { BacklogData, ConsoleEvent, ConsoleStore } from './console-store.svelte';
import { trainingStore } from './training-store';

export interface WebSocketLike {
  onopen: ((ev: any) => void) | null;
  onmessage: ((ev: { data: any }) => void) | null;
  onerror: ((ev: any) => void) | null;
  onclose: ((ev: any) => void) | null;
  close(): void;
}

export interface GalleryTrainingSampleEvent {
  type: 'training_sample';
  run_key?: string;
  batch_id?: number;
  webui_prompt_id?: string;
  variant?: GalleryVariant;
  status?: GallerySampleStatus;
  [key: string]: unknown;
}

export interface GalleryWarningEvent {
  type: 'gallery_warning';
  message: string;
  run_key?: string;
  [key: string]: unknown;
}

export interface DatasetFileAddedEvent {
  dataset: string;
  filename: string;
  item_id: string;
  kind: 'image' | 'video' | 'text';
}

export interface EventClientOptions {
  store: ConsoleStore;
  getBacklog: () => Promise<BacklogData>;
  onConfigChanged?: (revision: string) => void;
  onRestart?: () => void;
  onTrainingSample?: (event: GalleryTrainingSampleEvent) => void;
  onGalleryWarning?: (event: GalleryWarningEvent) => void;
  onDatasetFileAdded?: (event: DatasetFileAddedEvent) => void;
  wsUrl?: string;
  createSocket?: (url: string) => WebSocketLike;
  setTimeout?: (fn: (...args: any[]) => void, ms?: number, ...args: any[]) => any;
  clearTimeout?: (id: any) => void;
}

const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000, 10000];

export class EventClient {
  private store: ConsoleStore;
  private getBacklog: () => Promise<BacklogData>;
  private onConfigChanged?: (revision: string) => void;
  private onRestart?: () => void;
  private onTrainingSample?: (event: GalleryTrainingSampleEvent) => void;
  private onGalleryWarning?: (event: GalleryWarningEvent) => void;
  private onDatasetFileAdded?: (event: DatasetFileAddedEvent) => void;
  private wsUrl: string;

  private createSocket: (url: string) => WebSocketLike;
  private customSetTimeout: (fn: (...args: any[]) => void, ms?: number, ...args: any[]) => any;
  private customClearTimeout: (id: any) => void;

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
    this.onTrainingSample = options.onTrainingSample;
    this.onGalleryWarning = options.onGalleryWarning;
    this.onDatasetFileAdded = options.onDatasetFileAdded;

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

  emit(event: ConsoleEvent | any) {
    this.processEvent(event);
  }

  private processEvent(event: ConsoleEvent | any) {
    if (event.type === 'config_changed' && event.revision) {
      this.onConfigChanged?.(event.revision);
    }

    if (event.type === 'training_sample') {
      this.onTrainingSample?.(event);
    }

    if (event.type === 'gallery_warning') {
      this.onGalleryWarning?.(event);
    }

    if (event.type === 'dataset.file.added') {
      this.onDatasetFileAdded?.({
        dataset: event.dataset,
        filename: event.filename,
        item_id: event.item_id,
        kind: event.kind,
      });
      return;
    }

    if (event.type === 'console') {
      const result = this.store.apply(event);
      if (result === 'resync') {
        this.triggerResync();
      } else if (result === 'restart') {
        this.triggerRestart();
      }
    }

    if (event.type?.startsWith('training_') || event.type === 'gpu_stat') {
      trainingStore.applyEvent(event);
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
