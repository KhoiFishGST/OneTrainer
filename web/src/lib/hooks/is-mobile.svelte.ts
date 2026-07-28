class IsMobile {
  #current = $state(false);
  #initialized = false;

  #init() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !this.#initialized) {
      const mql = window.matchMedia('(max-width: 767px)');
      this.#current = mql.matches;
      const onChange = (e: MediaQueryListEvent) => {
        this.#current = e.matches;
      };
      mql.addEventListener?.('change', onChange);
      mql.addListener?.(onChange);
      this.#initialized = true;
    }
  }

  constructor() {
    this.#init();
  }

  get current() {
    this.#init();
    return this.#current;
  }
}

export const isMobile = new IsMobile();
