import { getContext, setContext } from 'svelte';
import type { ConfigWorkspace } from './workspace.svelte';
import type { ConfigSchema } from './validation';

export interface RouteContext {
  workspace: ConfigWorkspace | null;
  schema: ConfigSchema;
  meta?: Record<string, any>;
  openDirectory?: (currentPath: string, onSelect?: (selectedPath: string) => void) => void;
  openFile?: (currentPath: string, extensions: string[], onSelect?: (selectedPath: string) => void) => void;
}

const CONTEXT_KEY = Symbol('ROUTE_CONTEXT');

export function setRouteContext(context: RouteContext) {
  setContext(CONTEXT_KEY, context);
}

export function getRouteContext(): RouteContext {
  const ctx = getContext<RouteContext>(CONTEXT_KEY);
  if (!ctx) {
    throw new Error('RouteContext not provided');
  }
  return ctx;
}

export function tryGetRouteContext(): RouteContext | null {
  return getContext<RouteContext>(CONTEXT_KEY) ?? null;
}
