export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.D59Tzher.js",app:"_app/immutable/entry/app.C5nG4WwD.js",imports:["_app/immutable/entry/start.D59Tzher.js","_app/immutable/chunks/CuDynTWb.js","_app/immutable/chunks/BVaEnE3R.js","_app/immutable/chunks/OA8UcISh.js","_app/immutable/entry/app.C5nG4WwD.js","_app/immutable/chunks/BVaEnE3R.js","_app/immutable/chunks/CsbLMh5S.js","_app/immutable/chunks/CV8GLy5s.js","_app/immutable/chunks/BqzCgmlJ.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
