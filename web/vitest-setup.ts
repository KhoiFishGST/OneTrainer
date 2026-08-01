import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!(window as any).Path2D) {
    class MockPath2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
    (window as any).Path2D = MockPath2D;
    (globalThis as any).Path2D = MockPath2D;
  }

  if (typeof HTMLElement !== 'undefined' && !('inert' in HTMLElement.prototype)) {
    // jsdom doesn't implement the `inert` IDL attribute, so Svelte's
    // property-setter path (`element.inert = value`) never reaches the DOM
    // as a real attribute. Reflect it the way browsers do.
    Object.defineProperty(HTMLElement.prototype, 'inert', {
      get(this: HTMLElement) {
        return this.hasAttribute('inert');
      },
      set(this: HTMLElement, value: boolean) {
        if (value) {
          this.setAttribute('inert', '');
        } else {
          this.removeAttribute('inert');
        }
      },
      configurable: true,
    });
  }

  if (typeof HTMLCanvasElement !== 'undefined') {
    const mockCtx = {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: [] }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawFocusIfNeeded: () => {},
      scale: () => {},
      rotate: () => {},
      translate: () => {},
      transform: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0 }),
      arc: () => {},
      rect: () => {},
      save: () => {},
      restore: () => {},
      clip: () => {},
      setLineDash: () => {},
      getLineDash: () => [],
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => ({}),
      canvas: {} as any,
    };
    HTMLCanvasElement.prototype.getContext = function (type: string) {
      if (type === '2d') return mockCtx as any;
      return null;
    };
  }
}

if (typeof globalThis !== 'undefined' && !globalThis.localStorage) {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  if (typeof localStorage !== 'undefined' && localStorage?.clear) {
    localStorage.clear();
  }
});

