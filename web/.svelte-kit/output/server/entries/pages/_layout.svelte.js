import "clsx";
import { a4 as ssr_context, a2 as setContext, a5 as fallback, a6 as slot, a7 as bind_props } from "../../chunks/index.js";
import { QueryClient } from "@tanstack/query-core";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
const _contextKey = "$$_queryClient";
const setQueryClientContext = (client) => {
  setContext(_contextKey, client);
};
function QueryClientProvider($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let client = fallback($$props["client"], () => new QueryClient(), true);
    setQueryClientContext(client);
    onDestroy(() => {
      client.unmount();
    });
    $$renderer2.push(`<!--[-->`);
    slot($$renderer2, $$props, "default", {});
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { client });
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 1e3 * 60, refetchOnWindowFocus: false }
      }
    });
    let { children } = $$props;
    QueryClientProvider($$renderer2, {
      client: queryClient,
      children: ($$renderer3) => {
        children($$renderer3);
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _layout as default
};
