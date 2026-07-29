export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "16rem";
/*
  LOCAL MODIFICATION: upstream ships 18rem. The off-canvas nav is icon+label
  only, and 18rem covered most of a 360px phone, so it is narrowed here.
  Re-running `shadcn-svelte add sidebar` will revert it.
*/
export const SIDEBAR_WIDTH_MOBILE = "13.5rem";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";
