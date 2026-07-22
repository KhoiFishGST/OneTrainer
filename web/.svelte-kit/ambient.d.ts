
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SVELTEKIT_FORK: string;
	export const NODE_ENV: string;
	export const OLDPWD: string;
	export const npm_node_execpath: string;
	export const GST_COMMON_PATH: string;
	export const ZED_TERM: string;
	export const POWERLINE_COMMAND: string;
	export const NVM_BIN: string;
	export const PATH: string;
	export const ZED_ENVIRONMENT: string;
	export const VENV_PATH: string;
	export const npm_package_json: string;
	export const SSH_CLIENT: string;
	export const npm_config_user_agent: string;
	export const OPENCODE: string;
	export const GST_DEVENV_PATH: string;
	export const OMP_THEME: string;
	export const POSH_SHELL: string;
	export const BUN_INSTALL: string;
	export const TMUX_PANE: string;
	export const KYOTO_CORE_PATH: string;
	export const _: string;
	export const SSH_TTY: string;
	export const PWD: string;
	export const NVM_CD_FLAGS: string;
	export const npm_config_local_prefix: string;
	export const GST_GITHUB_ROOT_PATH: string;
	export const AGENT: string;
	export const CLAWFAM_NVM_READY: string;
	export const HISTSIZE: string;
	export const LSCOLORS: string;
	export const VIRTUAL_ENV_PROMPT: string;
	export const HOME: string;
	export const VISUAL: string;
	export const MOTD_SHOWN: string;
	export const GST_KURA_PATH: string;
	export const npm_command: string;
	export const LOGNAME: string;
	export const EDITOR: string;
	export const ZLE_RPROMPT_INDENT: string;
	export const npm_package_name: string;
	export const TERM_PROGRAM_VERSION: string;
	export const TERM: string;
	export const HISTFILE: string;
	export const GST_VENV: string;
	export const WINDOWS_WSL: string;
	export const ZSH: string;
	export const NODE: string;
	export const COLORTERM: string;
	export const HF_HOME: string;
	export const LESS: string;
	export const SSH_AUTH_SOCK: string;
	export const NVM_INC: string;
	export const PYTHONPATH: string;
	export const TMUX: string;
	export const LS_COLORS: string;
	export const SHELL: string;
	export const POSH_SHELL_VERSION: string;
	export const TERM_PROGRAM: string;
	export const SSH_CONNECTION: string;
	export const npm_execpath: string;
	export const VIRTUAL_ENV: string;
	export const CONDA_PROMPT_MODIFIER: string;
	export const HF_HUB: string;
	export const SHLVL: string;
	export const GST_HOME: string;
	export const SAVEHIST: string;
	export const PYENV_VIRTUALENV_DISABLE_PROMPT: string;
	export const OSTYPE: string;
	export const POSH_CONFIG: string;
	export const POSH_SESSION_ID: string;
	export const npm_lifecycle_script: string;
	export const NVM_DIR: string;
	export const TMUX_CONF_PATH: string;
	export const CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: string;
	export const OPENCODE_PID: string;
	export const VIRTUAL_ENV_DISABLE_PROMPT: string;
	export const USER: string;
	export const npm_lifecycle_event: string;
	export const PAGER: string;
	export const GST_SSH_TERM: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SVELTEKIT_FORK: string;
		NODE_ENV: string;
		OLDPWD: string;
		npm_node_execpath: string;
		GST_COMMON_PATH: string;
		ZED_TERM: string;
		POWERLINE_COMMAND: string;
		NVM_BIN: string;
		PATH: string;
		ZED_ENVIRONMENT: string;
		VENV_PATH: string;
		npm_package_json: string;
		SSH_CLIENT: string;
		npm_config_user_agent: string;
		OPENCODE: string;
		GST_DEVENV_PATH: string;
		OMP_THEME: string;
		POSH_SHELL: string;
		BUN_INSTALL: string;
		TMUX_PANE: string;
		KYOTO_CORE_PATH: string;
		_: string;
		SSH_TTY: string;
		PWD: string;
		NVM_CD_FLAGS: string;
		npm_config_local_prefix: string;
		GST_GITHUB_ROOT_PATH: string;
		AGENT: string;
		CLAWFAM_NVM_READY: string;
		HISTSIZE: string;
		LSCOLORS: string;
		VIRTUAL_ENV_PROMPT: string;
		HOME: string;
		VISUAL: string;
		MOTD_SHOWN: string;
		GST_KURA_PATH: string;
		npm_command: string;
		LOGNAME: string;
		EDITOR: string;
		ZLE_RPROMPT_INDENT: string;
		npm_package_name: string;
		TERM_PROGRAM_VERSION: string;
		TERM: string;
		HISTFILE: string;
		GST_VENV: string;
		WINDOWS_WSL: string;
		ZSH: string;
		NODE: string;
		COLORTERM: string;
		HF_HOME: string;
		LESS: string;
		SSH_AUTH_SOCK: string;
		NVM_INC: string;
		PYTHONPATH: string;
		TMUX: string;
		LS_COLORS: string;
		SHELL: string;
		POSH_SHELL_VERSION: string;
		TERM_PROGRAM: string;
		SSH_CONNECTION: string;
		npm_execpath: string;
		VIRTUAL_ENV: string;
		CONDA_PROMPT_MODIFIER: string;
		HF_HUB: string;
		SHLVL: string;
		GST_HOME: string;
		SAVEHIST: string;
		PYENV_VIRTUALENV_DISABLE_PROMPT: string;
		OSTYPE: string;
		POSH_CONFIG: string;
		POSH_SESSION_ID: string;
		npm_lifecycle_script: string;
		NVM_DIR: string;
		TMUX_CONF_PATH: string;
		CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: string;
		OPENCODE_PID: string;
		VIRTUAL_ENV_DISABLE_PROMPT: string;
		USER: string;
		npm_lifecycle_event: string;
		PAGER: string;
		GST_SSH_TERM: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
