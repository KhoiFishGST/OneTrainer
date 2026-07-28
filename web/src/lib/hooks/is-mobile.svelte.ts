class IsMobile {
  #current = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      this.#current = mql.matches;
      const onChange = (e: MediaQueryListEvent) => {
        this.#current = e.matches;
      };
      mql.addEventListener('change', onChange);
    }
  }

  get current() {
    const reactiveVal = this.#current;
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      return mql.matches;
    }
    return reactiveVal;
  }
}

export const isMobile = new IsMobile();
