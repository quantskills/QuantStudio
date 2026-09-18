window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-remotes-quantskills",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region ../../node_modules/zod/v4/core/core.js
		var _a$1;
		function $constructor(name, initializer, params) {
			function init(inst, def) {
				if (!inst._zod) Object.defineProperty(inst, "_zod", {
					value: {
						def,
						constr: _,
						traits: /* @__PURE__ */ new Set()
					},
					enumerable: false
				});
				if (inst._zod.traits.has(name)) return;
				inst._zod.traits.add(name);
				initializer(inst, def);
				const proto = _.prototype;
				const keys = Object.keys(proto);
				for (let i = 0; i < keys.length; i++) {
					const k = keys[i];
					if (!(k in inst)) inst[k] = proto[k].bind(inst);
				}
			}
			const Parent = params?.Parent ?? Object;
			class Definition extends Parent {}
			Object.defineProperty(Definition, "name", { value: name });
			function _(def) {
				var _a;
				const inst = params?.Parent ? new Definition() : this;
				init(inst, def);
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				for (const fn of inst._zod.deferred) fn();
				return inst;
			}
			Object.defineProperty(_, "init", { value: init });
			Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
				if (params?.Parent && inst instanceof params.Parent) return true;
				return inst?._zod?.traits?.has(name);
			} });
			Object.defineProperty(_, "name", { value: name });
			return _;
		}
		var $ZodAsyncError = class extends Error {
			constructor() {
				super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
			}
		};
		var $ZodEncodeError = class extends Error {
			constructor(name) {
				super(`Encountered unidirectional transform during encode: ${name}`);
				this.name = "ZodEncodeError";
			}
		};
		(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
		const globalConfig = globalThis.__zod_globalConfig;
		function config(newConfig) {
			if (newConfig) Object.assign(globalConfig, newConfig);
			return globalConfig;
		}
		//#endregion
		//#region ../../node_modules/zod/v4/core/util.js
		function getEnumValues(entries) {
			const numericValues = Object.values(entries).filter((v) => typeof v === "number");
			return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
		}
		function jsonStringifyReplacer(_, value) {
			if (typeof value === "bigint") return value.toString();
			return value;
		}
		function cached(getter) {
			return { get value() {
				{
					const value = getter();
					Object.defineProperty(this, "value", { value });
					return value;
				}
				throw new Error("cached value already set");
			} };
		}
		function nullish(input) {
			return input === null || input === void 0;
		}
		function cleanRegex(source) {
			const start = source.startsWith("^") ? 1 : 0;
			const end = source.endsWith("$") ? source.length - 1 : source.length;
			return source.slice(start, end);
		}
		function floatSafeRemainder(val, step) {
			const ratio = val / step;
			const roundedRatio = Math.round(ratio);
			const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
			if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
			return ratio - roundedRatio;
		}
		const EVALUATING = /* @__PURE__*/ Symbol("evaluating");
		function defineLazy(object, key, getter) {
			let value = void 0;
			Object.defineProperty(object, key, {
				get() {
					if (value === EVALUATING) return;
					if (value === void 0) {
						value = EVALUATING;
						value = getter();
					}
					return value;
				},
				set(v) {
					Object.defineProperty(object, key, { value: v });
				},
				configurable: true
			});
		}
		function assignProp(target, prop, value) {
			Object.defineProperty(target, prop, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
		}
		function mergeDefs(...defs) {
			const mergedDescriptors = {};
			for (const def of defs) {
				const descriptors = Object.getOwnPropertyDescriptors(def);
				Object.assign(mergedDescriptors, descriptors);
			}
			return Object.defineProperties({}, mergedDescriptors);
		}
		function esc(str) {
			return JSON.stringify(str);
		}
		function slugify(input) {
			return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
		}
		const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
		function isObject(data) {
			return typeof data === "object" && data !== null && !Array.isArray(data);
		}
		const allowsEval = /* @__PURE__*/ cached(() => {
			if (globalConfig.jitless) return false;
			if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
			try {
				new Function("");
				return true;
			} catch (_) {
				return false;
			}
		});
		function isPlainObject(o) {
			if (isObject(o) === false) return false;
			const ctor = o.constructor;
			if (ctor === void 0) return true;
			if (typeof ctor !== "function") return true;
			const prot = ctor.prototype;
			if (isObject(prot) === false) return false;
			if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
			return true;
		}
		function shallowClone(o) {
			if (isPlainObject(o)) return { ...o };
			if (Array.isArray(o)) return [...o];
			if (o instanceof Map) return new Map(o);
			if (o instanceof Set) return new Set(o);
			return o;
		}
		const propertyKeyTypes = /* @__PURE__*/ new Set([
			"string",
			"number",
			"symbol"
		]);
		function escapeRegex(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function clone(inst, def, params) {
			const cl = new inst._zod.constr(def ?? inst._zod.def);
			if (!def || params?.parent) cl._zod.parent = inst;
			return cl;
		}
		function normalizeParams(_params) {
			const params = _params;
			if (!params) return {};
			if (typeof params === "string") return { error: () => params };
			if (params?.message !== void 0) {
				if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
				params.error = params.message;
			}
			delete params.message;
			if (typeof params.error === "string") return {
				...params,
				error: () => params.error
			};
			return params;
		}
		function optionalKeys(shape) {
			return Object.keys(shape).filter((k) => {
				return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
			});
		}
		const NUMBER_FORMAT_RANGES = {
			safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
			int32: [-2147483648, 2147483647],
			uint32: [0, 4294967295],
			float32: [-34028234663852886e22, 34028234663852886e22],
			float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
		};
		function pick(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = {};
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						newShape[key] = currDef.shape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function omit(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = { ...schema._zod.def.shape };
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						delete newShape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function extend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) {
				const existingShape = schema._zod.def.shape;
				for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
			}
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function safeExtend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function merge(a, b) {
			if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
			return clone(a, mergeDefs(a._zod.def, {
				get shape() {
					const _shape = {
						...a._zod.def.shape,
						...b._zod.def.shape
					};
					assignProp(this, "shape", _shape);
					return _shape;
				},
				get catchall() {
					return b._zod.def.catchall;
				},
				checks: b._zod.def.checks ?? []
			}));
		}
		function partial(Class, schema, mask) {
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const oldShape = schema._zod.def.shape;
					const shape = { ...oldShape };
					if (mask) for (const key in mask) {
						if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						shape[key] = Class ? new Class({
							type: "optional",
							innerType: oldShape[key]
						}) : oldShape[key];
					}
					else for (const key in oldShape) shape[key] = Class ? new Class({
						type: "optional",
						innerType: oldShape[key]
					}) : oldShape[key];
					assignProp(this, "shape", shape);
					return shape;
				},
				checks: []
			}));
		}
		function required(Class, schema, mask) {
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const oldShape = schema._zod.def.shape;
				const shape = { ...oldShape };
				if (mask) for (const key in mask) {
					if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					shape[key] = new Class({
						type: "nonoptional",
						innerType: oldShape[key]
					});
				}
				else for (const key in oldShape) shape[key] = new Class({
					type: "nonoptional",
					innerType: oldShape[key]
				});
				assignProp(this, "shape", shape);
				return shape;
			} }));
		}
		function aborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
			return false;
		}
		function explicitlyAborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
			return false;
		}
		function prefixIssues(path, issues) {
			return issues.map((iss) => {
				var _a;
				(_a = iss).path ?? (_a.path = []);
				iss.path.unshift(path);
				return iss;
			});
		}
		function unwrapMessage(message) {
			return typeof message === "string" ? message : message?.message;
		}
		function finalizeIssue(iss, ctx, config) {
			const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
			const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
			rest.path ?? (rest.path = []);
			rest.message = message;
			if (ctx?.reportInput) rest.input = _input;
			return rest;
		}
		function getLengthableOrigin(input) {
			if (Array.isArray(input)) return "array";
			if (typeof input === "string") return "string";
			return "unknown";
		}
		function issue(...args) {
			const [iss, input, inst] = args;
			if (typeof iss === "string") return {
				message: iss,
				code: "custom",
				input,
				inst
			};
			return { ...iss };
		}
		//#endregion
		//#region ../../node_modules/zod/v4/core/errors.js
		const initializer$1 = (inst, def) => {
			inst.name = "$ZodError";
			Object.defineProperty(inst, "_zod", {
				value: inst._zod,
				enumerable: false
			});
			Object.defineProperty(inst, "issues", {
				value: def,
				enumerable: false
			});
			inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
			Object.defineProperty(inst, "toString", {
				value: () => inst.message,
				enumerable: false
			});
		};
		const $ZodError = $constructor("$ZodError", initializer$1);
		const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
		function flattenError(error, mapper = (issue) => issue.message) {
			const fieldErrors = {};
			const formErrors = [];
			for (const sub of error.issues) if (sub.path.length > 0) {
				fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
				fieldErrors[sub.path[0]].push(mapper(sub));
			} else formErrors.push(mapper(sub));
			return {
				formErrors,
				fieldErrors
			};
		}
		function formatError(error, mapper = (issue) => issue.message) {
			const fieldErrors = { _errors: [] };
			const processError = (error, path = []) => {
				for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
				else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else {
					const fullpath = [...path, ...issue.path];
					if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
					else {
						let curr = fieldErrors;
						let i = 0;
						while (i < fullpath.length) {
							const el = fullpath[i];
							if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
							else {
								curr[el] = curr[el] || { _errors: [] };
								curr[el]._errors.push(mapper(issue));
							}
							curr = curr[el];
							i++;
						}
					}
				}
			};
			processError(error);
			return fieldErrors;
		}
		//#endregion
		//#region ../../node_modules/zod/v4/core/parse.js
		const _parse = (_Err) => (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			if (result.issues.length) {
				const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, _params?.callee);
				throw e;
			}
			return result.value;
		};
		const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			if (result.issues.length) {
				const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, params?.callee);
				throw e;
			}
			return result.value;
		};
		const _safeParse = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length ? {
				success: false,
				error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
		const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length ? {
				success: false,
				error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
		const _encode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parse(_Err)(schema, value, ctx);
		};
		const _decode = (_Err) => (schema, value, _ctx) => {
			return _parse(_Err)(schema, value, _ctx);
		};
		const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parseAsync(_Err)(schema, value, ctx);
		};
		const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _parseAsync(_Err)(schema, value, _ctx);
		};
		const _safeEncode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParse(_Err)(schema, value, ctx);
		};
		const _safeDecode = (_Err) => (schema, value, _ctx) => {
			return _safeParse(_Err)(schema, value, _ctx);
		};
		const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParseAsync(_Err)(schema, value, ctx);
		};
		const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _safeParseAsync(_Err)(schema, value, _ctx);
		};
		//#endregion
		//#region ../../node_modules/zod/v4/core/regexes.js
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const cuid = /^[cC][0-9a-z]{6,}$/;
		const cuid2 = /^[0-9a-z]+$/;
		const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
		const xid = /^[0-9a-vA-V]{20}$/;
		const ksuid = /^[A-Za-z0-9]{27}$/;
		const nanoid = /^[a-zA-Z0-9_-]{21}$/;
		/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
		const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
		/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
		const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
		/** Returns a regex for validating an RFC 9562/4122 UUID.
		*
		* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
		const uuid = (version) => {
			if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
			return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
		};
		/** Practical email validation */
		const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
		const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
		function emoji() {
			return new RegExp(_emoji$1, "u");
		}
		const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
		const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
		const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
		const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
		const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
		const base64url = /^[A-Za-z0-9_-]*$/;
		const httpProtocol = /^https?$/;
		const e164 = /^\+[1-9]\d{6,14}$/;
		const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
		const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
		function timeSource(args) {
			const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
			return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
		}
		function time$1(args) {
			return new RegExp(`^${timeSource(args)}$`);
		}
		function datetime$1(args) {
			const time = timeSource({ precision: args.precision });
			const opts = ["Z"];
			if (args.local) opts.push("");
			if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
			const timeRegex = `${time}(?:${opts.join("|")})`;
			return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
		}
		const string$1 = (params) => {
			const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
			return new RegExp(`^${regex}$`);
		};
		const integer = /^-?\d+$/;
		const number$1 = /^-?\d+(?:\.\d+)?$/;
		const boolean$1 = /^(?:true|false)$/i;
		const _undefined$2 = /^undefined$/i;
		const lowercase = /^[^A-Z]*$/;
		const uppercase = /^[^a-z]*$/;
		//#endregion
		//#region ../../node_modules/zod/v4/core/checks.js
		const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
			var _a;
			inst._zod ?? (inst._zod = {});
			inst._zod.def = def;
			(_a = inst._zod).onattach ?? (_a.onattach = []);
		});
		const numericOriginMap = {
			number: "number",
			bigint: "bigint",
			object: "date"
		};
		const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
				if (def.value < curr) if (def.inclusive) bag.maximum = def.value;
				else bag.exclusiveMaximum = def.value;
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
				if (def.value > curr) if (def.inclusive) bag.minimum = def.value;
				else bag.exclusiveMinimum = def.value;
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				var _a;
				(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
			});
			inst._zod.check = (payload) => {
				if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
				if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
				payload.issues.push({
					origin: typeof payload.value,
					code: "not_multiple_of",
					divisor: def.value,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
			$ZodCheck.init(inst, def);
			def.format = def.format || "float64";
			const isInt = def.format?.includes("int");
			const origin = isInt ? "int" : "number";
			const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				bag.minimum = minimum;
				bag.maximum = maximum;
				if (isInt) bag.pattern = integer;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (isInt) {
					if (!Number.isInteger(input)) {
						payload.issues.push({
							expected: origin,
							format: def.format,
							code: "invalid_type",
							continue: false,
							input,
							inst
						});
						return;
					}
					if (!Number.isSafeInteger(input)) {
						if (input > 0) payload.issues.push({
							input,
							code: "too_big",
							maximum: Number.MAX_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						else payload.issues.push({
							input,
							code: "too_small",
							minimum: Number.MIN_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						return;
					}
				}
				if (input < minimum) payload.issues.push({
					origin: "number",
					input,
					code: "too_small",
					minimum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
				if (input > maximum) payload.issues.push({
					origin: "number",
					input,
					code: "too_big",
					maximum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
				if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length <= def.maximum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: def.maximum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
				if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length >= def.minimum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: def.minimum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.minimum = def.length;
				bag.maximum = def.length;
				bag.length = def.length;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				const length = input.length;
				if (length === def.length) return;
				const origin = getLengthableOrigin(input);
				const tooBig = length > def.length;
				payload.issues.push({
					origin,
					...tooBig ? {
						code: "too_big",
						maximum: def.length
					} : {
						code: "too_small",
						minimum: def.length
					},
					inclusive: true,
					exact: true,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
			var _a, _b;
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				if (def.pattern) {
					bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
					bag.patterns.add(def.pattern);
				}
			});
			if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: def.format,
					input: payload.value,
					...def.pattern ? { pattern: def.pattern.toString() } : {},
					inst,
					continue: !def.abort
				});
			});
			else (_b = inst._zod).check ?? (_b.check = () => {});
		});
		const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "regex",
					input: payload.value,
					pattern: def.pattern.toString(),
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
			def.pattern ?? (def.pattern = lowercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
			def.pattern ?? (def.pattern = uppercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
			$ZodCheck.init(inst, def);
			const escapedRegex = escapeRegex(def.includes);
			const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
			def.pattern = pattern;
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.includes(def.includes, def.position)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "includes",
					includes: def.includes,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.startsWith(def.prefix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "starts_with",
					prefix: def.prefix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.endsWith(def.suffix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "ends_with",
					suffix: def.suffix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				payload.value = def.tx(payload.value);
			};
		});
		//#endregion
		//#region ../../node_modules/zod/v4/core/doc.js
		var Doc = class {
			constructor(args = []) {
				this.content = [];
				this.indent = 0;
				if (this) this.args = args;
			}
			indented(fn) {
				this.indent += 1;
				fn(this);
				this.indent -= 1;
			}
			write(arg) {
				if (typeof arg === "function") {
					arg(this, { execution: "sync" });
					arg(this, { execution: "async" });
					return;
				}
				const lines = arg.split("\n").filter((x) => x);
				const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
				const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
				for (const line of dedented) this.content.push(line);
			}
			compile() {
				const F = Function;
				const args = this?.args;
				const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
				return new F(...args, lines.join("\n"));
			}
		};
		//#endregion
		//#region ../../node_modules/zod/v4/core/versions.js
		const version = {
			major: 4,
			minor: 4,
			patch: 3
		};
		//#endregion
		//#region ../../node_modules/zod/v4/core/schemas.js
		const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
			var _a;
			inst ?? (inst = {});
			inst._zod.def = def;
			inst._zod.bag = inst._zod.bag || {};
			inst._zod.version = version;
			const checks = [...inst._zod.def.checks ?? []];
			if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
			for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
			if (checks.length === 0) {
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred?.push(() => {
					inst._zod.run = inst._zod.parse;
				});
			} else {
				const runChecks = (payload, checks, ctx) => {
					let isAborted = aborted(payload);
					let asyncResult;
					for (const ch of checks) {
						if (ch._zod.def.when) {
							if (explicitlyAborted(payload)) continue;
							if (!ch._zod.def.when(payload)) continue;
						} else if (isAborted) continue;
						const currLen = payload.issues.length;
						const _ = ch._zod.check(payload);
						if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
						if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
							await _;
							if (payload.issues.length === currLen) return;
							if (!isAborted) isAborted = aborted(payload, currLen);
						});
						else {
							if (payload.issues.length === currLen) continue;
							if (!isAborted) isAborted = aborted(payload, currLen);
						}
					}
					if (asyncResult) return asyncResult.then(() => {
						return payload;
					});
					return payload;
				};
				const handleCanaryResult = (canary, payload, ctx) => {
					if (aborted(canary)) {
						canary.aborted = true;
						return canary;
					}
					const checkResult = runChecks(payload, checks, ctx);
					if (checkResult instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
					}
					return inst._zod.parse(checkResult, ctx);
				};
				inst._zod.run = (payload, ctx) => {
					if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
					if (ctx.direction === "backward") {
						const canary = inst._zod.parse({
							value: payload.value,
							issues: []
						}, {
							...ctx,
							skipChecks: true
						});
						if (canary instanceof Promise) return canary.then((canary) => {
							return handleCanaryResult(canary, payload, ctx);
						});
						return handleCanaryResult(canary, payload, ctx);
					}
					const result = inst._zod.parse(payload, ctx);
					if (result instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return result.then((result) => runChecks(result, checks, ctx));
					}
					return runChecks(result, checks, ctx);
				};
			}
			defineLazy(inst, "~standard", () => ({
				validate: (value) => {
					try {
						const r = safeParse$1(inst, value);
						return r.success ? { value: r.data } : { issues: r.error?.issues };
					} catch (_) {
						return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
					}
				},
				vendor: "zod",
				version: 1
			}));
		});
		const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
			inst._zod.parse = (payload, _) => {
				if (def.coerce) try {
					payload.value = String(payload.value);
				} catch (_) {}
				if (typeof payload.value === "string") return payload;
				payload.issues.push({
					expected: "string",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			$ZodString.init(inst, def);
		});
		const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
			def.pattern ?? (def.pattern = guid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
			if (def.version) {
				const v = {
					v1: 1,
					v2: 2,
					v3: 3,
					v4: 4,
					v5: 5,
					v6: 6,
					v7: 7,
					v8: 8
				}[def.version];
				if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
				def.pattern ?? (def.pattern = uuid(v));
			} else def.pattern ?? (def.pattern = uuid());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
			def.pattern ?? (def.pattern = email);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				try {
					const trimmed = payload.value.trim();
					if (!def.normalize && def.protocol?.source === httpProtocol.source) {
						if (!/^https?:\/\//i.test(trimmed)) {
							payload.issues.push({
								code: "invalid_format",
								format: "url",
								note: "Invalid URL format",
								input: payload.value,
								inst,
								continue: !def.abort
							});
							return;
						}
					}
					const url = new URL(trimmed);
					if (def.hostname) {
						def.hostname.lastIndex = 0;
						if (!def.hostname.test(url.hostname)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid hostname",
							pattern: def.hostname.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.protocol) {
						def.protocol.lastIndex = 0;
						if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid protocol",
							pattern: def.protocol.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.normalize) payload.value = url.href;
					else payload.value = trimmed;
					return;
				} catch (_) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
			def.pattern ?? (def.pattern = emoji());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
			def.pattern ?? (def.pattern = nanoid);
			$ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
			def.pattern ?? (def.pattern = cuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
			def.pattern ?? (def.pattern = cuid2);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
			def.pattern ?? (def.pattern = ulid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
			def.pattern ?? (def.pattern = xid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
			def.pattern ?? (def.pattern = ksuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
			def.pattern ?? (def.pattern = datetime$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
			def.pattern ?? (def.pattern = date$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
			def.pattern ?? (def.pattern = time$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
			def.pattern ?? (def.pattern = duration$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
			def.pattern ?? (def.pattern = ipv4);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv4`;
		});
		const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
			def.pattern ?? (def.pattern = ipv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv6`;
			inst._zod.check = (payload) => {
				try {
					new URL(`http://[${payload.value}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "ipv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv4);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				const parts = payload.value.split("/");
				try {
					if (parts.length !== 2) throw new Error();
					const [address, prefix] = parts;
					if (!prefix) throw new Error();
					const prefixNum = Number(prefix);
					if (`${prefixNum}` !== prefix) throw new Error();
					if (prefixNum < 0 || prefixNum > 128) throw new Error();
					new URL(`http://[${address}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "cidrv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		function isValidBase64(data) {
			if (data === "") return true;
			if (/\s/.test(data)) return false;
			if (data.length % 4 !== 0) return false;
			try {
				atob(data);
				return true;
			} catch {
				return false;
			}
		}
		const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
			def.pattern ?? (def.pattern = base64);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64";
			inst._zod.check = (payload) => {
				if (isValidBase64(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		function isValidBase64URL(data) {
			if (!base64url.test(data)) return false;
			const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
			return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
		}
		const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
			def.pattern ?? (def.pattern = base64url);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64url";
			inst._zod.check = (payload) => {
				if (isValidBase64URL(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
			def.pattern ?? (def.pattern = e164);
			$ZodStringFormat.init(inst, def);
		});
		function isValidJWT(token, algorithm = null) {
			try {
				const tokensParts = token.split(".");
				if (tokensParts.length !== 3) return false;
				const [header] = tokensParts;
				if (!header) return false;
				const parsedHeader = JSON.parse(atob(header));
				if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
				if (!parsedHeader.alg) return false;
				if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
				return true;
			} catch {
				return false;
			}
		}
		const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidJWT(payload.value, def.alg)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "jwt",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Number(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
				const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
				payload.issues.push({
					expected: "number",
					code: "invalid_type",
					input,
					inst,
					...received ? { received } : {}
				});
				return payload;
			};
		});
		const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
			$ZodCheckNumberFormat.init(inst, def);
			$ZodNumber.init(inst, def);
		});
		const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = boolean$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Boolean(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "boolean") return payload;
				payload.issues.push({
					expected: "boolean",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUndefined = /*@__PURE__*/ $constructor("$ZodUndefined", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = _undefined$2;
			inst._zod.values = /* @__PURE__ */ new Set([void 0]);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (typeof input === "undefined") return payload;
				payload.issues.push({
					expected: "undefined",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload) => payload;
		});
		const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				payload.issues.push({
					expected: "never",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodVoid = /*@__PURE__*/ $constructor("$ZodVoid", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (typeof input === "undefined") return payload;
				payload.issues.push({
					expected: "void",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		function handleArrayResult(result, final, index) {
			if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
			final.value[index] = result.value;
		}
		const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!Array.isArray(input)) {
					payload.issues.push({
						expected: "array",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = Array(input.length);
				const proms = [];
				for (let i = 0; i < input.length; i++) {
					const item = input[i];
					const result = def.element._zod.run({
						value: item,
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
					else handleArrayResult(result, payload, i);
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
		});
		function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
			const isPresent = key in input;
			if (result.issues.length) {
				if (isOptionalIn && isOptionalOut && !isPresent) return;
				final.issues.push(...prefixIssues(key, result.issues));
			}
			if (!isPresent && !isOptionalIn) {
				if (!result.issues.length) final.issues.push({
					code: "invalid_type",
					expected: "nonoptional",
					input: void 0,
					path: [key]
				});
				return;
			}
			if (result.value === void 0) {
				if (isPresent) final.value[key] = void 0;
			} else final.value[key] = result.value;
		}
		function normalizeDef(def) {
			const keys = Object.keys(def.shape);
			for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
			const okeys = optionalKeys(def.shape);
			return {
				...def,
				keys,
				keySet: new Set(keys),
				numKeys: keys.length,
				optionalKeys: new Set(okeys)
			};
		}
		function handleCatchall(proms, input, payload, ctx, def, inst) {
			const unrecognized = [];
			const keySet = def.keySet;
			const _catchall = def.catchall._zod;
			const t = _catchall.def.type;
			const isOptionalIn = _catchall.optin === "optional";
			const isOptionalOut = _catchall.optout === "optional";
			for (const key in input) {
				if (key === "__proto__") continue;
				if (keySet.has(key)) continue;
				if (t === "never") {
					unrecognized.push(key);
					continue;
				}
				const r = _catchall.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
				else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
			}
			if (unrecognized.length) payload.issues.push({
				code: "unrecognized_keys",
				keys: unrecognized,
				input,
				inst
			});
			if (!proms.length) return payload;
			return Promise.all(proms).then(() => {
				return payload;
			});
		}
		const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
			$ZodType.init(inst, def);
			if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
				const sh = def.shape;
				Object.defineProperty(def, "shape", { get: () => {
					const newSh = { ...sh };
					Object.defineProperty(def, "shape", { value: newSh });
					return newSh;
				} });
			}
			const _normalized = cached(() => normalizeDef(def));
			defineLazy(inst._zod, "propValues", () => {
				const shape = def.shape;
				const propValues = {};
				for (const key in shape) {
					const field = shape[key]._zod;
					if (field.values) {
						propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
						for (const v of field.values) propValues[key].add(v);
					}
				}
				return propValues;
			});
			const isObject$2 = isObject;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$2(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = {};
				const proms = [];
				const shape = value.shape;
				for (const key of value.keys) {
					const el = shape[key];
					const isOptionalIn = el._zod.optin === "optional";
					const isOptionalOut = el._zod.optout === "optional";
					const r = el._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
					else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
				}
				if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
				return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
			};
		});
		const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
			$ZodObject.init(inst, def);
			const superParse = inst._zod.parse;
			const _normalized = cached(() => normalizeDef(def));
			const generateFastpass = (shape) => {
				const doc = new Doc([
					"shape",
					"payload",
					"ctx"
				]);
				const normalized = _normalized.value;
				const parseStr = (key) => {
					const k = esc(key);
					return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
				};
				doc.write(`const input = payload.value;`);
				const ids = Object.create(null);
				let counter = 0;
				for (const key of normalized.keys) ids[key] = `key_${counter++}`;
				doc.write(`const newResult = {};`);
				for (const key of normalized.keys) {
					const id = ids[key];
					const k = esc(key);
					const schema = shape[key];
					const isOptionalIn = schema?._zod?.optin === "optional";
					const isOptionalOut = schema?._zod?.optout === "optional";
					doc.write(`const ${id} = ${parseStr(key)};`);
					if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
					else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
					else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
				}
				doc.write(`payload.value = newResult;`);
				doc.write(`return payload;`);
				const fn = doc.compile();
				return (payload, ctx) => fn(shape, payload, ctx);
			};
			let fastpass;
			const isObject$1 = isObject;
			const jit = !globalConfig.jitless;
			const fastEnabled = jit && allowsEval.value;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$1(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
					if (!fastpass) fastpass = generateFastpass(def.shape);
					payload = fastpass(payload, ctx);
					if (!catchall) return payload;
					return handleCatchall([], input, payload, ctx, value, inst);
				}
				return superParse(payload, ctx);
			};
		});
		function handleUnionResults(results, final, inst, ctx) {
			for (const result of results) if (result.issues.length === 0) {
				final.value = result.value;
				return final;
			}
			const nonaborted = results.filter((r) => !aborted(r));
			if (nonaborted.length === 1) {
				final.value = nonaborted[0].value;
				return nonaborted[0];
			}
			final.issues.push({
				code: "invalid_union",
				input: final.value,
				inst,
				errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			});
			return final;
		}
		const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "values", () => {
				if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
			});
			defineLazy(inst._zod, "pattern", () => {
				if (def.options.every((o) => o._zod.pattern)) {
					const patterns = def.options.map((o) => o._zod.pattern);
					return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
				}
			});
			const first = def.options.length === 1 ? def.options[0]._zod.run : null;
			inst._zod.parse = (payload, ctx) => {
				if (first) return first(payload, ctx);
				let async = false;
				const results = [];
				for (const option of def.options) {
					const result = option._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) {
						results.push(result);
						async = true;
					} else {
						if (result.issues.length === 0) return result;
						results.push(result);
					}
				}
				if (!async) return handleUnionResults(results, payload, inst, ctx);
				return Promise.all(results).then((results) => {
					return handleUnionResults(results, payload, inst, ctx);
				});
			};
		});
		const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				const left = def.left._zod.run({
					value: input,
					issues: []
				}, ctx);
				const right = def.right._zod.run({
					value: input,
					issues: []
				}, ctx);
				if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
					return handleIntersectionResults(payload, left, right);
				});
				return handleIntersectionResults(payload, left, right);
			};
		});
		function mergeValues(a, b) {
			if (a === b) return {
				valid: true,
				data: a
			};
			if (a instanceof Date && b instanceof Date && +a === +b) return {
				valid: true,
				data: a
			};
			if (isPlainObject(a) && isPlainObject(b)) {
				const bKeys = Object.keys(b);
				const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
				const newObj = {
					...a,
					...b
				};
				for (const key of sharedKeys) {
					const sharedValue = mergeValues(a[key], b[key]);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
					};
					newObj[key] = sharedValue.data;
				}
				return {
					valid: true,
					data: newObj
				};
			}
			if (Array.isArray(a) && Array.isArray(b)) {
				if (a.length !== b.length) return {
					valid: false,
					mergeErrorPath: []
				};
				const newArray = [];
				for (let index = 0; index < a.length; index++) {
					const itemA = a[index];
					const itemB = b[index];
					const sharedValue = mergeValues(itemA, itemB);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
					};
					newArray.push(sharedValue.data);
				}
				return {
					valid: true,
					data: newArray
				};
			}
			return {
				valid: false,
				mergeErrorPath: []
			};
		}
		function handleIntersectionResults(result, left, right) {
			const unrecKeys = /* @__PURE__ */ new Map();
			let unrecIssue;
			for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
				unrecIssue ?? (unrecIssue = iss);
				for (const k of iss.keys) {
					if (!unrecKeys.has(k)) unrecKeys.set(k, {});
					unrecKeys.get(k).l = true;
				}
			} else result.issues.push(iss);
			for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
				if (!unrecKeys.has(k)) unrecKeys.set(k, {});
				unrecKeys.get(k).r = true;
			}
			else result.issues.push(iss);
			const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
			if (bothKeys.length && unrecIssue) result.issues.push({
				...unrecIssue,
				keys: bothKeys
			});
			if (aborted(result)) return result;
			const merged = mergeValues(left.value, right.value);
			if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
			result.value = merged.data;
			return result;
		}
		const $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!isPlainObject(input)) {
					payload.issues.push({
						expected: "record",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				const proms = [];
				const values = def.keyType._zod.values;
				if (values) {
					payload.value = {};
					const recordKeys = /* @__PURE__ */ new Set();
					for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
						recordKeys.add(typeof key === "number" ? key.toString() : key);
						const keyResult = def.keyType._zod.run({
							value: key,
							issues: []
						}, ctx);
						if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
						if (keyResult.issues.length) {
							payload.issues.push({
								code: "invalid_key",
								origin: "record",
								issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
								input: key,
								path: [key],
								inst
							});
							continue;
						}
						const outKey = keyResult.value;
						const result = def.valueType._zod.run({
							value: input[key],
							issues: []
						}, ctx);
						if (result instanceof Promise) proms.push(result.then((result) => {
							if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
							payload.value[outKey] = result.value;
						}));
						else {
							if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
							payload.value[outKey] = result.value;
						}
					}
					let unrecognized;
					for (const key in input) if (!recordKeys.has(key)) {
						unrecognized = unrecognized ?? [];
						unrecognized.push(key);
					}
					if (unrecognized && unrecognized.length > 0) payload.issues.push({
						code: "unrecognized_keys",
						input,
						inst,
						keys: unrecognized
					});
				} else {
					payload.value = {};
					for (const key of Reflect.ownKeys(input)) {
						if (key === "__proto__") continue;
						if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
						let keyResult = def.keyType._zod.run({
							value: key,
							issues: []
						}, ctx);
						if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
						if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
							const retryResult = def.keyType._zod.run({
								value: Number(key),
								issues: []
							}, ctx);
							if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
							if (retryResult.issues.length === 0) keyResult = retryResult;
						}
						if (keyResult.issues.length) {
							if (def.mode === "loose") payload.value[key] = input[key];
							else payload.issues.push({
								code: "invalid_key",
								origin: "record",
								issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
								input: key,
								path: [key],
								inst
							});
							continue;
						}
						const result = def.valueType._zod.run({
							value: input[key],
							issues: []
						}, ctx);
						if (result instanceof Promise) proms.push(result.then((result) => {
							if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
							payload.value[keyResult.value] = result.value;
						}));
						else {
							if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
							payload.value[keyResult.value] = result.value;
						}
					}
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
		});
		const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
			$ZodType.init(inst, def);
			const values = getEnumValues(def.entries);
			const valuesSet = new Set(values);
			inst._zod.values = valuesSet;
			inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (valuesSet.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
			$ZodType.init(inst, def);
			if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
			const values = new Set(def.values);
			inst._zod.values = values;
			inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (values.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values: def.values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				const _out = def.transform(payload.value, payload);
				if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				if (_out instanceof Promise) throw new $ZodAsyncError();
				payload.value = _out;
				payload.fallback = true;
				return payload;
			};
		});
		function handleOptionalResult(result, input) {
			if (input === void 0 && (result.issues.length || result.fallback)) return {
				issues: [],
				value: void 0
			};
			return result;
		}
		const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.optout = "optional";
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
			});
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (def.innerType._zod.optin === "optional") {
					const input = payload.value;
					const result = def.innerType._zod.run(payload, ctx);
					if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
					return handleOptionalResult(result, input);
				}
				if (payload.value === void 0) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
			inst._zod.parse = (payload, ctx) => {
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
			});
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === null) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) {
					payload.value = def.defaultValue;
					/**
					* $ZodDefault returns the default value immediately in forward direction.
					* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
					return payload;
				}
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
				return handleDefaultResult(result, def);
			};
		});
		function handleDefaultResult(payload, def) {
			if (payload.value === void 0) payload.value = def.defaultValue;
			return payload;
		}
		const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) payload.value = def.defaultValue;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => {
				const v = def.innerType._zod.values;
				return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
				return handleNonOptionalResult(result, inst);
			};
		});
		function handleNonOptionalResult(payload, inst) {
			if (!payload.issues.length && payload.value === void 0) payload.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: payload.value,
				inst
			});
			return payload;
		}
		const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => {
					payload.value = result.value;
					if (result.issues.length) {
						payload.value = def.catchValue({
							...payload,
							error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
							input: payload.value
						});
						payload.issues = [];
						payload.fallback = true;
					}
					return payload;
				});
				payload.value = result.value;
				if (result.issues.length) {
					payload.value = def.catchValue({
						...payload,
						error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
						input: payload.value
					});
					payload.issues = [];
					payload.fallback = true;
				}
				return payload;
			};
		});
		const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => def.in._zod.values);
			defineLazy(inst._zod, "optin", () => def.in._zod.optin);
			defineLazy(inst._zod, "optout", () => def.out._zod.optout);
			defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") {
					const right = def.out._zod.run(payload, ctx);
					if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
					return handlePipeResult(right, def.in, ctx);
				}
				const left = def.in._zod.run(payload, ctx);
				if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
				return handlePipeResult(left, def.out, ctx);
			};
		});
		function handlePipeResult(left, next, ctx) {
			if (left.issues.length) {
				left.aborted = true;
				return left;
			}
			return next._zod.run({
				value: left.value,
				issues: left.issues,
				fallback: left.fallback
			}, ctx);
		}
		const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
			defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then(handleReadonlyResult);
				return handleReadonlyResult(result);
			};
		});
		function handleReadonlyResult(payload) {
			payload.value = Object.freeze(payload.value);
			return payload;
		}
		const $ZodLazy = /*@__PURE__*/ $constructor("$ZodLazy", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "innerType", () => {
				const d = def;
				if (!d._cachedInner) d._cachedInner = def.getter();
				return d._cachedInner;
			});
			defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
			defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
			defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? void 0);
			defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? void 0);
			inst._zod.parse = (payload, ctx) => {
				return inst._zod.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
			$ZodCheck.init(inst, def);
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _) => {
				return payload;
			};
			inst._zod.check = (payload) => {
				const input = payload.value;
				const r = def.fn(input);
				if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
				handleRefineResult(r, payload, input, inst);
			};
		});
		function handleRefineResult(result, payload, input, inst) {
			if (!result) {
				const _iss = {
					code: "custom",
					input,
					inst,
					path: [...inst._zod.def.path ?? []],
					continue: !inst._zod.def.abort
				};
				if (inst._zod.def.params) _iss.params = inst._zod.def.params;
				payload.issues.push(issue(_iss));
			}
		}
		//#endregion
		//#region ../../node_modules/zod/v4/core/registries.js
		var _a;
		var $ZodRegistry = class {
			constructor() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
			}
			add(schema, ..._meta) {
				const meta = _meta[0];
				this._map.set(schema, meta);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
				return this;
			}
			clear() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
				return this;
			}
			remove(schema) {
				const meta = this._map.get(schema);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
				this._map.delete(schema);
				return this;
			}
			get(schema) {
				const p = schema._zod.parent;
				if (p) {
					const pm = { ...this.get(p) ?? {} };
					delete pm.id;
					const f = {
						...pm,
						...this._map.get(schema)
					};
					return Object.keys(f).length ? f : void 0;
				}
				return this._map.get(schema);
			}
			has(schema) {
				return this._map.has(schema);
			}
		};
		function registry() {
			return new $ZodRegistry();
		}
		(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
		const globalRegistry = globalThis.__zod_globalRegistry;
		//#endregion
		//#region ../../node_modules/zod/v4/core/api.js
		// @__NO_SIDE_EFFECTS__
		function _string(Class, params) {
			return new Class({
				type: "string",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _email(Class, params) {
			return new Class({
				type: "string",
				format: "email",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _guid(Class, params) {
			return new Class({
				type: "string",
				format: "guid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuid(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv4(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v4",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv6(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v6",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv7(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v7",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _url(Class, params) {
			return new Class({
				type: "string",
				format: "url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _emoji(Class, params) {
			return new Class({
				type: "string",
				format: "emoji",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _nanoid(Class, params) {
			return new Class({
				type: "string",
				format: "nanoid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link _cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		// @__NO_SIDE_EFFECTS__
		function _cuid(Class, params) {
			return new Class({
				type: "string",
				format: "cuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cuid2(Class, params) {
			return new Class({
				type: "string",
				format: "cuid2",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ulid(Class, params) {
			return new Class({
				type: "string",
				format: "ulid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _xid(Class, params) {
			return new Class({
				type: "string",
				format: "xid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ksuid(Class, params) {
			return new Class({
				type: "string",
				format: "ksuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv4(Class, params) {
			return new Class({
				type: "string",
				format: "ipv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv6(Class, params) {
			return new Class({
				type: "string",
				format: "ipv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv4(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv6(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64(Class, params) {
			return new Class({
				type: "string",
				format: "base64",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64url(Class, params) {
			return new Class({
				type: "string",
				format: "base64url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _e164(Class, params) {
			return new Class({
				type: "string",
				format: "e164",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _jwt(Class, params) {
			return new Class({
				type: "string",
				format: "jwt",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDateTime(Class, params) {
			return new Class({
				type: "string",
				format: "datetime",
				check: "string_format",
				offset: false,
				local: false,
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDate(Class, params) {
			return new Class({
				type: "string",
				format: "date",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoTime(Class, params) {
			return new Class({
				type: "string",
				format: "time",
				check: "string_format",
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDuration(Class, params) {
			return new Class({
				type: "string",
				format: "duration",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _number(Class, params) {
			return new Class({
				type: "number",
				checks: [],
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _int(Class, params) {
			return new Class({
				type: "number",
				check: "number_format",
				abort: false,
				format: "safeint",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _boolean(Class, params) {
			return new Class({
				type: "boolean",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _undefined$1(Class, params) {
			return new Class({
				type: "undefined",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _unknown(Class) {
			return new Class({ type: "unknown" });
		}
		// @__NO_SIDE_EFFECTS__
		function _never(Class, params) {
			return new Class({
				type: "never",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _void$1(Class, params) {
			return new Class({
				type: "void",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lt(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lte(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gt(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gte(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _multipleOf(value, params) {
			return new $ZodCheckMultipleOf({
				check: "multiple_of",
				...normalizeParams(params),
				value
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _maxLength(maximum, params) {
			return new $ZodCheckMaxLength({
				check: "max_length",
				...normalizeParams(params),
				maximum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _minLength(minimum, params) {
			return new $ZodCheckMinLength({
				check: "min_length",
				...normalizeParams(params),
				minimum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _length(length, params) {
			return new $ZodCheckLengthEquals({
				check: "length_equals",
				...normalizeParams(params),
				length
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _regex(pattern, params) {
			return new $ZodCheckRegex({
				check: "string_format",
				format: "regex",
				...normalizeParams(params),
				pattern
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lowercase(params) {
			return new $ZodCheckLowerCase({
				check: "string_format",
				format: "lowercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uppercase(params) {
			return new $ZodCheckUpperCase({
				check: "string_format",
				format: "uppercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _includes(includes, params) {
			return new $ZodCheckIncludes({
				check: "string_format",
				format: "includes",
				...normalizeParams(params),
				includes
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _startsWith(prefix, params) {
			return new $ZodCheckStartsWith({
				check: "string_format",
				format: "starts_with",
				...normalizeParams(params),
				prefix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _endsWith(suffix, params) {
			return new $ZodCheckEndsWith({
				check: "string_format",
				format: "ends_with",
				...normalizeParams(params),
				suffix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _overwrite(tx) {
			return new $ZodCheckOverwrite({
				check: "overwrite",
				tx
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _normalize(form) {
			return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
		}
		// @__NO_SIDE_EFFECTS__
		function _trim() {
			return /* @__PURE__ */ _overwrite((input) => input.trim());
		}
		// @__NO_SIDE_EFFECTS__
		function _toLowerCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _toUpperCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _slugify() {
			return /* @__PURE__ */ _overwrite((input) => slugify(input));
		}
		// @__NO_SIDE_EFFECTS__
		function _array(Class, element, params) {
			return new Class({
				type: "array",
				element,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _refine(Class, fn, _params) {
			return new Class({
				type: "custom",
				check: "custom",
				fn,
				...normalizeParams(_params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _superRefine(fn, params) {
			const ch = /* @__PURE__ */ _check((payload) => {
				payload.addIssue = (issue$2) => {
					if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
					else {
						const _issue = issue$2;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = ch);
						_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
						payload.issues.push(issue(_issue));
					}
				};
				return fn(payload.value, payload);
			}, params);
			return ch;
		}
		// @__NO_SIDE_EFFECTS__
		function _check(fn, params) {
			const ch = new $ZodCheck({
				check: "custom",
				...normalizeParams(params)
			});
			ch._zod.check = fn;
			return ch;
		}
		//#endregion
		//#region ../../node_modules/zod/v4/core/to-json-schema.js
		function initializeContext(params) {
			let target = params?.target ?? "draft-2020-12";
			if (target === "draft-4") target = "draft-04";
			if (target === "draft-7") target = "draft-07";
			return {
				processors: params.processors ?? {},
				metadataRegistry: params?.metadata ?? globalRegistry,
				target,
				unrepresentable: params?.unrepresentable ?? "throw",
				override: params?.override ?? (() => {}),
				io: params?.io ?? "output",
				counter: 0,
				seen: /* @__PURE__ */ new Map(),
				cycles: params?.cycles ?? "ref",
				reused: params?.reused ?? "inline",
				external: params?.external ?? void 0
			};
		}
		function process(schema, ctx, _params = {
			path: [],
			schemaPath: []
		}) {
			var _a;
			const def = schema._zod.def;
			const seen = ctx.seen.get(schema);
			if (seen) {
				seen.count++;
				if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
				return seen.schema;
			}
			const result = {
				schema: {},
				count: 1,
				cycle: void 0,
				path: _params.path
			};
			ctx.seen.set(schema, result);
			const overrideSchema = schema._zod.toJSONSchema?.();
			if (overrideSchema) result.schema = overrideSchema;
			else {
				const params = {
					..._params,
					schemaPath: [..._params.schemaPath, schema],
					path: _params.path
				};
				if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
				else {
					const _json = result.schema;
					const processor = ctx.processors[def.type];
					if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
					processor(schema, ctx, _json, params);
				}
				const parent = schema._zod.parent;
				if (parent) {
					if (!result.ref) result.ref = parent;
					process(parent, ctx, params);
					ctx.seen.get(parent).isParent = true;
				}
			}
			const meta = ctx.metadataRegistry.get(schema);
			if (meta) Object.assign(result.schema, meta);
			if (ctx.io === "input" && isTransforming(schema)) {
				delete result.schema.examples;
				delete result.schema.default;
			}
			if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
			delete result.schema._prefault;
			return ctx.seen.get(schema).schema;
		}
		function extractDefs(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const idToSchema = /* @__PURE__ */ new Map();
			for (const entry of ctx.seen.entries()) {
				const id = ctx.metadataRegistry.get(entry[0])?.id;
				if (id) {
					const existing = idToSchema.get(id);
					if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
					idToSchema.set(id, entry[0]);
				}
			}
			const makeURI = (entry) => {
				const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
				if (ctx.external) {
					const externalId = ctx.external.registry.get(entry[0])?.id;
					const uriGenerator = ctx.external.uri ?? ((id) => id);
					if (externalId) return { ref: uriGenerator(externalId) };
					const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
					entry[1].defId = id;
					return {
						defId: id,
						ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
					};
				}
				if (entry[1] === root) return { ref: "#" };
				const defUriPrefix = `#/${defsSegment}/`;
				const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
				return {
					defId,
					ref: defUriPrefix + defId
				};
			};
			const extractToDef = (entry) => {
				if (entry[1].schema.$ref) return;
				const seen = entry[1];
				const { ref, defId } = makeURI(entry);
				seen.def = { ...seen.schema };
				if (defId) seen.defId = defId;
				const schema = seen.schema;
				for (const key in schema) delete schema[key];
				schema.$ref = ref;
			};
			if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
			}
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (schema === entry[0]) {
					extractToDef(entry);
					continue;
				}
				if (ctx.external) {
					const ext = ctx.external.registry.get(entry[0])?.id;
					if (schema !== entry[0] && ext) {
						extractToDef(entry);
						continue;
					}
				}
				if (ctx.metadataRegistry.get(entry[0])?.id) {
					extractToDef(entry);
					continue;
				}
				if (seen.cycle) {
					extractToDef(entry);
					continue;
				}
				if (seen.count > 1) {
					if (ctx.reused === "ref") {
						extractToDef(entry);
						continue;
					}
				}
			}
		}
		function finalize(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const flattenRef = (zodSchema) => {
				const seen = ctx.seen.get(zodSchema);
				if (seen.ref === null) return;
				const schema = seen.def ?? seen.schema;
				const _cached = { ...schema };
				const ref = seen.ref;
				seen.ref = null;
				if (ref) {
					flattenRef(ref);
					const refSeen = ctx.seen.get(ref);
					const refSchema = refSeen.schema;
					if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
						schema.allOf = schema.allOf ?? [];
						schema.allOf.push(refSchema);
					} else Object.assign(schema, refSchema);
					Object.assign(schema, _cached);
					if (zodSchema._zod.parent === ref) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (!(key in _cached)) delete schema[key];
					}
					if (refSchema.$ref && refSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
					}
				}
				const parent = zodSchema._zod.parent;
				if (parent && parent !== ref) {
					flattenRef(parent);
					const parentSeen = ctx.seen.get(parent);
					if (parentSeen?.schema.$ref) {
						schema.$ref = parentSeen.schema.$ref;
						if (parentSeen.def) for (const key in schema) {
							if (key === "$ref" || key === "allOf") continue;
							if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
						}
					}
				}
				ctx.override({
					zodSchema,
					jsonSchema: schema,
					path: seen.path ?? []
				});
			};
			for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
			const result = {};
			if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
			else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
			else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
			else if (ctx.target === "openapi-3.0") {}
			if (ctx.external?.uri) {
				const id = ctx.external.registry.get(schema)?.id;
				if (!id) throw new Error("Schema is missing an `id` property");
				result.$id = ctx.external.uri(id);
			}
			Object.assign(result, root.def ?? root.schema);
			const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
			if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
			const defs = ctx.external?.defs ?? {};
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.def && seen.defId) {
					if (seen.def.id === seen.defId) delete seen.def.id;
					defs[seen.defId] = seen.def;
				}
			}
			if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
			else result.definitions = defs;
			try {
				const finalized = JSON.parse(JSON.stringify(result));
				Object.defineProperty(finalized, "~standard", {
					value: {
						...schema["~standard"],
						jsonSchema: {
							input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
							output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
						}
					},
					enumerable: false,
					writable: false
				});
				return finalized;
			} catch (_err) {
				throw new Error("Error converting schema to JSON.");
			}
		}
		function isTransforming(_schema, _ctx) {
			const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
			if (ctx.seen.has(_schema)) return false;
			ctx.seen.add(_schema);
			const def = _schema._zod.def;
			if (def.type === "transform") return true;
			if (def.type === "array") return isTransforming(def.element, ctx);
			if (def.type === "set") return isTransforming(def.valueType, ctx);
			if (def.type === "lazy") return isTransforming(def.getter(), ctx);
			if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
			if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
			if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
			if (def.type === "pipe") {
				if (_schema._zod.traits.has("$ZodCodec")) return true;
				return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
			}
			if (def.type === "object") {
				for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
				return false;
			}
			if (def.type === "union") {
				for (const option of def.options) if (isTransforming(option, ctx)) return true;
				return false;
			}
			if (def.type === "tuple") {
				for (const item of def.items) if (isTransforming(item, ctx)) return true;
				if (def.rest && isTransforming(def.rest, ctx)) return true;
				return false;
			}
			return false;
		}
		/**
		* Creates a toJSONSchema method for a schema instance.
		* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
		*/
		const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
			const ctx = initializeContext({
				...params,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
			const { libraryOptions, target } = params ?? {};
			const ctx = initializeContext({
				...libraryOptions ?? {},
				target,
				io,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		//#endregion
		//#region ../../node_modules/zod/v4/core/json-schema-processors.js
		const formatMap = {
			guid: "uuid",
			url: "uri",
			datetime: "date-time",
			json_string: "json-string",
			regex: ""
		};
		const stringProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			json.type = "string";
			const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
			if (typeof minimum === "number") json.minLength = minimum;
			if (typeof maximum === "number") json.maxLength = maximum;
			if (format) {
				json.format = formatMap[format] ?? format;
				if (json.format === "") delete json.format;
				if (format === "time") delete json.format;
			}
			if (contentEncoding) json.contentEncoding = contentEncoding;
			if (patterns && patterns.size > 0) {
				const regexes = [...patterns];
				if (regexes.length === 1) json.pattern = regexes[0].source;
				else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
					...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
					pattern: regex.source
				}))];
			}
		};
		const numberProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
			if (typeof format === "string" && format.includes("int")) json.type = "integer";
			else json.type = "number";
			const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
			const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
			const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
			if (exMin) if (legacy) {
				json.minimum = exclusiveMinimum;
				json.exclusiveMinimum = true;
			} else json.exclusiveMinimum = exclusiveMinimum;
			else if (typeof minimum === "number") json.minimum = minimum;
			if (exMax) if (legacy) {
				json.maximum = exclusiveMaximum;
				json.exclusiveMaximum = true;
			} else json.exclusiveMaximum = exclusiveMaximum;
			else if (typeof maximum === "number") json.maximum = maximum;
			if (typeof multipleOf === "number") json.multipleOf = multipleOf;
		};
		const booleanProcessor = (_schema, _ctx, json, _params) => {
			json.type = "boolean";
		};
		const undefinedProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Undefined cannot be represented in JSON Schema");
		};
		const voidProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Void cannot be represented in JSON Schema");
		};
		const neverProcessor = (_schema, _ctx, json, _params) => {
			json.not = {};
		};
		const enumProcessor = (schema, _ctx, json, _params) => {
			const def = schema._zod.def;
			const values = getEnumValues(def.entries);
			if (values.every((v) => typeof v === "number")) json.type = "number";
			if (values.every((v) => typeof v === "string")) json.type = "string";
			json.enum = values;
		};
		const literalProcessor = (schema, ctx, json, _params) => {
			const def = schema._zod.def;
			const vals = [];
			for (const val of def.values) if (val === void 0) {
				if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
			} else if (typeof val === "bigint") if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
			else vals.push(Number(val));
			else vals.push(val);
			if (vals.length === 0) {} else if (vals.length === 1) {
				const val = vals[0];
				json.type = val === null ? "null" : typeof val;
				if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
				else json.const = val;
			} else {
				if (vals.every((v) => typeof v === "number")) json.type = "number";
				if (vals.every((v) => typeof v === "string")) json.type = "string";
				if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
				if (vals.every((v) => v === null)) json.type = "null";
				json.enum = vals;
			}
		};
		const customProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
		};
		const transformProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
		};
		const arrayProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const { minimum, maximum } = schema._zod.bag;
			if (typeof minimum === "number") json.minItems = minimum;
			if (typeof maximum === "number") json.maxItems = maximum;
			json.type = "array";
			json.items = process(def.element, ctx, {
				...params,
				path: [...params.path, "items"]
			});
		};
		const objectProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			json.type = "object";
			json.properties = {};
			const shape = def.shape;
			for (const key in shape) json.properties[key] = process(shape[key], ctx, {
				...params,
				path: [
					...params.path,
					"properties",
					key
				]
			});
			const allKeys = new Set(Object.keys(shape));
			const requiredKeys = new Set([...allKeys].filter((key) => {
				const v = def.shape[key]._zod;
				if (ctx.io === "input") return v.optin === void 0;
				else return v.optout === void 0;
			}));
			if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
			if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
			else if (!def.catchall) {
				if (ctx.io === "output") json.additionalProperties = false;
			} else if (def.catchall) json.additionalProperties = process(def.catchall, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		};
		const unionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const isExclusive = def.inclusive === false;
			const options = def.options.map((x, i) => process(x, ctx, {
				...params,
				path: [
					...params.path,
					isExclusive ? "oneOf" : "anyOf",
					i
				]
			}));
			if (isExclusive) json.oneOf = options;
			else json.anyOf = options;
		};
		const intersectionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const a = process(def.left, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					0
				]
			});
			const b = process(def.right, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					1
				]
			});
			const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
			json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
		};
		const recordProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			json.type = "object";
			const keyType = def.keyType;
			const patterns = keyType._zod.bag?.patterns;
			if (def.mode === "loose" && patterns && patterns.size > 0) {
				const valueSchema = process(def.valueType, ctx, {
					...params,
					path: [
						...params.path,
						"patternProperties",
						"*"
					]
				});
				json.patternProperties = {};
				for (const pattern of patterns) json.patternProperties[pattern.source] = valueSchema;
			} else {
				if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") json.propertyNames = process(def.keyType, ctx, {
					...params,
					path: [...params.path, "propertyNames"]
				});
				json.additionalProperties = process(def.valueType, ctx, {
					...params,
					path: [...params.path, "additionalProperties"]
				});
			}
			const keyValues = keyType._zod.values;
			if (keyValues) {
				const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
				if (validKeyValues.length > 0) json.required = validKeyValues;
			}
		};
		const nullableProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const inner = process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			if (ctx.target === "openapi-3.0") {
				seen.ref = def.innerType;
				json.nullable = true;
			} else json.anyOf = [inner, { type: "null" }];
		};
		const nonoptionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		const defaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.default = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const prefaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const catchProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			let catchValue;
			try {
				catchValue = def.catchValue(void 0);
			} catch {
				throw new Error("Dynamic catch values are not supported in JSON Schema");
			}
			json.default = catchValue;
		};
		const pipeProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			const inIsTransform = def.in._zod.traits.has("$ZodTransform");
			const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
			process(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const readonlyProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.readOnly = true;
		};
		const optionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		const lazyProcessor = (schema, ctx, _json, params) => {
			const innerType = schema._zod.innerType;
			process(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		//#endregion
		//#region ../../node_modules/zod/v4/classic/iso.js
		const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
			$ZodISODateTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function datetime(params) {
			return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
		}
		const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
			$ZodISODate.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function date(params) {
			return /* @__PURE__ */ _isoDate(ZodISODate, params);
		}
		const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
			$ZodISOTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function time(params) {
			return /* @__PURE__ */ _isoTime(ZodISOTime, params);
		}
		const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
			$ZodISODuration.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function duration(params) {
			return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
		}
		//#endregion
		//#region ../../node_modules/zod/v4/classic/errors.js
		const initializer = (inst, issues) => {
			$ZodError.init(inst, issues);
			inst.name = "ZodError";
			Object.defineProperties(inst, {
				format: { value: (mapper) => formatError(inst, mapper) },
				flatten: { value: (mapper) => flattenError(inst, mapper) },
				addIssue: { value: (issue) => {
					inst.issues.push(issue);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				addIssues: { value: (issues) => {
					inst.issues.push(...issues);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				isEmpty: { get() {
					return inst.issues.length === 0;
				} }
			});
		};
		const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
		//#endregion
		//#region ../../node_modules/zod/v4/classic/parse.js
		const parse = /* @__PURE__ */ _parse(ZodRealError);
		const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
		const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
		const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
		const encode = /* @__PURE__ */ _encode(ZodRealError);
		const decode = /* @__PURE__ */ _decode(ZodRealError);
		const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
		const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
		const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
		const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
		const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
		const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
		//#endregion
		//#region ../../node_modules/zod/v4/classic/schemas.js
		const _installedGroups = /* @__PURE__ */ new WeakMap();
		function _installLazyMethods(inst, group, methods) {
			const proto = Object.getPrototypeOf(inst);
			let installed = _installedGroups.get(proto);
			if (!installed) {
				installed = /* @__PURE__ */ new Set();
				_installedGroups.set(proto, installed);
			}
			if (installed.has(group)) return;
			installed.add(group);
			for (const key in methods) {
				const fn = methods[key];
				Object.defineProperty(proto, key, {
					configurable: true,
					enumerable: false,
					get() {
						const bound = fn.bind(this);
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: bound
						});
						return bound;
					},
					set(v) {
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: v
						});
					}
				});
			}
		}
		const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
			$ZodType.init(inst, def);
			Object.assign(inst["~standard"], { jsonSchema: {
				input: createStandardJSONSchemaMethod(inst, "input"),
				output: createStandardJSONSchemaMethod(inst, "output")
			} });
			inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
			inst.def = def;
			inst.type = def.type;
			Object.defineProperty(inst, "_def", { value: def });
			inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
			inst.safeParse = (data, params) => safeParse(inst, data, params);
			inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
			inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
			inst.spa = inst.safeParseAsync;
			inst.encode = (data, params) => encode(inst, data, params);
			inst.decode = (data, params) => decode(inst, data, params);
			inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
			inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
			inst.safeEncode = (data, params) => safeEncode(inst, data, params);
			inst.safeDecode = (data, params) => safeDecode(inst, data, params);
			inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
			inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
			_installLazyMethods(inst, "ZodType", {
				check(...chks) {
					const def = this.def;
					return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
						check: ch,
						def: { check: "custom" },
						onattach: []
					} } : ch)] }), { parent: true });
				},
				with(...chks) {
					return this.check(...chks);
				},
				clone(def, params) {
					return clone(this, def, params);
				},
				brand() {
					return this;
				},
				register(reg, meta) {
					reg.add(this, meta);
					return this;
				},
				refine(check, params) {
					return this.check(refine(check, params));
				},
				superRefine(refinement, params) {
					return this.check(superRefine(refinement, params));
				},
				overwrite(fn) {
					return this.check(/* @__PURE__ */ _overwrite(fn));
				},
				optional() {
					return optional(this);
				},
				exactOptional() {
					return exactOptional(this);
				},
				nullable() {
					return nullable(this);
				},
				nullish() {
					return optional(nullable(this));
				},
				nonoptional(params) {
					return nonoptional(this, params);
				},
				array() {
					return array(this);
				},
				or(arg) {
					return union([this, arg]);
				},
				and(arg) {
					return intersection(this, arg);
				},
				transform(tx) {
					return pipe(this, transform(tx));
				},
				default(d) {
					return _default(this, d);
				},
				prefault(d) {
					return prefault(this, d);
				},
				catch(params) {
					return _catch(this, params);
				},
				pipe(target) {
					return pipe(this, target);
				},
				readonly() {
					return readonly(this);
				},
				describe(description) {
					const cl = this.clone();
					globalRegistry.add(cl, { description });
					return cl;
				},
				meta(...args) {
					if (args.length === 0) return globalRegistry.get(this);
					const cl = this.clone();
					globalRegistry.add(cl, args[0]);
					return cl;
				},
				isOptional() {
					return this.safeParse(void 0).success;
				},
				isNullable() {
					return this.safeParse(null).success;
				},
				apply(fn) {
					return fn(this);
				}
			});
			Object.defineProperty(inst, "description", {
				get() {
					return globalRegistry.get(inst)?.description;
				},
				configurable: true
			});
			return inst;
		});
		/** @internal */
		const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
			const bag = inst._zod.bag;
			inst.format = bag.format ?? null;
			inst.minLength = bag.minimum ?? null;
			inst.maxLength = bag.maximum ?? null;
			_installLazyMethods(inst, "_ZodString", {
				regex(...args) {
					return this.check(/* @__PURE__ */ _regex(...args));
				},
				includes(...args) {
					return this.check(/* @__PURE__ */ _includes(...args));
				},
				startsWith(...args) {
					return this.check(/* @__PURE__ */ _startsWith(...args));
				},
				endsWith(...args) {
					return this.check(/* @__PURE__ */ _endsWith(...args));
				},
				min(...args) {
					return this.check(/* @__PURE__ */ _minLength(...args));
				},
				max(...args) {
					return this.check(/* @__PURE__ */ _maxLength(...args));
				},
				length(...args) {
					return this.check(/* @__PURE__ */ _length(...args));
				},
				nonempty(...args) {
					return this.check(/* @__PURE__ */ _minLength(1, ...args));
				},
				lowercase(params) {
					return this.check(/* @__PURE__ */ _lowercase(params));
				},
				uppercase(params) {
					return this.check(/* @__PURE__ */ _uppercase(params));
				},
				trim() {
					return this.check(/* @__PURE__ */ _trim());
				},
				normalize(...args) {
					return this.check(/* @__PURE__ */ _normalize(...args));
				},
				toLowerCase() {
					return this.check(/* @__PURE__ */ _toLowerCase());
				},
				toUpperCase() {
					return this.check(/* @__PURE__ */ _toUpperCase());
				},
				slugify() {
					return this.check(/* @__PURE__ */ _slugify());
				}
			});
		});
		const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			_ZodString.init(inst, def);
			inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
			inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
			inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
			inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
			inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
			inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
			inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
			inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
			inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
			inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
			inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
			inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
			inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
			inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
			inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
			inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
			inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
			inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
			inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
			inst.datetime = (params) => inst.check(datetime(params));
			inst.date = (params) => inst.check(date(params));
			inst.time = (params) => inst.check(time(params));
			inst.duration = (params) => inst.check(duration(params));
		});
		function string(params) {
			return /* @__PURE__ */ _string(ZodString, params);
		}
		const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			_ZodString.init(inst, def);
		});
		const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
			$ZodEmail.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
			$ZodGUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
			$ZodUUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
			$ZodURL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
			$ZodEmoji.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
			$ZodNanoID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
			$ZodCUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
			$ZodCUID2.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
			$ZodULID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
			$ZodXID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
			$ZodKSUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
			$ZodIPv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
			$ZodIPv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
			$ZodCIDRv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
			$ZodCIDRv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
			$ZodBase64.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
			$ZodBase64URL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
			$ZodE164.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
			$ZodJWT.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
			$ZodNumber.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
			_installLazyMethods(inst, "ZodNumber", {
				gt(value, params) {
					return this.check(/* @__PURE__ */ _gt(value, params));
				},
				gte(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				min(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				lt(value, params) {
					return this.check(/* @__PURE__ */ _lt(value, params));
				},
				lte(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				max(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				int(params) {
					return this.check(int(params));
				},
				safe(params) {
					return this.check(int(params));
				},
				positive(params) {
					return this.check(/* @__PURE__ */ _gt(0, params));
				},
				nonnegative(params) {
					return this.check(/* @__PURE__ */ _gte(0, params));
				},
				negative(params) {
					return this.check(/* @__PURE__ */ _lt(0, params));
				},
				nonpositive(params) {
					return this.check(/* @__PURE__ */ _lte(0, params));
				},
				multipleOf(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				step(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				finite() {
					return this;
				}
			});
			const bag = inst._zod.bag;
			inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
			inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
			inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
			inst.isFinite = true;
			inst.format = bag.format ?? null;
		});
		function number(params) {
			return /* @__PURE__ */ _number(ZodNumber, params);
		}
		const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
			$ZodNumberFormat.init(inst, def);
			ZodNumber.init(inst, def);
		});
		function int(params) {
			return /* @__PURE__ */ _int(ZodNumberFormat, params);
		}
		const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
			$ZodBoolean.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
		});
		function boolean(params) {
			return /* @__PURE__ */ _boolean(ZodBoolean, params);
		}
		const ZodUndefined = /*@__PURE__*/ $constructor("ZodUndefined", (inst, def) => {
			$ZodUndefined.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => undefinedProcessor(inst, ctx, json, params);
		});
		function _undefined(params) {
			return /* @__PURE__ */ _undefined$1(ZodUndefined, params);
		}
		const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
			$ZodUnknown.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => void 0;
		});
		function unknown() {
			return /* @__PURE__ */ _unknown(ZodUnknown);
		}
		const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
			$ZodNever.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
		});
		function never(params) {
			return /* @__PURE__ */ _never(ZodNever, params);
		}
		const ZodVoid = /*@__PURE__*/ $constructor("ZodVoid", (inst, def) => {
			$ZodVoid.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => voidProcessor(inst, ctx, json, params);
		});
		function _void(params) {
			return /* @__PURE__ */ _void$1(ZodVoid, params);
		}
		const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
			$ZodArray.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
			inst.element = def.element;
			_installLazyMethods(inst, "ZodArray", {
				min(n, params) {
					return this.check(/* @__PURE__ */ _minLength(n, params));
				},
				nonempty(params) {
					return this.check(/* @__PURE__ */ _minLength(1, params));
				},
				max(n, params) {
					return this.check(/* @__PURE__ */ _maxLength(n, params));
				},
				length(n, params) {
					return this.check(/* @__PURE__ */ _length(n, params));
				},
				unwrap() {
					return this.element;
				}
			});
		});
		function array(element, params) {
			return /* @__PURE__ */ _array(ZodArray, element, params);
		}
		const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
			$ZodObjectJIT.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
			defineLazy(inst, "shape", () => {
				return def.shape;
			});
			_installLazyMethods(inst, "ZodObject", {
				keyof() {
					return _enum(Object.keys(this._zod.def.shape));
				},
				catchall(catchall) {
					return this.clone({
						...this._zod.def,
						catchall
					});
				},
				passthrough() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				loose() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				strict() {
					return this.clone({
						...this._zod.def,
						catchall: never()
					});
				},
				strip() {
					return this.clone({
						...this._zod.def,
						catchall: void 0
					});
				},
				extend(incoming) {
					return extend(this, incoming);
				},
				safeExtend(incoming) {
					return safeExtend(this, incoming);
				},
				merge(other) {
					return merge(this, other);
				},
				pick(mask) {
					return pick(this, mask);
				},
				omit(mask) {
					return omit(this, mask);
				},
				partial(...args) {
					return partial(ZodOptional, this, args[0]);
				},
				required(...args) {
					return required(ZodNonOptional, this, args[0]);
				}
			});
		});
		function object(shape, params) {
			const def = {
				type: "object",
				shape: shape ?? {},
				...normalizeParams(params)
			};
			return new ZodObject(def);
		}
		const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
			$ZodUnion.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
			inst.options = def.options;
		});
		function union(options, params) {
			return new ZodUnion({
				type: "union",
				options,
				...normalizeParams(params)
			});
		}
		const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
			$ZodIntersection.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
		});
		function intersection(left, right) {
			return new ZodIntersection({
				type: "intersection",
				left,
				right
			});
		}
		const ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
			$ZodRecord.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
			inst.keyType = def.keyType;
			inst.valueType = def.valueType;
		});
		function record(keyType, valueType, params) {
			if (!valueType || !valueType._zod) return new ZodRecord({
				type: "record",
				keyType: string(),
				valueType: keyType,
				...normalizeParams(valueType)
			});
			return new ZodRecord({
				type: "record",
				keyType,
				valueType,
				...normalizeParams(params)
			});
		}
		const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
			$ZodEnum.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
			inst.enum = def.entries;
			inst.options = Object.values(def.entries);
			const keys = new Set(Object.keys(def.entries));
			inst.extract = (values, params) => {
				const newEntries = {};
				for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
			inst.exclude = (values, params) => {
				const newEntries = { ...def.entries };
				for (const value of values) if (keys.has(value)) delete newEntries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
		});
		function _enum(values, params) {
			const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
			return new ZodEnum({
				type: "enum",
				entries,
				...normalizeParams(params)
			});
		}
		const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
			$ZodLiteral.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
			inst.values = new Set(def.values);
			Object.defineProperty(inst, "value", { get() {
				if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
				return def.values[0];
			} });
		});
		function literal(value, params) {
			return new ZodLiteral({
				type: "literal",
				values: Array.isArray(value) ? value : [value],
				...normalizeParams(params)
			});
		}
		const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
			$ZodTransform.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
			inst._zod.parse = (payload, _ctx) => {
				if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				payload.addIssue = (issue$1) => {
					if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
					else {
						const _issue = issue$1;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = inst);
						payload.issues.push(issue(_issue));
					}
				};
				const output = def.transform(payload.value, payload);
				if (output instanceof Promise) return output.then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				payload.value = output;
				payload.fallback = true;
				return payload;
			};
		});
		function transform(fn) {
			return new ZodTransform({
				type: "transform",
				transform: fn
			});
		}
		const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function optional(innerType) {
			return new ZodOptional({
				type: "optional",
				innerType
			});
		}
		const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
			$ZodExactOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function exactOptional(innerType) {
			return new ZodExactOptional({
				type: "optional",
				innerType
			});
		}
		const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
			$ZodNullable.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nullable(innerType) {
			return new ZodNullable({
				type: "nullable",
				innerType
			});
		}
		const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
			$ZodDefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeDefault = inst.unwrap;
		});
		function _default(innerType, defaultValue) {
			return new ZodDefault({
				type: "default",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
			$ZodPrefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function prefault(innerType, defaultValue) {
			return new ZodPrefault({
				type: "prefault",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
			$ZodNonOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nonoptional(innerType, params) {
			return new ZodNonOptional({
				type: "nonoptional",
				innerType,
				...normalizeParams(params)
			});
		}
		const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
			$ZodCatch.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeCatch = inst.unwrap;
		});
		function _catch(innerType, catchValue) {
			return new ZodCatch({
				type: "catch",
				innerType,
				catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
			});
		}
		const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
			$ZodPipe.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
			inst.in = def.in;
			inst.out = def.out;
		});
		function pipe(in_, out) {
			return new ZodPipe({
				type: "pipe",
				in: in_,
				out
			});
		}
		const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
			$ZodReadonly.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function readonly(innerType) {
			return new ZodReadonly({
				type: "readonly",
				innerType
			});
		}
		const ZodLazy = /*@__PURE__*/ $constructor("ZodLazy", (inst, def) => {
			$ZodLazy.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => lazyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.getter();
		});
		function lazy(getter) {
			return new ZodLazy({
				type: "lazy",
				getter
			});
		}
		const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
			$ZodCustom.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
		});
		function refine(fn, _params = {}) {
			return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
		}
		function superRefine(fn, params) {
			return /* @__PURE__ */ _superRefine(fn, params);
		}
		//#endregion
		//#region ../quantskills-host/lib/typert.remote-client.js
		const _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_result$schema = object({
			"version": object({
				"versionId": intersection(string(), unknown()).readonly(),
				"assetId": intersection(string(), unknown()).readonly(),
				"kind": union([literal("skill"), literal("agent")]).readonly(),
				"repository": string().readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
				"treeDigest": intersection(string(), unknown()).readonly(),
				"fileCount": number().readonly(),
				"totalBytes": number().readonly(),
				"installedAt": number().readonly(),
				"exposure": union([literal("skill-registry"), literal("agent-template")]).readonly(),
				"origin": union([literal("catalog"), literal("local-authoring")]).readonly(),
				"declarationTitleZh": string().readonly().optional()
			}).readonly(),
			"name": string().readonly(),
			"description": string().readonly(),
			"instructions": string().readonly(),
			"requires": array(intersection(string(), unknown())).readonly(),
			"promptForm": union([object({
				"status": literal("ready").readonly(),
				"form": object({
					"version": literal(1).readonly(),
					"task": object({
						"placeholder": string().readonly().optional(),
						"required": boolean().readonly().optional()
					}).readonly().optional(),
					"fields": array(object({
						"key": string().readonly(),
						"label": string().readonly(),
						"type": union([
							literal("number"),
							literal("text"),
							literal("textarea"),
							literal("select"),
							literal("date")
						]).readonly(),
						"required": boolean().readonly().optional(),
						"placeholder": string().readonly().optional(),
						"help": string().readonly().optional(),
						"default": union([string(), number()]).readonly().optional(),
						"options": array(object({
							"value": string().readonly(),
							"label": string().readonly()
						})).readonly().optional()
					})).readonly(),
					"promptTemplate": string().readonly()
				}).readonly(),
				"adaptations": array(object({
					"code": literal("number-default-string").readonly(),
					"fieldKey": string().readonly()
				})).readonly().optional()
			}), object({
				"status": literal("invalid").readonly(),
				"reason": string().readonly()
			})]).readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0$schema = object({ "source": union([literal("github"), literal("gitee")]).readonly() });
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_result$schema = object({
			"accepted": union([literal("started"), literal("reused")]).readonly(),
			"status": object({
				"state": union([
					literal("idle"),
					literal("checking"),
					literal("current"),
					literal("available"),
					literal("preparing"),
					literal("ready"),
					literal("blocked"),
					literal("failed")
				]).readonly(),
				"source": union([literal("github"), literal("gitee")]).readonly().optional(),
				"currentVersion": string().readonly().optional(),
				"currentCommit": string().readonly().optional(),
				"candidateVersion": string().readonly().optional(),
				"candidateCommit": string().readonly().optional(),
				"releaseNotes": array(string()).readonly().optional(),
				"phase": union([
					literal("fetching"),
					literal("installing"),
					literal("verifying")
				]).readonly().optional(),
				"checkedAt": number().readonly().optional(),
				"errorCode": union([
					literal("CATALOG_FETCH_FAILED"),
					literal("CATALOG_INVALID"),
					literal("CATALOG_STALE"),
					literal("ASSET_NOT_FOUND"),
					literal("ASSET_README_FETCH_FAILED"),
					literal("ASSET_README_NOT_FOUND"),
					literal("ASSET_README_INVALID"),
					literal("INSTALL_INVALID_TREE"),
					literal("INSTALL_LIMIT_EXCEEDED"),
					literal("INSTALL_GIT_FAILED"),
					literal("INSTALL_EXPOSURE_FAILED"),
					literal("INSTALL_RECORD_CORRUPT"),
					literal("INSTALL_WRITE_FAILED"),
					literal("INSTALLED_VERSION_NOT_FOUND"),
					literal("INSTALLED_VERSION_NOT_SKILL"),
					literal("INSTALLED_VERSION_NOT_AGENT"),
					literal("APPLICATION_UPDATE_CHECK_FAILED"),
					literal("APPLICATION_UPDATE_NOT_AVAILABLE"),
					literal("APPLICATION_UPDATE_DOWNLOAD_FAILED"),
					literal("APPLICATION_UPDATE_INSTALL_FAILED"),
					literal("APPLICATION_UPDATE_VERIFY_FAILED"),
					literal("APPLICATION_UPDATE_STATE_CORRUPT"),
					literal("APPLICATION_UPDATE_PATH_INVALID"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_DIRTY"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_REMOTE"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_BRANCH"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_AHEAD"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_DIVERGED")
				]).readonly().optional()
			}).readonly()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStart_result$schema = object({
			"accepted": union([literal("started"), literal("reused")]).readonly(),
			"status": object({
				"state": union([
					literal("idle"),
					literal("checking"),
					literal("current"),
					literal("available"),
					literal("preparing"),
					literal("ready"),
					literal("blocked"),
					literal("failed")
				]).readonly(),
				"source": union([literal("github"), literal("gitee")]).readonly().optional(),
				"currentVersion": string().readonly().optional(),
				"currentCommit": string().readonly().optional(),
				"candidateVersion": string().readonly().optional(),
				"candidateCommit": string().readonly().optional(),
				"releaseNotes": array(string()).readonly().optional(),
				"phase": union([
					literal("fetching"),
					literal("installing"),
					literal("verifying")
				]).readonly().optional(),
				"checkedAt": number().readonly().optional(),
				"errorCode": union([
					literal("CATALOG_FETCH_FAILED"),
					literal("CATALOG_INVALID"),
					literal("CATALOG_STALE"),
					literal("ASSET_NOT_FOUND"),
					literal("ASSET_README_FETCH_FAILED"),
					literal("ASSET_README_NOT_FOUND"),
					literal("ASSET_README_INVALID"),
					literal("INSTALL_INVALID_TREE"),
					literal("INSTALL_LIMIT_EXCEEDED"),
					literal("INSTALL_GIT_FAILED"),
					literal("INSTALL_EXPOSURE_FAILED"),
					literal("INSTALL_RECORD_CORRUPT"),
					literal("INSTALL_WRITE_FAILED"),
					literal("INSTALLED_VERSION_NOT_FOUND"),
					literal("INSTALLED_VERSION_NOT_SKILL"),
					literal("INSTALLED_VERSION_NOT_AGENT"),
					literal("APPLICATION_UPDATE_CHECK_FAILED"),
					literal("APPLICATION_UPDATE_NOT_AVAILABLE"),
					literal("APPLICATION_UPDATE_DOWNLOAD_FAILED"),
					literal("APPLICATION_UPDATE_INSTALL_FAILED"),
					literal("APPLICATION_UPDATE_VERIFY_FAILED"),
					literal("APPLICATION_UPDATE_STATE_CORRUPT"),
					literal("APPLICATION_UPDATE_PATH_INVALID"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_DIRTY"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_REMOTE"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_BRANCH"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_AHEAD"),
					literal("APPLICATION_UPDATE_DEVELOPMENT_DIVERGED")
				]).readonly().optional()
			}).readonly()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStatus_result$schema = object({
			"state": union([
				literal("idle"),
				literal("checking"),
				literal("current"),
				literal("available"),
				literal("preparing"),
				literal("ready"),
				literal("blocked"),
				literal("failed")
			]).readonly(),
			"source": union([literal("github"), literal("gitee")]).readonly().optional(),
			"currentVersion": string().readonly().optional(),
			"currentCommit": string().readonly().optional(),
			"candidateVersion": string().readonly().optional(),
			"candidateCommit": string().readonly().optional(),
			"releaseNotes": array(string()).readonly().optional(),
			"phase": union([
				literal("fetching"),
				literal("installing"),
				literal("verifying")
			]).readonly().optional(),
			"checkedAt": number().readonly().optional(),
			"errorCode": union([
				literal("CATALOG_FETCH_FAILED"),
				literal("CATALOG_INVALID"),
				literal("CATALOG_STALE"),
				literal("ASSET_NOT_FOUND"),
				literal("ASSET_README_FETCH_FAILED"),
				literal("ASSET_README_NOT_FOUND"),
				literal("ASSET_README_INVALID"),
				literal("INSTALL_INVALID_TREE"),
				literal("INSTALL_LIMIT_EXCEEDED"),
				literal("INSTALL_GIT_FAILED"),
				literal("INSTALL_EXPOSURE_FAILED"),
				literal("INSTALL_RECORD_CORRUPT"),
				literal("INSTALL_WRITE_FAILED"),
				literal("INSTALLED_VERSION_NOT_FOUND"),
				literal("INSTALLED_VERSION_NOT_SKILL"),
				literal("INSTALLED_VERSION_NOT_AGENT"),
				literal("APPLICATION_UPDATE_CHECK_FAILED"),
				literal("APPLICATION_UPDATE_NOT_AVAILABLE"),
				literal("APPLICATION_UPDATE_DOWNLOAD_FAILED"),
				literal("APPLICATION_UPDATE_INSTALL_FAILED"),
				literal("APPLICATION_UPDATE_VERIFY_FAILED"),
				literal("APPLICATION_UPDATE_STATE_CORRUPT"),
				literal("APPLICATION_UPDATE_PATH_INVALID"),
				literal("APPLICATION_UPDATE_DEVELOPMENT_DIRTY"),
				literal("APPLICATION_UPDATE_DEVELOPMENT_REMOTE"),
				literal("APPLICATION_UPDATE_DEVELOPMENT_BRANCH"),
				literal("APPLICATION_UPDATE_DEVELOPMENT_AHEAD"),
				literal("APPLICATION_UPDATE_DEVELOPMENT_DIVERGED")
			]).readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0$schema = object({
			"assetId": intersection(string(), unknown()).readonly(),
			"observedSnapshotId": intersection(string(), unknown()).readonly(),
			"observedCommit": intersection(string(), unknown()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_result$schema = object({
			"assetId": intersection(string(), unknown()).readonly(),
			"commit": intersection(string(), unknown()).readonly(),
			"path": union([literal("SKILL.md"), literal("README.md")]).readonly(),
			"markdown": string().readonly()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_catalog_result$schema = object({
			"snapshotId": intersection(string(), unknown()).readonly(),
			"refreshAfterMs": number().readonly(),
			"categories": array(object({
				"id": string().readonly(),
				"labelEn": string().readonly(),
				"labelZh": string().readonly(),
				"subcategories": array(object({
					"id": string().readonly(),
					"labelEn": string().readonly(),
					"labelZh": string().readonly()
				})).readonly()
			})).readonly(),
			"assets": array(object({
				"assetId": intersection(string(), unknown()).readonly(),
				"kind": union([literal("skill"), literal("agent")]).readonly(),
				"repository": string().readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
				"displayNames": object({
					"zhCN": string().readonly(),
					"en": string().readonly().optional()
				}).readonly(),
				"aliases": array(string()).readonly(),
				"nameSource": union([
					literal("catalog"),
					literal("declaration"),
					literal("generated"),
					literal("asset-id")
				]).readonly(),
				"title": string().readonly().optional(),
				"category": string().readonly().optional(),
				"subcategory": string().readonly().optional(),
				"description": string().readonly().optional(),
				"health": string().readonly().optional(),
				"validationLevel": string().readonly().optional(),
				"requires": array(intersection(string(), unknown())).readonly().optional(),
				"summaryEn": string().readonly().optional(),
				"summaryZh": string().readonly().optional()
			})).readonly(),
			"sync": object({
				"mode": union([literal("manual"), literal("event-stream")]).readonly(),
				"state": union([
					literal("connected"),
					literal("error"),
					literal("idle"),
					literal("connecting"),
					literal("reconnecting")
				]).readonly(),
				"connectedAt": number().readonly().optional(),
				"eventReceivedAt": number().readonly().optional(),
				"error": string().readonly().optional()
			}).readonly()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_catalogSyncStatus_result$schema = object({
			"mode": union([literal("manual"), literal("event-stream")]).readonly(),
			"state": union([
				literal("connected"),
				literal("error"),
				literal("idle"),
				literal("connecting"),
				literal("reconnecting")
			]).readonly(),
			"connectedAt": number().readonly().optional(),
			"eventReceivedAt": number().readonly().optional(),
			"error": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0$schema = object({
			"assetId": intersection(string(), unknown()).readonly(),
			"observedSnapshotId": intersection(string(), unknown()).readonly(),
			"observedCommit": intersection(string(), unknown()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_result$schema = object({
			"versionId": intersection(string(), unknown()).readonly(),
			"assetId": intersection(string(), unknown()).readonly(),
			"kind": union([literal("skill"), literal("agent")]).readonly(),
			"repository": string().readonly(),
			"commit": intersection(string(), unknown()).readonly(),
			"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
			"treeDigest": intersection(string(), unknown()).readonly(),
			"fileCount": number().readonly(),
			"totalBytes": number().readonly(),
			"installedAt": number().readonly(),
			"exposure": union([literal("skill-registry"), literal("agent-template")]).readonly(),
			"origin": union([literal("catalog"), literal("local-authoring")]).readonly(),
			"declarationTitleZh": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_list_result$schema = object({ "versions": array(object({
			"versionId": intersection(string(), unknown()).readonly(),
			"assetId": intersection(string(), unknown()).readonly(),
			"kind": union([literal("skill"), literal("agent")]).readonly(),
			"repository": string().readonly(),
			"commit": intersection(string(), unknown()).readonly(),
			"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
			"treeDigest": intersection(string(), unknown()).readonly(),
			"fileCount": number().readonly(),
			"totalBytes": number().readonly(),
			"installedAt": number().readonly(),
			"exposure": union([literal("skill-registry"), literal("agent-template")]).readonly(),
			"origin": union([literal("catalog"), literal("local-authoring")]).readonly(),
			"declarationTitleZh": string().readonly().optional()
		})).readonly() });
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_result$schema = string();
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0$schema = object({
			"markdown": string().readonly(),
			"mode": union([
				literal("create"),
				literal("edit"),
				literal("copy")
			]).readonly(),
			"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
			"copyAssetId": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_result$schema = object({
			"versionId": intersection(string(), unknown()).readonly(),
			"assetId": intersection(string(), unknown()).readonly(),
			"kind": union([literal("skill"), literal("agent")]).readonly(),
			"repository": string().readonly(),
			"commit": intersection(string(), unknown()).readonly(),
			"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
			"treeDigest": intersection(string(), unknown()).readonly(),
			"fileCount": number().readonly(),
			"totalBytes": number().readonly(),
			"installedAt": number().readonly(),
			"exposure": union([literal("skill-registry"), literal("agent-template")]).readonly(),
			"origin": union([literal("catalog"), literal("local-authoring")]).readonly(),
			"declarationTitleZh": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0$schema = object({ "assetId": string().readonly() });
		const _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_result$schema = _void();
		const TYPERT_REMOTE$2 = {
			package: "@deepseek-ai/dsh-quantskills-host",
			descriptors: [
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/agentTemplate",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "agentTemplate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "versionId",
						wire: "versionId",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersionId",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledAgentTemplate",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 680,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/applicationUpdateCheck",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "applicationUpdateCheck",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateCheckRequest",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateStartResult",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 549,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/applicationUpdateStart",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "applicationUpdateStart",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateStartResult",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStart_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 558,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/applicationUpdateStatus",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "applicationUpdateStatus",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateStatus",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStatus_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 539,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/assetReadme",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "assetReadme",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsAssetReadmeRequest",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsAssetReadme",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 569,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/catalog",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "catalog",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsCatalogSnapshot",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_catalog_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 487,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/catalogSyncStatus",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "catalogSyncStatus",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsCatalogSyncStatus",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_catalogSyncStatus_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 503,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/installAsset",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "installAsset",
					implementation: "install",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstallRequest",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersion",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 584,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/list",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "list",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledSnapshot",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_list_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 513,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/manualSkillRead",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "manualSkillRead",
					invocation: { kind: "direct" },
					parameters: [{
						name: "versionId",
						wire: "versionId",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersionId",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/manualSkillRead:result",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 787,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/manualSkillSave",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "manualSkillSave",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsManualSkillSaveRequest",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersion",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 798,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-host#quantSkills/uninstallAsset",
					service: "quantSkillsHost",
					namespace: "quantSkills",
					method: "uninstallAsset",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/uninstallAsset:request",
							schema: _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/uninstallAsset:result",
						schema: _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 519,
						"column": 3
					}
				}
			]
		};
		//#endregion
		//#region ../quantskills-session/lib/typert.remote-client.js
		const JsonValueRemoteCodec$schema$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema$1))
		]);
		const JsonValueRemoteCodec$schema2$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema2$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema2$1))
		]);
		const JsonValueRemoteCodec$schema3$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema3$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema3$1))
		]);
		const JsonValueRemoteCodec$schema4$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema4$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema4$1))
		]);
		const JsonValueRemoteCodec$schema5$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema5$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema5$1))
		]);
		const JsonValueRemoteCodec$schema6$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema6$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema6$1))
		]);
		const JsonValueRemoteCodec$schema7$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema7$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema7$1))
		]);
		const JsonValueRemoteCodec$schema8$1 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema8$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema8$1))
		]);
		const JsonValueRemoteCodec$schema9 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema9)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema9))
		]);
		const JsonValueRemoteCodec$schema10 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema10)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema10))
		]);
		const JsonValueRemoteCodec$schema11 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema11)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema11))
		]);
		const JsonValueRemoteCodec$schema12 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema12)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema12))
		]);
		const JsonValueRemoteCodec$schema13 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema13)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema13))
		]);
		const JsonValueRemoteCodec$schema14 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema14)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema14))
		]);
		const JsonValueRemoteCodec$schema15 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema15)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema15))
		]);
		const JsonValueRemoteCodec$schema16 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema16)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema16))
		]);
		const JsonValueRemoteCodec$schema17 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema17)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema17))
		]);
		const JsonValueRemoteCodec$schema18 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema18)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema18))
		]);
		const JsonValueRemoteCodec$schema19 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema19)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema19))
		]);
		const JsonValueRemoteCodec$schema20 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema20)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema20))
		]);
		const JsonValueRemoteCodec$schema21 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema21)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema21))
		]);
		const JsonValueRemoteCodec$schema22 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema22)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema22))
		]);
		const JsonValueRemoteCodec$schema23 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema23)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema23))
		]);
		const JsonValueRemoteCodec$schema24 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema24)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema24))
		]);
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0$schema = object({
			"purpose": literal("authoring-helper").readonly().optional(),
			"copyFrom": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"expectedRevision": number().readonly()
			}).readonly().optional(),
			"name": string().readonly(),
			"role": string().readonly(),
			"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
			"model": object({
				"provider": string().readonly(),
				"model": string().readonly(),
				"reasoningEffort": string().readonly().optional()
			}).readonly().optional(),
			"permission": union([
				literal("read-only"),
				literal("workspace-write"),
				literal("danger-full-access")
			]).readonly().optional(),
			"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
			"versionIds": array(intersection(string(), unknown())).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_result$schema = object({
			"agentId": intersection(string(), unknown()).readonly(),
			"revision": number().readonly(),
			"name": string().readonly(),
			"role": string().readonly(),
			"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
			"model": object({
				"provider": string().readonly(),
				"model": string().readonly(),
				"reasoningEffort": string().readonly().optional()
			}).readonly().optional(),
			"permission": union([
				literal("read-only"),
				literal("workspace-write"),
				literal("danger-full-access")
			]).readonly(),
			"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
			"skills": array(object({
				"assetId": intersection(string(), unknown()).readonly(),
				"versionId": intersection(string(), unknown()).readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"treeDigest": intersection(string(), unknown()).readonly()
			})).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0$schema = object({
			"agentId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_result$schema = _void();
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentLibrarySources_result$schema = array(object({
			"id": string().readonly(),
			"kind": union([literal("agent"), literal("agent-team")]).readonly(),
			"source": union([
				literal("personal"),
				literal("installed"),
				literal("internal")
			]).readonly(),
			"method": union([
				literal("manual"),
				literal("internal"),
				literal("ai"),
				literal("installation"),
				literal("recovered")
			]).readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentList_result$schema = array(object({
			"agentId": intersection(string(), unknown()).readonly(),
			"revision": number().readonly(),
			"name": string().readonly(),
			"role": string().readonly(),
			"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
			"model": object({
				"provider": string().readonly(),
				"model": string().readonly(),
				"reasoningEffort": string().readonly().optional()
			}).readonly().optional(),
			"permission": union([
				literal("read-only"),
				literal("workspace-write"),
				literal("danger-full-access")
			]).readonly(),
			"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
			"skills": array(object({
				"assetId": intersection(string(), unknown()).readonly(),
				"versionId": intersection(string(), unknown()).readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"treeDigest": intersection(string(), unknown()).readonly()
			})).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"agentId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"agent": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"role": string().readonly(),
				"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
				"model": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly().optional(),
				"permission": union([
					literal("read-only"),
					literal("workspace-write"),
					literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
				"skills": array(object({
					"assetId": intersection(string(), unknown()).readonly(),
					"versionId": intersection(string(), unknown()).readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0$schema = object({ "includeArchived": boolean().readonly().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_result$schema = array(object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"agent": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"role": string().readonly(),
				"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
				"model": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly().optional(),
				"permission": union([
					literal("read-only"),
					literal("workspace-write"),
					literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
				"skills": array(object({
					"assetId": intersection(string(), unknown()).readonly(),
					"versionId": intersection(string(), unknown()).readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly(),
			"title": string().readonly().optional(),
			"cwd": string().readonly().optional(),
			"parentSessionId": intersection(string(), unknown()).readonly().optional(),
			"archived": boolean().readonly(),
			"running": boolean().readonly(),
			"runState": union([
				literal("idle"),
				literal("failed"),
				literal("completed"),
				literal("cancelled"),
				literal("running")
			]).readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0$schema = object({
			"name": string().readonly(),
			"description": string().readonly(),
			"leadAgentId": intersection(string(), unknown()).readonly(),
			"leadAgentRevision": number().readonly(),
			"leadModel": union([object({ "kind": literal("default").readonly() }), object({
				"kind": literal("fixed").readonly(),
				"selection": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": array(object({
				"name": string().readonly(),
				"agentId": intersection(string(), unknown()).readonly(),
				"agentRevision": number().readonly(),
				"context": union([literal("fresh"), literal("fork")]).readonly(),
				"model": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_result$schema = object({
			"teamId": intersection(string(), unknown()).readonly(),
			"revision": number().readonly(),
			"name": string().readonly(),
			"description": string().readonly(),
			"lead": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"role": string().readonly(),
				"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
				"model": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly().optional(),
				"permission": union([
					literal("read-only"),
					literal("workspace-write"),
					literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
				"skills": array(object({
					"assetId": intersection(string(), unknown()).readonly(),
					"versionId": intersection(string(), unknown()).readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"leadModel": union([object({ "kind": literal("default").readonly() }), object({
				"kind": literal("fixed").readonly(),
				"selection": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": array(object({
				"name": string().readonly(),
				"context": union([literal("fresh"), literal("fork")]).readonly(),
				"agent": object({
					"agentId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"role": string().readonly(),
					"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
					"model": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly().optional(),
					"permission": union([
						literal("read-only"),
						literal("workspace-write"),
						literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
					"skills": array(object({
						"assetId": intersection(string(), unknown()).readonly(),
						"versionId": intersection(string(), unknown()).readonly(),
						"commit": intersection(string(), unknown()).readonly(),
						"treeDigest": intersection(string(), unknown()).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly(),
				"model": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0$schema = object({
			"teamId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_result$schema = _void();
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamList_result$schema = array(object({
			"teamId": intersection(string(), unknown()).readonly(),
			"revision": number().readonly(),
			"name": string().readonly(),
			"description": string().readonly(),
			"lead": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"role": string().readonly(),
				"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
				"model": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly().optional(),
				"permission": union([
					literal("read-only"),
					literal("workspace-write"),
					literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
				"skills": array(object({
					"assetId": intersection(string(), unknown()).readonly(),
					"versionId": intersection(string(), unknown()).readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"leadModel": union([object({ "kind": literal("default").readonly() }), object({
				"kind": literal("fixed").readonly(),
				"selection": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": array(object({
				"name": string().readonly(),
				"context": union([literal("fresh"), literal("fork")]).readonly(),
				"agent": object({
					"agentId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"role": string().readonly(),
					"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
					"model": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly().optional(),
					"permission": union([
						literal("read-only"),
						literal("workspace-write"),
						literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
					"skills": array(object({
						"assetId": intersection(string(), unknown()).readonly(),
						"versionId": intersection(string(), unknown()).readonly(),
						"commit": intersection(string(), unknown()).readonly(),
						"treeDigest": intersection(string(), unknown()).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly(),
				"model": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"teamId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"team": object({
				"teamId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"description": string().readonly(),
				"lead": object({
					"agentId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"role": string().readonly(),
					"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
					"model": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly().optional(),
					"permission": union([
						literal("read-only"),
						literal("workspace-write"),
						literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
					"skills": array(object({
						"assetId": intersection(string(), unknown()).readonly(),
						"versionId": intersection(string(), unknown()).readonly(),
						"commit": intersection(string(), unknown()).readonly(),
						"treeDigest": intersection(string(), unknown()).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly(),
				"leadModel": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly(),
				"members": array(object({
					"name": string().readonly(),
					"context": union([literal("fresh"), literal("fork")]).readonly(),
					"agent": object({
						"agentId": intersection(string(), unknown()).readonly(),
						"revision": number().readonly(),
						"name": string().readonly(),
						"role": string().readonly(),
						"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
						"model": object({
							"provider": string().readonly(),
							"model": string().readonly(),
							"reasoningEffort": string().readonly().optional()
						}).readonly().optional(),
						"permission": union([
							literal("read-only"),
							literal("workspace-write"),
							literal("danger-full-access")
						]).readonly(),
						"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
						"skills": array(object({
							"assetId": intersection(string(), unknown()).readonly(),
							"versionId": intersection(string(), unknown()).readonly(),
							"commit": intersection(string(), unknown()).readonly(),
							"treeDigest": intersection(string(), unknown()).readonly()
						})).readonly(),
						"createdAt": number().readonly(),
						"updatedAt": number().readonly()
					}).readonly(),
					"model": union([object({ "kind": literal("default").readonly() }), object({
						"kind": literal("fixed").readonly(),
						"selection": object({
							"provider": string().readonly(),
							"model": string().readonly(),
							"reasoningEffort": string().readonly().optional()
						}).readonly()
					})]).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0$schema = object({ "includeArchived": boolean().readonly().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_result$schema = array(object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"team": object({
				"teamId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"description": string().readonly(),
				"lead": object({
					"agentId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"role": string().readonly(),
					"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
					"model": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly().optional(),
					"permission": union([
						literal("read-only"),
						literal("workspace-write"),
						literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
					"skills": array(object({
						"assetId": intersection(string(), unknown()).readonly(),
						"versionId": intersection(string(), unknown()).readonly(),
						"commit": intersection(string(), unknown()).readonly(),
						"treeDigest": intersection(string(), unknown()).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly(),
				"leadModel": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly(),
				"members": array(object({
					"name": string().readonly(),
					"context": union([literal("fresh"), literal("fork")]).readonly(),
					"agent": object({
						"agentId": intersection(string(), unknown()).readonly(),
						"revision": number().readonly(),
						"name": string().readonly(),
						"role": string().readonly(),
						"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
						"model": object({
							"provider": string().readonly(),
							"model": string().readonly(),
							"reasoningEffort": string().readonly().optional()
						}).readonly().optional(),
						"permission": union([
							literal("read-only"),
							literal("workspace-write"),
							literal("danger-full-access")
						]).readonly(),
						"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
						"skills": array(object({
							"assetId": intersection(string(), unknown()).readonly(),
							"versionId": intersection(string(), unknown()).readonly(),
							"commit": intersection(string(), unknown()).readonly(),
							"treeDigest": intersection(string(), unknown()).readonly()
						})).readonly(),
						"createdAt": number().readonly(),
						"updatedAt": number().readonly()
					}).readonly(),
					"model": union([object({ "kind": literal("default").readonly() }), object({
						"kind": literal("fixed").readonly(),
						"selection": object({
							"provider": string().readonly(),
							"model": string().readonly(),
							"reasoningEffort": string().readonly().optional()
						}).readonly()
					})]).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly(),
			"title": string().readonly().optional(),
			"cwd": string().readonly().optional(),
			"parentSessionId": intersection(string(), unknown()).readonly().optional(),
			"archived": boolean().readonly(),
			"running": boolean().readonly(),
			"runState": union([
				literal("idle"),
				literal("failed"),
				literal("completed"),
				literal("cancelled"),
				literal("running")
			]).readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0$schema = object({
			"teamId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly(),
			"name": string().readonly(),
			"description": string().readonly(),
			"leadAgentId": intersection(string(), unknown()).readonly(),
			"leadAgentRevision": number().readonly(),
			"leadModel": union([object({ "kind": literal("default").readonly() }), object({
				"kind": literal("fixed").readonly(),
				"selection": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": array(object({
				"name": string().readonly(),
				"agentId": intersection(string(), unknown()).readonly(),
				"agentRevision": number().readonly(),
				"context": union([literal("fresh"), literal("fork")]).readonly(),
				"model": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_result$schema = object({
			"teamId": intersection(string(), unknown()).readonly(),
			"revision": number().readonly(),
			"name": string().readonly(),
			"description": string().readonly(),
			"lead": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"role": string().readonly(),
				"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
				"model": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly().optional(),
				"permission": union([
					literal("read-only"),
					literal("workspace-write"),
					literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
				"skills": array(object({
					"assetId": intersection(string(), unknown()).readonly(),
					"versionId": intersection(string(), unknown()).readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"leadModel": union([object({ "kind": literal("default").readonly() }), object({
				"kind": literal("fixed").readonly(),
				"selection": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": array(object({
				"name": string().readonly(),
				"context": union([literal("fresh"), literal("fork")]).readonly(),
				"agent": object({
					"agentId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"role": string().readonly(),
					"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
					"model": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly().optional(),
					"permission": union([
						literal("read-only"),
						literal("workspace-write"),
						literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
					"skills": array(object({
						"assetId": intersection(string(), unknown()).readonly(),
						"versionId": intersection(string(), unknown()).readonly(),
						"commit": intersection(string(), unknown()).readonly(),
						"treeDigest": intersection(string(), unknown()).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly(),
				"model": union([object({ "kind": literal("default").readonly() }), object({
					"kind": literal("fixed").readonly(),
					"selection": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0$schema = object({
			"agentId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_result$schema = _void();
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0$schema = object({
			"agentId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly(),
			"purpose": literal("authoring-helper").readonly().optional(),
			"copyFrom": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"expectedRevision": number().readonly()
			}).readonly().optional(),
			"name": string().readonly(),
			"role": string().readonly(),
			"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
			"model": object({
				"provider": string().readonly(),
				"model": string().readonly(),
				"reasoningEffort": string().readonly().optional()
			}).readonly().optional(),
			"permission": union([
				literal("read-only"),
				literal("workspace-write"),
				literal("danger-full-access")
			]).readonly().optional(),
			"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
			"versionIds": array(intersection(string(), unknown())).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_result$schema = object({
			"agentId": intersection(string(), unknown()).readonly(),
			"revision": number().readonly(),
			"name": string().readonly(),
			"role": string().readonly(),
			"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
			"model": object({
				"provider": string().readonly(),
				"model": string().readonly(),
				"reasoningEffort": string().readonly().optional()
			}).readonly().optional(),
			"permission": union([
				literal("read-only"),
				literal("workspace-write"),
				literal("danger-full-access")
			]).readonly(),
			"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
			"skills": array(object({
				"assetId": intersection(string(), unknown()).readonly(),
				"versionId": intersection(string(), unknown()).readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"treeDigest": intersection(string(), unknown()).readonly()
			})).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"toolCallId": string().readonly(),
			"expectedTreeDigest": intersection(string(), unknown()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_result$schema = union([
			object({
				"kind": literal("skill").readonly(),
				"version": object({
					"versionId": intersection(string(), unknown()).readonly(),
					"assetId": intersection(string(), unknown()).readonly(),
					"kind": union([literal("skill"), literal("agent")]).readonly(),
					"repository": string().readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly(),
					"fileCount": number().readonly(),
					"totalBytes": number().readonly(),
					"installedAt": number().readonly(),
					"exposure": union([literal("skill-registry"), literal("agent-template")]).readonly(),
					"origin": union([literal("catalog"), literal("local-authoring")]).readonly(),
					"declarationTitleZh": string().readonly().optional()
				}).readonly()
			}),
			object({
				"kind": literal("agent").readonly(),
				"version": object({
					"versionId": intersection(string(), unknown()).readonly(),
					"assetId": intersection(string(), unknown()).readonly(),
					"kind": union([literal("skill"), literal("agent")]).readonly(),
					"repository": string().readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"declaration": union([literal("SKILL.md"), literal("AGENTS.md")]).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly(),
					"fileCount": number().readonly(),
					"totalBytes": number().readonly(),
					"installedAt": number().readonly(),
					"exposure": union([literal("skill-registry"), literal("agent-template")]).readonly(),
					"origin": union([literal("catalog"), literal("local-authoring")]).readonly(),
					"declarationTitleZh": string().readonly().optional()
				}).readonly(),
				"agent": object({
					"agentId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"role": string().readonly(),
					"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
					"model": object({
						"provider": string().readonly(),
						"model": string().readonly(),
						"reasoningEffort": string().readonly().optional()
					}).readonly().optional(),
					"permission": union([
						literal("read-only"),
						literal("workspace-write"),
						literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
					"skills": array(object({
						"assetId": intersection(string(), unknown()).readonly(),
						"versionId": intersection(string(), unknown()).readonly(),
						"commit": intersection(string(), unknown()).readonly(),
						"treeDigest": intersection(string(), unknown()).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly()
			}),
			object({
				"kind": literal("agent-team").readonly(),
				"team": object({
					"teamId": intersection(string(), unknown()).readonly(),
					"revision": number().readonly(),
					"name": string().readonly(),
					"description": string().readonly(),
					"lead": object({
						"agentId": intersection(string(), unknown()).readonly(),
						"revision": number().readonly(),
						"name": string().readonly(),
						"role": string().readonly(),
						"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
						"model": object({
							"provider": string().readonly(),
							"model": string().readonly(),
							"reasoningEffort": string().readonly().optional()
						}).readonly().optional(),
						"permission": union([
							literal("read-only"),
							literal("workspace-write"),
							literal("danger-full-access")
						]).readonly(),
						"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
						"skills": array(object({
							"assetId": intersection(string(), unknown()).readonly(),
							"versionId": intersection(string(), unknown()).readonly(),
							"commit": intersection(string(), unknown()).readonly(),
							"treeDigest": intersection(string(), unknown()).readonly()
						})).readonly(),
						"createdAt": number().readonly(),
						"updatedAt": number().readonly()
					}).readonly(),
					"leadModel": union([object({ "kind": literal("default").readonly() }), object({
						"kind": literal("fixed").readonly(),
						"selection": object({
							"provider": string().readonly(),
							"model": string().readonly(),
							"reasoningEffort": string().readonly().optional()
						}).readonly()
					})]).readonly(),
					"members": array(object({
						"name": string().readonly(),
						"context": union([literal("fresh"), literal("fork")]).readonly(),
						"agent": object({
							"agentId": intersection(string(), unknown()).readonly(),
							"revision": number().readonly(),
							"name": string().readonly(),
							"role": string().readonly(),
							"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
							"model": object({
								"provider": string().readonly(),
								"model": string().readonly(),
								"reasoningEffort": string().readonly().optional()
							}).readonly().optional(),
							"permission": union([
								literal("read-only"),
								literal("workspace-write"),
								literal("danger-full-access")
							]).readonly(),
							"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
							"skills": array(object({
								"assetId": intersection(string(), unknown()).readonly(),
								"versionId": intersection(string(), unknown()).readonly(),
								"commit": intersection(string(), unknown()).readonly(),
								"treeDigest": intersection(string(), unknown()).readonly()
							})).readonly(),
							"createdAt": number().readonly(),
							"updatedAt": number().readonly()
						}).readonly(),
						"model": union([object({ "kind": literal("default").readonly() }), object({
							"kind": literal("fixed").readonly(),
							"selection": object({
								"provider": string().readonly(),
								"model": string().readonly(),
								"reasoningEffort": string().readonly().optional()
							}).readonly()
						})]).readonly()
					})).readonly(),
					"createdAt": number().readonly(),
					"updatedAt": number().readonly()
				}).readonly()
			})
		]);
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0$schema = object({
			"kind": union([
				literal("skill"),
				literal("agent"),
				literal("agent-team")
			]).readonly(),
			"sessionId": intersection(string(), unknown()).readonly(),
			"agentId": intersection(string(), unknown()).readonly(),
			"expectedRevision": number().readonly(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"agent": object({
				"agentId": intersection(string(), unknown()).readonly(),
				"revision": number().readonly(),
				"name": string().readonly(),
				"role": string().readonly(),
				"mode": union([literal("dynamic"), literal("fixed")]).readonly(),
				"model": object({
					"provider": string().readonly(),
					"model": string().readonly(),
					"reasoningEffort": string().readonly().optional()
				}).readonly().optional(),
				"permission": union([
					literal("read-only"),
					literal("workspace-write"),
					literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": intersection(string(), unknown()).readonly().optional(),
				"skills": array(object({
					"assetId": intersection(string(), unknown()).readonly(),
					"versionId": intersection(string(), unknown()).readonly(),
					"commit": intersection(string(), unknown()).readonly(),
					"treeDigest": intersection(string(), unknown()).readonly()
				})).readonly(),
				"createdAt": number().readonly(),
				"updatedAt": number().readonly()
			}).readonly(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestCheckUpdate_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema17)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema17))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema17)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema17))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestConnect_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema15)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema15))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema15)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema15))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDisconnect_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema16)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema16))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema16)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema16))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0$schema = object({
			"planId": string(),
			"sessionId": string()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema22)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema22))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema22)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema22))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0$schema = object({
			"planId": string(),
			"sessionId": string()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_result$schema = object({
			"id": string().readonly(),
			"sessionId": string().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly(),
			"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
			"createdAt": number().readonly(),
			"expiresAt": number().readonly(),
			"summary": string().readonly(),
			"details": record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema21)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema21))
			])).readonly(),
			"clientRequestId": string().readonly(),
			"status": union([
				literal("failed"),
				literal("prepared"),
				literal("executing"),
				literal("completed"),
				literal("unknown"),
				literal("cancelled"),
				literal("expired"),
				literal("queued"),
				literal("submitted"),
				literal("partial")
			]),
			"operationId": union([_undefined(), string()]).optional(),
			"result": union([_undefined(), record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema21)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema21))
			]))]).optional(),
			"fills": union([_undefined(), array(object({
				"id": string(),
				"tradeId": string(),
				"orderId": string(),
				"price": number(),
				"volume": number(),
				"time": string()
			}))]).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0$schema = object({ "sessionId": intersection(string(), unknown()) });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_result$schema = object({
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly(),
			"fetchedAt": number().readonly(),
			"account": object({
				"data": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				]).readonly(),
				"meta": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				])).readonly().optional(),
				"fetchedAt": number().readonly()
			}).readonly(),
			"positions": object({
				"data": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				]).readonly(),
				"meta": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				])).readonly().optional(),
				"fetchedAt": number().readonly()
			}).readonly(),
			"openOrders": object({
				"data": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				]).readonly(),
				"meta": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				])).readonly().optional(),
				"fetchedAt": number().readonly()
			}).readonly(),
			"pendingPlans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema20)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema20))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly(),
			"summary": array(string()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0$schema = object({ "enabled": boolean() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema14)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema14))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema14)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema14))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0$schema = object({
			"kind": union([
				literal("account"),
				literal("positions"),
				literal("open-orders"),
				literal("orders"),
				literal("trades"),
				literal("ranking"),
				literal("ranking-me"),
				literal("settlements"),
				literal("quote")
			]).readonly(),
			"symbol": string().readonly().optional(),
			"date": string().readonly().optional(),
			"lastId": string().readonly().optional(),
			"board": union([literal("live"), literal("settled")]).readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_result$schema = object({
			"data": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema19)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema19))
			]).readonly(),
			"meta": record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema19)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema19))
			])).readonly().optional(),
			"fetchedAt": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0$schema = object({
			"planId": string(),
			"sessionId": string()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_result$schema = object({
			"id": string().readonly(),
			"sessionId": string().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly(),
			"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
			"createdAt": number().readonly(),
			"expiresAt": number().readonly(),
			"summary": string().readonly(),
			"details": record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema23)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema23))
			])).readonly(),
			"clientRequestId": string().readonly(),
			"status": union([
				literal("failed"),
				literal("prepared"),
				literal("executing"),
				literal("completed"),
				literal("unknown"),
				literal("cancelled"),
				literal("expired"),
				literal("queued"),
				literal("submitted"),
				literal("partial")
			]),
			"operationId": union([_undefined(), string()]).optional(),
			"result": union([_undefined(), record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema23)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema23))
			]))]).optional(),
			"fills": union([_undefined(), array(object({
				"id": string(),
				"tradeId": string(),
				"orderId": string(),
				"price": number(),
				"volume": number(),
				"time": string()
			}))]).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"topic": boolean().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"binding": object({
				"purpose": union([
					literal("ordinary"),
					literal("role-helper"),
					literal("contest"),
					literal("factor-contest")
				]).readonly(),
				"contest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"factorContest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"contestConversation": union([
					_undefined(),
					literal("main"),
					literal("topic")
				]).readonly().optional()
			}).readonly(),
			"created": boolean().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0$schema = object({ "sessionId": string().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema13)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema13))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema13)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema13))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestUpdate_result$schema = object({
			"enabled": boolean().readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]).readonly(),
			"cliVersion": string().readonly().optional(),
			"latestVersion": string().readonly().optional(),
			"updateAvailable": boolean().readonly(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).readonly().optional(),
			"message": string().readonly(),
			"plans": array(object({
				"id": string().readonly(),
				"sessionId": string().readonly(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}).readonly(),
				"operation": union([literal("place_order"), literal("cancel_order")]).readonly(),
				"createdAt": number().readonly(),
				"expiresAt": number().readonly(),
				"summary": string().readonly(),
				"details": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema18)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema18))
				])).readonly(),
				"clientRequestId": string().readonly(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired"),
					literal("queued"),
					literal("submitted"),
					literal("partial")
				]),
				"operationId": union([_undefined(), string()]).optional(),
				"result": union([_undefined(), record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema18)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema18))
				]))]).optional(),
				"fills": union([_undefined(), array(object({
					"id": string(),
					"tradeId": string(),
					"orderId": string(),
					"price": number(),
					"volume": number(),
					"time": string()
				}))]).optional()
			})).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"versionId": intersection(string(), unknown()).readonly(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"binding": object({
				"assetId": intersection(string(), unknown()).readonly(),
				"versionId": intersection(string(), unknown()).readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"treeDigest": intersection(string(), unknown()).readonly()
			}).readonly(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorCheckUpdate_result$schema = object({
			"enabled": boolean(),
			"phase": union([
				literal("disconnected"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]),
			"cliVersion": string().optional(),
			"latestVersion": string().optional(),
			"updateAvailable": boolean(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).optional(),
			"message": string(),
			"inspection": object({
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"fetchedAt": number(),
				"balance": number(),
				"registration": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema5$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema5$1))
				]),
				"pool": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema5$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema5$1))
				])
			}).optional(),
			"plans": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"action": union([
					object({
						"kind": literal("create-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly()
					}),
					object({
						"kind": literal("update-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly().optional()
					}),
					object({
						"kind": literal("add-factor").readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("replace-factor").readonly(),
						"factorId": string().readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("remove-factor").readonly(),
						"factorId": string().readonly()
					}),
					object({ "kind": literal("submit-pool").readonly() }),
					object({
						"kind": literal("budget").readonly(),
						"batch": object({
							"hypothesis": string().readonly(),
							"maxRuns": number().readonly(),
							"creditThreshold": number().readonly(),
							"startDate": string().readonly(),
							"endDate": string().readonly(),
							"cycle": number().readonly()
						}).readonly()
					})
				]),
				"summary": string(),
				"snapshot": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema5$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema5$1))
				]),
				"snapshotHash": string(),
				"createdAt": number(),
				"expiresAt": number(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema5$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema5$1))
				]).optional()
			})),
			"budgets": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"runsUsed": number(),
				"creditsUsed": number(),
				"baseline": number(),
				"status": union([
					literal("unknown"),
					literal("active"),
					literal("stopped"),
					literal("exhausted")
				]),
				"hypothesis": string().readonly(),
				"maxRuns": number().readonly(),
				"creditThreshold": number().readonly(),
				"startDate": string().readonly(),
				"endDate": string().readonly(),
				"cycle": number().readonly()
			})),
			"runs": array(object({
				"id": string(),
				"budgetId": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"candidate": object({
					"requestId": string().readonly(),
					"name": string().readonly(),
					"formula": string().readonly().optional(),
					"code": string().readonly().optional(),
					"direction": union([literal(0), literal(1)]).readonly()
				}),
				"workflowId": string().optional(),
				"runId": string().optional(),
				"createdAt": number(),
				"status": union([
					literal("failed"),
					literal("completed"),
					literal("unknown"),
					literal("creating"),
					literal("running")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema5$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema5$1))
				]).optional()
			}))
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0$schema = object({
			"planId": string(),
			"sessionId": string()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_result$schema = object({
			"id": string(),
			"sessionId": string(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}),
			"action": union([
				object({
					"kind": literal("create-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly()
				}),
				object({
					"kind": literal("update-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly().optional()
				}),
				object({
					"kind": literal("add-factor").readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("replace-factor").readonly(),
					"factorId": string().readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("remove-factor").readonly(),
					"factorId": string().readonly()
				}),
				object({ "kind": literal("submit-pool").readonly() }),
				object({
					"kind": literal("budget").readonly(),
					"batch": object({
						"hypothesis": string().readonly(),
						"maxRuns": number().readonly(),
						"creditThreshold": number().readonly(),
						"startDate": string().readonly(),
						"endDate": string().readonly(),
						"cycle": number().readonly()
					}).readonly()
				})
			]),
			"summary": string(),
			"snapshot": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema10)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema10))
			]),
			"snapshotHash": string(),
			"createdAt": number(),
			"expiresAt": number(),
			"status": union([
				literal("failed"),
				literal("prepared"),
				literal("executing"),
				literal("completed"),
				literal("unknown"),
				literal("cancelled"),
				literal("expired")
			]),
			"result": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema10)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema10))
			]).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0$schema = object({ "credentials": object({
			"phone": string().readonly(),
			"password": string().readonly()
		}).optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_result$schema = object({
			"enabled": boolean(),
			"phase": union([
				literal("disconnected"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]),
			"cliVersion": string().optional(),
			"latestVersion": string().optional(),
			"updateAvailable": boolean(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).optional(),
			"message": string(),
			"inspection": object({
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"fetchedAt": number(),
				"balance": number(),
				"registration": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema3$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema3$1))
				]),
				"pool": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema3$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema3$1))
				])
			}).optional(),
			"plans": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"action": union([
					object({
						"kind": literal("create-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly()
					}),
					object({
						"kind": literal("update-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly().optional()
					}),
					object({
						"kind": literal("add-factor").readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("replace-factor").readonly(),
						"factorId": string().readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("remove-factor").readonly(),
						"factorId": string().readonly()
					}),
					object({ "kind": literal("submit-pool").readonly() }),
					object({
						"kind": literal("budget").readonly(),
						"batch": object({
							"hypothesis": string().readonly(),
							"maxRuns": number().readonly(),
							"creditThreshold": number().readonly(),
							"startDate": string().readonly(),
							"endDate": string().readonly(),
							"cycle": number().readonly()
						}).readonly()
					})
				]),
				"summary": string(),
				"snapshot": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema3$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema3$1))
				]),
				"snapshotHash": string(),
				"createdAt": number(),
				"expiresAt": number(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema3$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema3$1))
				]).optional()
			})),
			"budgets": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"runsUsed": number(),
				"creditsUsed": number(),
				"baseline": number(),
				"status": union([
					literal("unknown"),
					literal("active"),
					literal("stopped"),
					literal("exhausted")
				]),
				"hypothesis": string().readonly(),
				"maxRuns": number().readonly(),
				"creditThreshold": number().readonly(),
				"startDate": string().readonly(),
				"endDate": string().readonly(),
				"cycle": number().readonly()
			})),
			"runs": array(object({
				"id": string(),
				"budgetId": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"candidate": object({
					"requestId": string().readonly(),
					"name": string().readonly(),
					"formula": string().readonly().optional(),
					"code": string().readonly().optional(),
					"direction": union([literal(0), literal(1)]).readonly()
				}),
				"workflowId": string().optional(),
				"runId": string().optional(),
				"createdAt": number(),
				"status": union([
					literal("failed"),
					literal("completed"),
					literal("unknown"),
					literal("creating"),
					literal("running")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema3$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema3$1))
				]).optional()
			}))
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDisconnect_result$schema = object({
			"enabled": boolean(),
			"phase": union([
				literal("disconnected"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]),
			"cliVersion": string().optional(),
			"latestVersion": string().optional(),
			"updateAvailable": boolean(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).optional(),
			"message": string(),
			"inspection": object({
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"fetchedAt": number(),
				"balance": number(),
				"registration": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema4$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema4$1))
				]),
				"pool": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema4$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema4$1))
				])
			}).optional(),
			"plans": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"action": union([
					object({
						"kind": literal("create-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly()
					}),
					object({
						"kind": literal("update-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly().optional()
					}),
					object({
						"kind": literal("add-factor").readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("replace-factor").readonly(),
						"factorId": string().readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("remove-factor").readonly(),
						"factorId": string().readonly()
					}),
					object({ "kind": literal("submit-pool").readonly() }),
					object({
						"kind": literal("budget").readonly(),
						"batch": object({
							"hypothesis": string().readonly(),
							"maxRuns": number().readonly(),
							"creditThreshold": number().readonly(),
							"startDate": string().readonly(),
							"endDate": string().readonly(),
							"cycle": number().readonly()
						}).readonly()
					})
				]),
				"summary": string(),
				"snapshot": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema4$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema4$1))
				]),
				"snapshotHash": string(),
				"createdAt": number(),
				"expiresAt": number(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema4$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema4$1))
				]).optional()
			})),
			"budgets": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"runsUsed": number(),
				"creditsUsed": number(),
				"baseline": number(),
				"status": union([
					literal("unknown"),
					literal("active"),
					literal("stopped"),
					literal("exhausted")
				]),
				"hypothesis": string().readonly(),
				"maxRuns": number().readonly(),
				"creditThreshold": number().readonly(),
				"startDate": string().readonly(),
				"endDate": string().readonly(),
				"cycle": number().readonly()
			})),
			"runs": array(object({
				"id": string(),
				"budgetId": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"candidate": object({
					"requestId": string().readonly(),
					"name": string().readonly(),
					"formula": string().readonly().optional(),
					"code": string().readonly().optional(),
					"direction": union([literal(0), literal(1)]).readonly()
				}),
				"workflowId": string().optional(),
				"runId": string().optional(),
				"createdAt": number(),
				"status": union([
					literal("failed"),
					literal("completed"),
					literal("unknown"),
					literal("creating"),
					literal("running")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema4$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema4$1))
				]).optional()
			}))
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0$schema = object({
			"planId": string(),
			"sessionId": string()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_result$schema = _void();
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0$schema = object({ "sessionId": intersection(string(), unknown()).optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_result$schema = object({
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}),
			"fetchedAt": number(),
			"balance": number(),
			"registration": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema7$1)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema7$1))
			]),
			"pool": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema7$1)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema7$1))
			])
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0$schema = object({ "enabled": boolean() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_result$schema = object({
			"enabled": boolean(),
			"phase": union([
				literal("disconnected"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]),
			"cliVersion": string().optional(),
			"latestVersion": string().optional(),
			"updateAvailable": boolean(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).optional(),
			"message": string(),
			"inspection": object({
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"fetchedAt": number(),
				"balance": number(),
				"registration": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema2$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema2$1))
				]),
				"pool": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema2$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema2$1))
				])
			}).optional(),
			"plans": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"action": union([
					object({
						"kind": literal("create-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly()
					}),
					object({
						"kind": literal("update-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly().optional()
					}),
					object({
						"kind": literal("add-factor").readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("replace-factor").readonly(),
						"factorId": string().readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("remove-factor").readonly(),
						"factorId": string().readonly()
					}),
					object({ "kind": literal("submit-pool").readonly() }),
					object({
						"kind": literal("budget").readonly(),
						"batch": object({
							"hypothesis": string().readonly(),
							"maxRuns": number().readonly(),
							"creditThreshold": number().readonly(),
							"startDate": string().readonly(),
							"endDate": string().readonly(),
							"cycle": number().readonly()
						}).readonly()
					})
				]),
				"summary": string(),
				"snapshot": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema2$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema2$1))
				]),
				"snapshotHash": string(),
				"createdAt": number(),
				"expiresAt": number(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema2$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema2$1))
				]).optional()
			})),
			"budgets": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"runsUsed": number(),
				"creditsUsed": number(),
				"baseline": number(),
				"status": union([
					literal("unknown"),
					literal("active"),
					literal("stopped"),
					literal("exhausted")
				]),
				"hypothesis": string().readonly(),
				"maxRuns": number().readonly(),
				"creditThreshold": number().readonly(),
				"startDate": string().readonly(),
				"endDate": string().readonly(),
				"cycle": number().readonly()
			})),
			"runs": array(object({
				"id": string(),
				"budgetId": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"candidate": object({
					"requestId": string().readonly(),
					"name": string().readonly(),
					"formula": string().readonly().optional(),
					"code": string().readonly().optional(),
					"direction": union([literal(0), literal(1)]).readonly()
				}),
				"workflowId": string().optional(),
				"runId": string().optional(),
				"createdAt": number(),
				"status": union([
					literal("failed"),
					literal("completed"),
					literal("unknown"),
					literal("creating"),
					literal("running")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema2$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema2$1))
				]).optional()
			}))
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0$schema = object({
			"action": union([
				object({
					"kind": literal("create-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly()
				}),
				object({
					"kind": literal("update-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly().optional()
				}),
				object({
					"kind": literal("add-factor").readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("replace-factor").readonly(),
					"factorId": string().readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("remove-factor").readonly(),
					"factorId": string().readonly()
				}),
				object({ "kind": literal("submit-pool").readonly() }),
				object({
					"kind": literal("budget").readonly(),
					"batch": object({
						"hypothesis": string().readonly(),
						"maxRuns": number().readonly(),
						"creditThreshold": number().readonly(),
						"startDate": string().readonly(),
						"endDate": string().readonly(),
						"cycle": number().readonly()
					}).readonly()
				})
			]),
			"sessionId": intersection(string(), unknown()).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_result$schema = object({
			"id": string(),
			"sessionId": string(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}),
			"action": union([
				object({
					"kind": literal("create-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly()
				}),
				object({
					"kind": literal("update-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly().optional()
				}),
				object({
					"kind": literal("add-factor").readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("replace-factor").readonly(),
					"factorId": string().readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("remove-factor").readonly(),
					"factorId": string().readonly()
				}),
				object({ "kind": literal("submit-pool").readonly() }),
				object({
					"kind": literal("budget").readonly(),
					"batch": object({
						"hypothesis": string().readonly(),
						"maxRuns": number().readonly(),
						"creditThreshold": number().readonly(),
						"startDate": string().readonly(),
						"endDate": string().readonly(),
						"cycle": number().readonly()
					}).readonly()
				})
			]),
			"summary": string(),
			"snapshot": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema9)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema9))
			]),
			"snapshotHash": string(),
			"createdAt": number(),
			"expiresAt": number(),
			"status": union([
				literal("failed"),
				literal("prepared"),
				literal("executing"),
				literal("completed"),
				literal("unknown"),
				literal("cancelled"),
				literal("expired")
			]),
			"result": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema9)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema9))
			]).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0$schema = object({
			"kind": union([
				literal("pool"),
				literal("workflows"),
				literal("scores"),
				literal("factor-info"),
				literal("factor-result"),
				literal("factors")
			]).readonly(),
			"id": string().readonly().optional(),
			"page": number().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_result$schema = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema8$1)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema8$1))
		]);
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0$schema = object({ "planId": string() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_result$schema = object({
			"id": string(),
			"sessionId": string(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}),
			"action": union([
				object({
					"kind": literal("create-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly()
				}),
				object({
					"kind": literal("update-pool").readonly(),
					"name": string().readonly(),
					"style": string().readonly(),
					"cycle": number().readonly().optional()
				}),
				object({
					"kind": literal("add-factor").readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("replace-factor").readonly(),
					"factorId": string().readonly(),
					"workflowId": string().readonly()
				}),
				object({
					"kind": literal("remove-factor").readonly(),
					"factorId": string().readonly()
				}),
				object({ "kind": literal("submit-pool").readonly() }),
				object({
					"kind": literal("budget").readonly(),
					"batch": object({
						"hypothesis": string().readonly(),
						"maxRuns": number().readonly(),
						"creditThreshold": number().readonly(),
						"startDate": string().readonly(),
						"endDate": string().readonly(),
						"cycle": number().readonly()
					}).readonly()
				})
			]),
			"summary": string(),
			"snapshot": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema12)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema12))
			]),
			"snapshotHash": string(),
			"createdAt": number(),
			"expiresAt": number(),
			"status": union([
				literal("failed"),
				literal("prepared"),
				literal("executing"),
				literal("completed"),
				literal("unknown"),
				literal("cancelled"),
				literal("expired")
			]),
			"result": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema12)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema12))
			]).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0$schema = object({ "runId": string() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_result$schema = object({
			"id": string(),
			"budgetId": string(),
			"sessionId": string(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}),
			"candidate": object({
				"requestId": string().readonly(),
				"name": string().readonly(),
				"formula": string().readonly().optional(),
				"code": string().readonly().optional(),
				"direction": union([literal(0), literal(1)]).readonly()
			}),
			"workflowId": string().optional(),
			"runId": string().optional(),
			"createdAt": number(),
			"status": union([
				literal("failed"),
				literal("completed"),
				literal("unknown"),
				literal("creating"),
				literal("running")
			]),
			"result": union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema11)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema11))
			]).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"topic": boolean().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"binding": object({
				"purpose": union([
					literal("ordinary"),
					literal("role-helper"),
					literal("contest"),
					literal("factor-contest")
				]).readonly(),
				"contest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"factorContest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"contestConversation": union([
					_undefined(),
					literal("main"),
					literal("topic")
				]).readonly().optional()
			}).readonly(),
			"created": boolean().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0$schema = object({ "sessionId": string().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_result$schema = object({
			"enabled": boolean(),
			"phase": union([
				literal("disconnected"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]),
			"cliVersion": string().optional(),
			"latestVersion": string().optional(),
			"updateAvailable": boolean(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).optional(),
			"message": string(),
			"inspection": object({
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"fetchedAt": number(),
				"balance": number(),
				"registration": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema$1))
				]),
				"pool": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema$1))
				])
			}).optional(),
			"plans": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"action": union([
					object({
						"kind": literal("create-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly()
					}),
					object({
						"kind": literal("update-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly().optional()
					}),
					object({
						"kind": literal("add-factor").readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("replace-factor").readonly(),
						"factorId": string().readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("remove-factor").readonly(),
						"factorId": string().readonly()
					}),
					object({ "kind": literal("submit-pool").readonly() }),
					object({
						"kind": literal("budget").readonly(),
						"batch": object({
							"hypothesis": string().readonly(),
							"maxRuns": number().readonly(),
							"creditThreshold": number().readonly(),
							"startDate": string().readonly(),
							"endDate": string().readonly(),
							"cycle": number().readonly()
						}).readonly()
					})
				]),
				"summary": string(),
				"snapshot": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema$1))
				]),
				"snapshotHash": string(),
				"createdAt": number(),
				"expiresAt": number(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema$1))
				]).optional()
			})),
			"budgets": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"runsUsed": number(),
				"creditsUsed": number(),
				"baseline": number(),
				"status": union([
					literal("unknown"),
					literal("active"),
					literal("stopped"),
					literal("exhausted")
				]),
				"hypothesis": string().readonly(),
				"maxRuns": number().readonly(),
				"creditThreshold": number().readonly(),
				"startDate": string().readonly(),
				"endDate": string().readonly(),
				"cycle": number().readonly()
			})),
			"runs": array(object({
				"id": string(),
				"budgetId": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"candidate": object({
					"requestId": string().readonly(),
					"name": string().readonly(),
					"formula": string().readonly().optional(),
					"code": string().readonly().optional(),
					"direction": union([literal(0), literal(1)]).readonly()
				}),
				"workflowId": string().optional(),
				"runId": string().optional(),
				"createdAt": number(),
				"status": union([
					literal("failed"),
					literal("completed"),
					literal("unknown"),
					literal("creating"),
					literal("running")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema$1))
				]).optional()
			}))
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0$schema = object({ "budgetId": string() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_result$schema = _void();
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorUpdate_result$schema = object({
			"enabled": boolean(),
			"phase": union([
				literal("disconnected"),
				literal("connected"),
				literal("error"),
				literal("installing"),
				literal("off")
			]),
			"cliVersion": string().optional(),
			"latestVersion": string().optional(),
			"updateAvailable": boolean(),
			"identity": object({
				"accountId": string().readonly(),
				"contestId": string().readonly()
			}).optional(),
			"message": string(),
			"inspection": object({
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"fetchedAt": number(),
				"balance": number(),
				"registration": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema6$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema6$1))
				]),
				"pool": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema6$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema6$1))
				])
			}).optional(),
			"plans": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"action": union([
					object({
						"kind": literal("create-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly()
					}),
					object({
						"kind": literal("update-pool").readonly(),
						"name": string().readonly(),
						"style": string().readonly(),
						"cycle": number().readonly().optional()
					}),
					object({
						"kind": literal("add-factor").readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("replace-factor").readonly(),
						"factorId": string().readonly(),
						"workflowId": string().readonly()
					}),
					object({
						"kind": literal("remove-factor").readonly(),
						"factorId": string().readonly()
					}),
					object({ "kind": literal("submit-pool").readonly() }),
					object({
						"kind": literal("budget").readonly(),
						"batch": object({
							"hypothesis": string().readonly(),
							"maxRuns": number().readonly(),
							"creditThreshold": number().readonly(),
							"startDate": string().readonly(),
							"endDate": string().readonly(),
							"cycle": number().readonly()
						}).readonly()
					})
				]),
				"summary": string(),
				"snapshot": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema6$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema6$1))
				]),
				"snapshotHash": string(),
				"createdAt": number(),
				"expiresAt": number(),
				"status": union([
					literal("failed"),
					literal("prepared"),
					literal("executing"),
					literal("completed"),
					literal("unknown"),
					literal("cancelled"),
					literal("expired")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema6$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema6$1))
				]).optional()
			})),
			"budgets": array(object({
				"id": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"runsUsed": number(),
				"creditsUsed": number(),
				"baseline": number(),
				"status": union([
					literal("unknown"),
					literal("active"),
					literal("stopped"),
					literal("exhausted")
				]),
				"hypothesis": string().readonly(),
				"maxRuns": number().readonly(),
				"creditThreshold": number().readonly(),
				"startDate": string().readonly(),
				"endDate": string().readonly(),
				"cycle": number().readonly()
			})),
			"runs": array(object({
				"id": string(),
				"budgetId": string(),
				"sessionId": string(),
				"identity": object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				}),
				"candidate": object({
					"requestId": string().readonly(),
					"name": string().readonly(),
					"formula": string().readonly().optional(),
					"code": string().readonly().optional(),
					"direction": union([literal(0), literal(1)]).readonly()
				}),
				"workflowId": string().optional(),
				"runId": string().optional(),
				"createdAt": number(),
				"status": union([
					literal("failed"),
					literal("completed"),
					literal("unknown"),
					literal("creating"),
					literal("running")
				]),
				"result": union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema6$1)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema6$1))
				]).optional()
			}))
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"data": string().readonly(),
			"mediaType": string().readonly(),
			"name": string().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_result$schema = object({
			"file": object({
				"attachmentId": intersection(string(), unknown()).readonly(),
				"mediaType": string().readonly(),
				"bytes": number().readonly(),
				"name": string().readonly()
			}).readonly(),
			"parsing": union([
				object({
					"status": literal("ready").readonly(),
					"kind": literal("utf8-text").readonly()
				}),
				object({
					"status": literal("ready").readonly(),
					"kind": union([
						literal("pdf"),
						literal("office-document"),
						literal("spreadsheet")
					]).readonly()
				}),
				object({
					"status": literal("unsupported").readonly(),
					"reason": string().readonly()
				}),
				object({
					"status": literal("failed").readonly(),
					"reason": string().readonly()
				})
			]).readonly(),
			"attachedAt": number().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0$schema = object({ "sessionId": intersection(string(), unknown()).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_result$schema = object({
			"files": array(object({
				"file": object({
					"attachmentId": intersection(string(), unknown()).readonly(),
					"mediaType": string().readonly(),
					"bytes": number().readonly(),
					"name": string().readonly()
				}).readonly(),
				"parsing": union([
					object({
						"status": literal("ready").readonly(),
						"kind": literal("utf8-text").readonly()
					}),
					object({
						"status": literal("ready").readonly(),
						"kind": union([
							literal("pdf"),
							literal("office-document"),
							literal("spreadsheet")
						]).readonly()
					}),
					object({
						"status": literal("unsupported").readonly(),
						"reason": string().readonly()
					}),
					object({
						"status": literal("failed").readonly(),
						"reason": string().readonly()
					})
				]).readonly(),
				"attachedAt": number().readonly()
			})).readonly(),
			"limits": object({
				"maxFileBytes": number().readonly(),
				"maxSessionFileBytes": number().readonly()
			}).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"attachmentId": string().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_result$schema = object({
			"file": object({
				"attachmentId": intersection(string(), unknown()).readonly(),
				"mediaType": string().readonly(),
				"bytes": number().readonly(),
				"name": string().readonly()
			}).readonly(),
			"text": string().readonly(),
			"truncated": boolean().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0$schema = object({
			"limit": number().readonly().optional(),
			"includeArchived": boolean().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_result$schema = array(object({
			"assetId": intersection(string(), unknown()).readonly(),
			"sessionCount": number().readonly(),
			"lastUsedAt": number().readonly(),
			"recentSessionId": intersection(string(), unknown()).readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0$schema = object({ "includeArchived": boolean().readonly().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_result$schema = array(object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"binding": object({
				"assetId": intersection(string(), unknown()).readonly(),
				"versionId": intersection(string(), unknown()).readonly(),
				"commit": intersection(string(), unknown()).readonly(),
				"treeDigest": intersection(string(), unknown()).readonly()
			}).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly(),
			"title": string().readonly().optional(),
			"cwd": string().readonly().optional(),
			"parentSessionId": intersection(string(), unknown()).readonly().optional(),
			"archived": boolean().readonly(),
			"running": boolean().readonly(),
			"runState": union([
				literal("idle"),
				literal("failed"),
				literal("completed"),
				literal("cancelled"),
				literal("running")
			]).readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0$schema = object({
			"action": union([
				literal("auto"),
				literal("list"),
				literal("verify"),
				literal("save"),
				literal("remove"),
				literal("test")
			]),
			"model": string().optional(),
			"draft": object({
				"route": union([_undefined(), string()]).optional(),
				"service": string(),
				"name": string(),
				"baseURL": string(),
				"api": string(),
				"apiKey": union([_undefined(), string()]).optional(),
				"modelIds": array(string()),
				"auto": boolean(),
				"reasoning": union([_undefined(), string()]).optional(),
				"modelsJson": union([_undefined(), string()]).optional()
			}).optional(),
			"route": string().optional(),
			"enabled": boolean().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_result$schema = object({
			"catalog": array(object({
				"id": string(),
				"name": string(),
				"api": string(),
				"variants": array(object({
					"id": string(),
					"name": string(),
					"baseURL": string(),
					"catalogProvider": string().optional()
				})),
				"docs": string(),
				"discovery": boolean(),
				"recommendations": array(object({
					"name": string(),
					"exactId": boolean(),
					"roles": array(union([
						literal("economy"),
						literal("balanced"),
						literal("frontier"),
						literal("coding"),
						literal("vision"),
						literal("long-context"),
						literal("low-latency")
					])),
					"summary": string(),
					"lifecycle": union([
						literal("stable"),
						literal("preview"),
						literal("experimental")
					]).optional(),
					"source": string(),
					"checkedAt": string()
				})).optional()
			})),
			"connections": array(object({
				"route": string(),
				"service": string(),
				"name": string(),
				"baseURL": string(),
				"api": string(),
				"configured": boolean(),
				"auto": boolean(),
				"modelIds": array(string()),
				"modelsJson": string(),
				"reasoning": string().optional(),
				"state": string(),
				"message": string()
			})),
			"verification": object({
				"state": union([
					literal("failed"),
					literal("verified"),
					literal("discovery-unavailable")
				]),
				"code": string(),
				"message": string(),
				"modelIds": array(string()),
				"modelProfiles": array(record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema24)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema24))
				]))).optional()
			}).optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"purpose": union([
				literal("ordinary"),
				literal("role-helper"),
				literal("contest"),
				literal("factor-contest")
			]).readonly(),
			"contestConversation": union([literal("main"), literal("topic")]).readonly().optional(),
			"workspaceId": intersection(string(), unknown()).readonly().optional(),
			"cwd": string().readonly().optional(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_result$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"binding": object({
				"purpose": union([
					literal("ordinary"),
					literal("role-helper"),
					literal("contest"),
					literal("factor-contest")
				]).readonly(),
				"contest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"factorContest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"contestConversation": union([
					_undefined(),
					literal("main"),
					literal("topic")
				]).readonly().optional()
			}).readonly(),
			"agentPreset": string().readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0$schema = object({ "includeArchived": boolean().readonly().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_result$schema = array(object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"binding": object({
				"purpose": union([
					literal("ordinary"),
					literal("role-helper"),
					literal("contest"),
					literal("factor-contest")
				]).readonly(),
				"contest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"factorContest": union([_undefined(), object({
					"accountId": string().readonly(),
					"contestId": string().readonly()
				})]).readonly().optional(),
				"contestConversation": union([
					_undefined(),
					literal("main"),
					literal("topic")
				]).readonly().optional()
			}).readonly(),
			"createdAt": number().readonly(),
			"updatedAt": number().readonly(),
			"title": string().readonly().optional(),
			"cwd": string().readonly().optional(),
			"parentSessionId": intersection(string(), unknown()).readonly().optional(),
			"archived": boolean().readonly(),
			"running": boolean().readonly(),
			"runState": union([
				literal("idle"),
				literal("failed"),
				literal("completed"),
				literal("cancelled"),
				literal("running")
			]).readonly()
		}));
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0$schema = object({ "sessionId": intersection(string(), unknown()).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_result$schema = object({ "forms": array(object({
			"assetId": intersection(string(), unknown()).readonly(),
			"versionId": intersection(string(), unknown()).readonly(),
			"source": union([literal("skill"), literal("agent")]).readonly(),
			"promptForm": union([object({
				"status": literal("ready").readonly(),
				"form": object({
					"version": literal(1).readonly(),
					"task": object({
						"placeholder": string().readonly().optional(),
						"required": boolean().readonly().optional()
					}).readonly().optional(),
					"fields": array(object({
						"key": string().readonly(),
						"label": string().readonly(),
						"type": union([
							literal("number"),
							literal("text"),
							literal("textarea"),
							literal("select"),
							literal("date")
						]).readonly(),
						"required": boolean().readonly().optional(),
						"placeholder": string().readonly().optional(),
						"help": string().readonly().optional(),
						"default": union([string(), number()]).readonly().optional(),
						"options": array(object({
							"label": string().readonly(),
							"value": string().readonly()
						})).readonly().optional()
					})).readonly(),
					"promptTemplate": string().readonly()
				}).readonly(),
				"adaptations": array(object({
					"code": literal("number-default-string").readonly(),
					"fieldKey": string().readonly()
				})).readonly().optional()
			}), object({
				"status": literal("invalid").readonly(),
				"reason": string().readonly()
			})]).readonly()
		})).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"versionId": intersection(string(), unknown()).readonly(),
			"task": string().readonly().optional(),
			"values": record(string(), union([string(), number()])).readonly().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_result$schema = object({ "text": string().readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"versionId": intersection(string(), unknown()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_result$schema = object({ "skills": array(object({
			"assetId": intersection(string(), unknown()).readonly(),
			"versionId": intersection(string(), unknown()).readonly(),
			"commit": intersection(string(), unknown()).readonly(),
			"treeDigest": intersection(string(), unknown()).readonly()
		})).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"assetId": intersection(string(), unknown()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_result$schema = object({ "skills": array(object({
			"assetId": intersection(string(), unknown()).readonly(),
			"versionId": intersection(string(), unknown()).readonly(),
			"commit": intersection(string(), unknown()).readonly(),
			"treeDigest": intersection(string(), unknown()).readonly()
		})).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0$schema = object({ "sessionId": intersection(string(), unknown()).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_result$schema = object({ "results": array(union([object({
			"status": literal("ready").readonly(),
			"inputPath": string().readonly(),
			"path": string().readonly(),
			"archived": boolean().readonly()
		}), object({
			"status": literal("unavailable").readonly(),
			"inputPath": string().readonly(),
			"reason": string().readonly()
		})])).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"paths": array(string()).readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_result$schema = object({ "results": array(union([object({
			"status": literal("ready").readonly(),
			"inputPath": string().readonly(),
			"path": string().readonly(),
			"archived": boolean().readonly()
		}), object({
			"status": literal("unavailable").readonly(),
			"inputPath": string().readonly(),
			"reason": string().readonly()
		})])).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0$schema = object({
			"sessionId": intersection(string(), unknown()).readonly(),
			"path": string().readonly()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_result$schema = union([
			object({
				"kind": literal("directory").readonly(),
				"path": string().readonly(),
				"bytes": literal(0).readonly(),
				"entries": array(object({
					"name": string().readonly(),
					"path": string().readonly(),
					"type": union([literal("file"), literal("directory")]).readonly(),
					"bytes": number().readonly().optional()
				})).readonly()
			}),
			object({
				"kind": literal("text").readonly(),
				"path": string().readonly(),
				"mediaType": string().readonly(),
				"bytes": number().readonly(),
				"text": string().readonly()
			}),
			object({
				"kind": literal("document").readonly(),
				"path": string().readonly(),
				"mediaType": string().readonly(),
				"bytes": number().readonly(),
				"text": string().readonly(),
				"truncated": boolean().readonly()
			}),
			object({
				"kind": literal("binary").readonly(),
				"path": string().readonly(),
				"mediaType": union([
					literal("application/pdf"),
					literal("image/png"),
					literal("image/jpeg"),
					literal("image/gif"),
					literal("image/webp")
				]).readonly(),
				"bytes": number().readonly(),
				"data": string().readonly(),
				"url": string().readonly().optional()
			}),
			object({
				"kind": literal("resource").readonly(),
				"path": string().readonly(),
				"mediaType": string().readonly(),
				"bytes": number().readonly(),
				"url": string().readonly(),
				"presentation": union([
					literal("text"),
					literal("pdf"),
					literal("image"),
					literal("audio"),
					literal("video"),
					literal("external")
				]).readonly()
			}),
			object({
				"kind": literal("unsupported").readonly(),
				"path": string().readonly(),
				"bytes": number().readonly(),
				"reason": string().readonly()
			})
		]);
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0$schema = object({ "sessionId": intersection(string(), unknown()).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_result$schema = object({ "sessionId": intersection(string(), unknown()).readonly() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0$schema = object({ "preferredWorkspaceId": intersection(string(), unknown()).readonly().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_result$schema = object({
			"workspace": object({
				"workspaceId": intersection(string(), unknown()).readonly(),
				"path": string().readonly(),
				"title": string().readonly()
			}).readonly(),
			"source": union([literal("preferred"), literal("managed")]).readonly(),
			"recoveredPreferredWorkspaceId": intersection(string(), unknown()).readonly().optional()
		});
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0$schema = object({ "preferredWorkspaceId": intersection(string(), unknown()).readonly().optional() });
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_result$schema = object({
			"managedPath": string().readonly(),
			"managedWorkspace": object({
				"workspaceId": intersection(string(), unknown()).readonly(),
				"path": string().readonly(),
				"title": string().readonly()
			}).readonly().optional(),
			"preferredWorkspace": object({
				"workspaceId": intersection(string(), unknown()).readonly(),
				"path": string().readonly(),
				"title": string().readonly()
			}).readonly().optional(),
			"preferredMissing": boolean().readonly()
		});
		const TYPERT_REMOTE$1 = {
			package: "@deepseek-ai/dsh-quantskills-session",
			descriptors: [
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentCreate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentCreate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDefinition",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1730,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentDelete",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentDelete",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDeleteRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentDelete:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1832,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentLibrarySources",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentLibrarySources",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentLibrarySources:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentLibrarySources_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1718,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentList",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentList:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1706,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentSessionCreate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentSessionCreate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1871,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentSessionList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentSessionList",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentSessionList:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2119,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamCreate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentTeamCreate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDefinition",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2141,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamDelete",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentTeamDelete",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDeleteRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamDelete:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2193,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentTeamList",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamList:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2131,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamSessionCreate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentTeamSessionCreate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamSessionCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamSessionCreateResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2211,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamSessionList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentTeamSessionList",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamSessionList:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2290,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamUpdate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentTeamUpdate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamUpdateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDefinition",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2163,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentUninstall",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentUninstall",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDeleteRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentUninstall:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1848,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentUpdate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "agentUpdate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentUpdateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDefinition",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1788,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/authoringCommit",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "authoringCommit",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringCommitRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringCommitResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1899,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/authoringSessionCreate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "authoringSessionCreate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringSessionCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1885,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestCheckUpdate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestCheckUpdate",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestCheckUpdate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1260,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestConnect",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestConnect",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestConnect_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1254,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestDisconnect",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestDisconnect",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDisconnect_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1257,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestDismiss",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestDismiss",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestDismiss:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1315,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestExecute",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestExecute",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestExecute:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestPlan",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1310,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestInspect",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestInspect",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestInspect:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestInspection",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1270,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestMode",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestMode",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestMode:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1251,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestQuery",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestQuery",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestQuery",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestData",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1266,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestReconcile",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestReconcile",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestReconcile:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestPlan",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1320,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestSessionOpen",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestSessionOpen",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1279,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestStatus",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestStatus",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestStatus:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1247,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestUpdate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "contestUpdate",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestUpdate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1263,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/create",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "create",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionCreateResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1452,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorCheckUpdate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorCheckUpdate",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorCheckUpdate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1186,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConfirm",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorConfirm",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConfirm:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorPlan",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1214,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConnect",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorConnect",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConnect:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1180,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDisconnect",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorDisconnect",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDisconnect_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1183,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDismiss",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorDismiss",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDismiss:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDismiss:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1217,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorInspect",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorInspect",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorInspect:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorInspection",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1192,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorMode",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorMode",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorMode:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1177,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorPrepare",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorPrepare",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorPrepare:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorPlan",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1208,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorQuery",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorQuery",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorQuery",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-util-values#JsonValue",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1205,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcilePlan",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorReconcilePlan",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcilePlan:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorPlan",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1226,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcileRun",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorReconcileRun",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcileRun:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorRun",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1223,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorSessionOpen",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorSessionOpen",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1229,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStatus",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorStatus",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStatus:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1174,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStopBudget",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorStopBudget",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStopBudget:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStopBudget:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1220,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorUpdate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "factorUpdate",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorUpdate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1189,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/fileAttach",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "fileAttach",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileAttachRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionFileAttachment",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2306,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/fileList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "fileList",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileListRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileListResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2340,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/fileRead",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "fileRead",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileReadRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileReadResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2358,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/frequent",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "frequent",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFrequentRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/frequent:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1559,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/list",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "list",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/list:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1530,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/modelsAccess",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "modelsAccess",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ModelAccessRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ModelAccessResponse",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 919,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/plainSessionCreate",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "plainSessionCreate",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPlainSessionCreateRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPlainSessionCreateResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1373,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/plainSessionList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "plainSessionList",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/plainSessionList:result",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1545,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/promptFormList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "promptFormList",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormListRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormListResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1665,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/promptFormRender",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "promptFormRender",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormRenderRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormRenderResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1681,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/residentSkillAttach",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "residentSkillAttach",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillAttachRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1594,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/residentSkillDetach",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "residentSkillDetach",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillDetachRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1638,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/resultList",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "resultList",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/resultList:request",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2420,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/resultPrepare",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "resultPrepare",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2375,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/resultPreview",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "resultPreview",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPreviewRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPreview",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2439,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/sessionEnsure",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "sessionEnsure",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionEnsureRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionEnsureResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1331,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/workspaceResolve",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "workspaceResolve",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceResolveResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1168,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/workspaceStatus",
					service: "quantSkillsSessions",
					namespace: "quantSkillsSessions",
					method: "workspaceStatus",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceRequest",
							schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceStatusResult",
						schema: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_result$schema
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1158,
						"column": 3
					}
				}
			]
		};
		//#endregion
		//#region ../panda-mcp/lib/typert.remote-client.js
		const JsonValueRemoteCodec$schema = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema))
		]);
		const JsonValueRemoteCodec$schema2 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema2)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema2))
		]);
		const JsonValueRemoteCodec$schema3 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema3)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema3))
		]);
		const JsonValueRemoteCodec$schema4 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema4)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema4))
		]);
		const JsonValueRemoteCodec$schema5 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema5)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema5))
		]);
		const JsonValueRemoteCodec$schema6 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema6)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema6))
		]);
		const JsonValueRemoteCodec$schema7 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema7)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema7))
		]);
		const JsonValueRemoteCodec$schema8 = union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => JsonValueRemoteCodec$schema8)),
			record(string(), lazy(() => JsonValueRemoteCodec$schema8))
		]);
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_authenticate_result$schema = object({
			"ok": literal(true).readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("needs_auth"),
				literal("error")
			]).readonly(),
			"url": string().readonly(),
			"toolCount": number().readonly(),
			"toolNames": array(string()).readonly(),
			"message": string().readonly(),
			"authorizationUrl": string().readonly().optional()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0$schema = object({
			"id": string(),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			])
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_result$schema = object({
			"id": string(),
			"kind": union([literal("timeseries"), literal("table")]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]),
			"columns": array(string()),
			"rowCount": number(),
			"fetchedAt": string(),
			"expiresAt": string(),
			"from": string().optional(),
			"to": string().optional(),
			"bytes": number(),
			"name": string(),
			"source": object({
				"kind": union([
					literal("file"),
					literal("http"),
					literal("pandadata")
				]),
				"url": string().optional(),
				"method": string().optional(),
				"params": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema8)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema8))
				])).optional(),
				"filename": string().optional()
			}),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0$schema = object({
			"name": string(),
			"source": object({
				"kind": union([
					literal("file"),
					literal("http"),
					literal("pandadata")
				]),
				"url": string().optional(),
				"method": string().optional(),
				"params": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema3)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema3))
				])).optional(),
				"filename": string().optional()
			}),
			"kind": union([
				literal("timeseries"),
				literal("table"),
				literal("auto")
			]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]).optional(),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_result$schema = object({
			"id": string(),
			"kind": union([literal("timeseries"), literal("table")]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]),
			"columns": array(string()),
			"rowCount": number(),
			"fetchedAt": string(),
			"expiresAt": string(),
			"from": string().optional(),
			"to": string().optional(),
			"bytes": number(),
			"name": string(),
			"source": object({
				"kind": union([
					literal("file"),
					literal("http"),
					literal("pandadata")
				]),
				"url": string().optional(),
				"method": string().optional(),
				"params": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema4)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema4))
				])).optional(),
				"filename": string().optional()
			}),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0$schema = object({
			"name": string(),
			"format": union([literal("csv"), literal("json")]),
			"content": string(),
			"kind": union([
				literal("timeseries"),
				literal("table"),
				literal("auto")
			]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]).optional(),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_result$schema = object({
			"id": string(),
			"kind": union([literal("timeseries"), literal("table")]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]),
			"columns": array(string()),
			"rowCount": number(),
			"fetchedAt": string(),
			"expiresAt": string(),
			"from": string().optional(),
			"to": string().optional(),
			"bytes": number(),
			"name": string(),
			"source": object({
				"kind": union([
					literal("file"),
					literal("http"),
					literal("pandadata")
				]),
				"url": string().optional(),
				"method": string().optional(),
				"params": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema2)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema2))
				])).optional(),
				"filename": string().optional()
			}),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseList_result$schema = array(object({
			"id": string(),
			"kind": union([literal("timeseries"), literal("table")]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]),
			"columns": array(string()),
			"rowCount": number(),
			"fetchedAt": string(),
			"expiresAt": string(),
			"from": string().optional(),
			"to": string().optional(),
			"bytes": number(),
			"name": string(),
			"source": object({
				"kind": union([
					literal("file"),
					literal("http"),
					literal("pandadata")
				]),
				"url": string().optional(),
				"method": string().optional(),
				"params": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema))
				])).optional(),
				"filename": string().optional()
			}),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		}));
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0$schema = object({ "id": string() });
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_result$schema = object({
			"dataset": object({
				"id": string(),
				"kind": union([literal("timeseries"), literal("table")]),
				"category": union([
					literal("market"),
					literal("news"),
					literal("fundamental"),
					literal("other")
				]),
				"columns": array(string()),
				"rowCount": number(),
				"fetchedAt": string(),
				"expiresAt": string(),
				"from": string().optional(),
				"to": string().optional(),
				"bytes": number(),
				"name": string(),
				"source": object({
					"kind": union([
						literal("file"),
						literal("http"),
						literal("pandadata")
					]),
					"url": string().optional(),
					"method": string().optional(),
					"params": record(string(), union([
						literal(null),
						string(),
						number(),
						literal(false),
						literal(true),
						array(lazy(() => JsonValueRemoteCodec$schema6)),
						record(string(), lazy(() => JsonValueRemoteCodec$schema6))
					])).optional(),
					"filename": string().optional()
				}),
				"dateColumn": string().optional(),
				"ttlSeconds": number()
			}),
			"status": union([
				literal("hit"),
				literal("refreshed"),
				literal("insufficient")
			]),
			"reasons": array(string()),
			"rows": array(record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema6)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema6))
			]))),
			"total": number(),
			"nextOffset": number().optional()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0$schema = object({
			"id": string(),
			"from": string().optional(),
			"to": string().optional(),
			"minRows": number().optional(),
			"limit": number().optional(),
			"offset": number().optional(),
			"refresh": boolean().optional()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_result$schema = object({
			"dataset": object({
				"id": string(),
				"kind": union([literal("timeseries"), literal("table")]),
				"category": union([
					literal("market"),
					literal("news"),
					literal("fundamental"),
					literal("other")
				]),
				"columns": array(string()),
				"rowCount": number(),
				"fetchedAt": string(),
				"expiresAt": string(),
				"from": string().optional(),
				"to": string().optional(),
				"bytes": number(),
				"name": string(),
				"source": object({
					"kind": union([
						literal("file"),
						literal("http"),
						literal("pandadata")
					]),
					"url": string().optional(),
					"method": string().optional(),
					"params": record(string(), union([
						literal(null),
						string(),
						number(),
						literal(false),
						literal(true),
						array(lazy(() => JsonValueRemoteCodec$schema5)),
						record(string(), lazy(() => JsonValueRemoteCodec$schema5))
					])).optional(),
					"filename": string().optional()
				}),
				"dateColumn": string().optional(),
				"ttlSeconds": number()
			}),
			"status": union([
				literal("hit"),
				literal("refreshed"),
				literal("insufficient")
			]),
			"reasons": array(string()),
			"rows": array(record(string(), union([
				literal(null),
				string(),
				number(),
				literal(false),
				literal(true),
				array(lazy(() => JsonValueRemoteCodec$schema5)),
				record(string(), lazy(() => JsonValueRemoteCodec$schema5))
			]))),
			"total": number(),
			"nextOffset": number().optional()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0$schema = object({ "id": string() });
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_result$schema = object({
			"id": string(),
			"kind": union([literal("timeseries"), literal("table")]),
			"category": union([
				literal("market"),
				literal("news"),
				literal("fundamental"),
				literal("other")
			]),
			"columns": array(string()),
			"rowCount": number(),
			"fetchedAt": string(),
			"expiresAt": string(),
			"from": string().optional(),
			"to": string().optional(),
			"bytes": number(),
			"name": string(),
			"source": object({
				"kind": union([
					literal("file"),
					literal("http"),
					literal("pandadata")
				]),
				"url": string().optional(),
				"method": string().optional(),
				"params": record(string(), union([
					literal(null),
					string(),
					number(),
					literal(false),
					literal(true),
					array(lazy(() => JsonValueRemoteCodec$schema7)),
					record(string(), lazy(() => JsonValueRemoteCodec$schema7))
				])).optional(),
				"filename": string().optional()
			}),
			"dateColumn": string().optional(),
			"ttlSeconds": number()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0$schema = object({ "id": string() });
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_result$schema = _void();
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_logout_result$schema = object({
			"ok": literal(true).readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("needs_auth"),
				literal("error")
			]).readonly(),
			"url": string().readonly(),
			"toolCount": number().readonly(),
			"toolNames": array(string()).readonly(),
			"message": string().readonly(),
			"authorizationUrl": string().readonly().optional()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_refresh_result$schema = object({
			"ok": literal(true).readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("needs_auth"),
				literal("error")
			]).readonly(),
			"url": string().readonly(),
			"toolCount": number().readonly(),
			"toolNames": array(string()).readonly(),
			"message": string().readonly(),
			"authorizationUrl": string().readonly().optional()
		});
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_status_result$schema = object({
			"ok": literal(true).readonly(),
			"phase": union([
				literal("disconnected"),
				literal("authenticating"),
				literal("connected"),
				literal("needs_auth"),
				literal("error")
			]).readonly(),
			"url": string().readonly(),
			"toolCount": number().readonly(),
			"toolNames": array(string()).readonly(),
			"message": string().readonly(),
			"authorizationUrl": string().readonly().optional()
		});
		const TYPERT_REMOTE = {
			package: "@deepseek-ai/dsh-panda-mcp",
			descriptors: [
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/authenticate",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "authenticate",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_authenticate_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 275,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseCategorize",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseCategorize",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseCategorize:input",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 248,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseFetch",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseFetch",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataFetch",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 238,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseImport",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseImport",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataImport",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 236,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseList",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseList",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseList:result",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseList_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 234,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databasePreview",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databasePreview",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databasePreview:input",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataResult",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 242,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseQuery",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseQuery",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataQuery",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataResult",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 240,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRefresh",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseRefresh",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRefresh:input",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 244,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRemove",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "databaseRemove",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRemove:input",
							schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRemove:result",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 246,
						"column": 3
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/logout",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "logout",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_logout_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 302,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/refresh",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "refresh",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_refresh_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 284,
						"column": 9
					}
				},
				{
					id: "@deepseek-ai/dsh-panda-mcp#pandaMcp/status",
					service: "pandaMcp",
					namespace: "pandaMcp",
					method: "status",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						schema: _deepseek_ai_dsh_panda_mcp_pandaMcp_status_result$schema
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 269,
						"column": 3
					}
				}
			]
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Client assembly for the generated QuantSkills Host Remote contributions. */
		/** Base Remote service required before generated namespaces can mount. */
		const inject = ["remote"];
		/**
		* Mount the generated QuantSkills Remote namespaces before the UI requests them.
		* @param ctx - Client Cordis root carrying the typed Remote service.
		* @returns disposer that unmounts every namespace in reverse order.
		*/
		async function apply(ctx) {
			const disposers = [];
			try {
				for (const contribution of [
					TYPERT_REMOTE$2,
					TYPERT_REMOTE$1,
					TYPERT_REMOTE
				]) disposers.push(await ctx.remote.$mount(contribution));
			} catch (error) {
				for (const dispose of disposers.reverse()) await dispose();
				throw error;
			}
			return async () => {
				for (const dispose of disposers.reverse()) await dispose();
			};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map