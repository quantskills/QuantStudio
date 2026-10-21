window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-remotes-quantskills",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let zod = require("zod");
		//#region ../../node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
		/** Lazy assembly of generated Remote definitions using caller-supplied Zod; no runtime imports. */
		/**
		* Retain one generated definition per endpoint without constructing parsers or projections.
		* The class instance builds its shared descriptor/method index on first access;
		* input schemas and JSON Schema projections are cached only when requested.
		* @param spec - compiler-produced method facts and Zod factories.
		* @param zod - the generated artifact's Zod runtime for named-input parsers.
		* @returns a lazy, mountable info instance with no registration or transport effects.
		*/
		function createTypertRemoteInfo(spec, zod) {
			return new RemoteInfo(spec, zod);
		}
		var RemoteInfo = class {
			spec;
			zod;
			index;
			constructor(spec, zod) {
				this.spec = spec;
				this.zod = zod;
			}
			get package() {
				return this.spec.package;
			}
			get descriptors() {
				return this.resolve().descriptors;
			}
			get methods() {
				return this.resolve().methods;
			}
			resolve() {
				if (this.index !== void 0) return this.index;
				const zod = this.zod;
				const descriptors = [];
				const methods = Object.create(null);
				for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
					const separator = endpoint.indexOf("/");
					const namespace = endpoint.slice(0, separator);
					const method = endpoint.slice(separator + 1);
					const parameters = definition.parameters.map((parameter) => ({
						...parameter,
						wire: parameter.wire ?? parameter.name
					}));
					const descriptor = {
						...definition,
						id: `${this.spec.package}#${endpoint}`,
						namespace,
						method,
						parameters,
						result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
					};
					if (definition.invocation.kind === "direct") {
						const inputs = [];
						methods[endpoint] = Object.assign(descriptor, {
							input(options) {
								const strict = options?.strict === true;
								return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
							},
							invoke(remote, input, signal) {
								const named = input;
								const values = parameters.map((parameter) => named[parameter.wire]);
								if (definition.cancellation !== void 0) values.push(signal);
								const receiver = Reflect.get(remote, namespace);
								return Reflect.get(receiver, method).apply(receiver, values);
							}
						});
					}
					descriptors.push(descriptor);
				}
				return this.index = {
					descriptors,
					methods
				};
			}
		};
		function optional(parameter) {
			return parameter.source === "json" && parameter.acceptsUndefined === true;
		}
		var NamedInput = class {
			parameters;
			strict;
			zod;
			schema;
			projection;
			constructor(parameters, strict, zod) {
				this.parameters = parameters;
				this.strict = strict;
				this.zod = zod;
			}
			codec(parameter) {
				return this.strict ? parameter.strictCodec : parameter.codec;
			}
			create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
				const value = this.codec(parameter).create();
				return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
			})));
			get jsonSchema() {
				return this.project().jsonSchema;
			}
			get jsonSchemaError() {
				return this.project().jsonSchemaError;
			}
			project() {
				if (this.projection !== void 0) return this.projection;
				const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
				if (unavailable !== void 0) return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
				return this.projection = { jsonSchema: {
					type: "object",
					properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
						...this.codec(parameter).jsonSchema,
						...parameter.description === void 0 ? {} : { description: parameter.description }
					}])),
					required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
					additionalProperties: false
				} };
			}
		};
		var ResultValue = class {
			spec;
			projection;
			constructor(spec) {
				this.spec = spec;
			}
			get mode() {
				return this.spec.mode;
			}
			get typeSymbol() {
				return this.spec.typeSymbol;
			}
			get create() {
				return this.spec.create;
			}
			get decode() {
				return this.spec.decode;
			}
			get encode() {
				return this.spec.encode;
			}
			get description() {
				return this.spec.description;
			}
			get jsonSchemaError() {
				return this.spec.jsonSchemaError;
			}
			get jsonSchema() {
				if (this.projection === void 0) {
					const schema = this.spec.jsonSchema;
					this.projection = { value: schema === void 0 ? void 0 : {
						...schema,
						description: this.spec.description
					} };
				}
				return this.projection.value;
			}
		};
		//#endregion
		//#region ../quantskills-host/lib/typert.remote-client.js
		let _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0$schema$value ??= zod.z.string();
		let _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_result$schema$value ??= zod.z.object({
			"version": zod.z.object({
				"versionId": zod.z.string().readonly(),
				"assetId": zod.z.string().readonly(),
				"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
				"repository": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
				"treeDigest": zod.z.string().readonly(),
				"fileCount": zod.z.number().readonly(),
				"totalBytes": zod.z.number().readonly(),
				"installedAt": zod.z.number().readonly(),
				"exposure": zod.z.union([zod.z.literal("skill-registry"), zod.z.literal("agent-template")]).readonly().describe("Skills are registry-visible; Agents expose a validated user-Agent template."),
				"origin": zod.z.union([zod.z.literal("catalog"), zod.z.literal("local-authoring")]).readonly().describe("Publication owner for this immutable version."),
				"declarationTitleZh": zod.z.string().readonly().optional().describe("Chinese H1 read from this exact installed declaration, when present.")
			}).readonly(),
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"instructions": zod.z.string().readonly(),
			"requires": zod.z.array(zod.z.string()).readonly(),
			"promptForm": zod.z.union([zod.z.object({
				"status": zod.z.literal("ready").readonly(),
				"form": zod.z.object({
					"version": zod.z.literal(1).readonly(),
					"task": zod.z.object({
						"placeholder": zod.z.string().readonly().optional(),
						"required": zod.z.boolean().readonly().optional()
					}).readonly().optional(),
					"fields": zod.z.array(zod.z.object({
						"key": zod.z.string().readonly(),
						"label": zod.z.string().readonly(),
						"type": zod.z.union([
							zod.z.literal("number"),
							zod.z.literal("text"),
							zod.z.literal("textarea"),
							zod.z.literal("select"),
							zod.z.literal("date")
						]).readonly(),
						"required": zod.z.boolean().readonly().optional(),
						"placeholder": zod.z.string().readonly().optional(),
						"help": zod.z.string().readonly().optional(),
						"default": zod.z.union([zod.z.string(), zod.z.number()]).readonly().optional(),
						"options": zod.z.array(zod.z.object({
							"value": zod.z.string().readonly(),
							"label": zod.z.string().readonly()
						})).readonly().optional()
					})).readonly(),
					"promptTemplate": zod.z.string().readonly()
				}).readonly(),
				"adaptations": zod.z.array(zod.z.object({
					"code": zod.z.literal("number-default-string").readonly(),
					"fieldKey": zod.z.string().readonly()
				})).readonly().optional()
			}), zod.z.object({
				"status": zod.z.literal("invalid").readonly(),
				"reason": zod.z.string().readonly()
			})]).readonly().optional().describe("Optional form metadata parsed independently from the literal Agent instructions.")
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0$schema$value ??= zod.z.object({ "source": zod.z.union([zod.z.literal("github"), zod.z.literal("gitee")]).readonly() });
		let _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_result$schema$value ??= zod.z.object({
			"accepted": zod.z.union([zod.z.literal("started"), zod.z.literal("reused")]).readonly(),
			"status": zod.z.object({
				"state": zod.z.union([
					zod.z.literal("idle"),
					zod.z.literal("checking"),
					zod.z.literal("current"),
					zod.z.literal("available"),
					zod.z.literal("preparing"),
					zod.z.literal("ready"),
					zod.z.literal("blocked"),
					zod.z.literal("failed")
				]).readonly(),
				"source": zod.z.union([zod.z.literal("github"), zod.z.literal("gitee")]).readonly().optional().describe("Official Git service used by the active or latest completed operation."),
				"currentVersion": zod.z.string().readonly().optional().describe("Installed application SemVer read from the active package manifest."),
				"currentCommit": zod.z.string().readonly().optional(),
				"candidateVersion": zod.z.string().readonly().optional().describe("Newest published stable SemVer selected from an official `vX.Y.Z` Git tag."),
				"candidateCommit": zod.z.string().readonly().optional(),
				"releaseNotes": zod.z.array(zod.z.string()).readonly().optional().describe("Release notes read from the exact candidate commit."),
				"phase": zod.z.union([
					zod.z.literal("fetching"),
					zod.z.literal("installing"),
					zod.z.literal("verifying")
				]).readonly().optional(),
				"checkedAt": zod.z.number().readonly().optional(),
				"errorCode": zod.z.union([
					zod.z.literal("CATALOG_FETCH_FAILED"),
					zod.z.literal("CATALOG_INVALID"),
					zod.z.literal("CATALOG_STALE"),
					zod.z.literal("ASSET_NOT_FOUND"),
					zod.z.literal("ASSET_README_FETCH_FAILED"),
					zod.z.literal("ASSET_README_NOT_FOUND"),
					zod.z.literal("ASSET_README_INVALID"),
					zod.z.literal("INSTALL_INVALID_TREE"),
					zod.z.literal("INSTALL_LIMIT_EXCEEDED"),
					zod.z.literal("INSTALL_GIT_FAILED"),
					zod.z.literal("INSTALL_EXPOSURE_FAILED"),
					zod.z.literal("INSTALL_RECORD_CORRUPT"),
					zod.z.literal("INSTALL_WRITE_FAILED"),
					zod.z.literal("INSTALLED_VERSION_NOT_FOUND"),
					zod.z.literal("INSTALLED_VERSION_NOT_SKILL"),
					zod.z.literal("INSTALLED_VERSION_NOT_AGENT"),
					zod.z.literal("APPLICATION_UPDATE_CHECK_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_NOT_AVAILABLE"),
					zod.z.literal("APPLICATION_UPDATE_DOWNLOAD_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_INSTALL_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_VERIFY_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_STATE_CORRUPT"),
					zod.z.literal("APPLICATION_UPDATE_PATH_INVALID"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_DIRTY"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_REMOTE"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_BRANCH"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_AHEAD"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_DIVERGED")
				]).readonly().optional()
			}).readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStart_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStart_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStart_result$schema$value ??= zod.z.object({
			"accepted": zod.z.union([zod.z.literal("started"), zod.z.literal("reused")]).readonly(),
			"status": zod.z.object({
				"state": zod.z.union([
					zod.z.literal("idle"),
					zod.z.literal("checking"),
					zod.z.literal("current"),
					zod.z.literal("available"),
					zod.z.literal("preparing"),
					zod.z.literal("ready"),
					zod.z.literal("blocked"),
					zod.z.literal("failed")
				]).readonly(),
				"source": zod.z.union([zod.z.literal("github"), zod.z.literal("gitee")]).readonly().optional().describe("Official Git service used by the active or latest completed operation."),
				"currentVersion": zod.z.string().readonly().optional().describe("Installed application SemVer read from the active package manifest."),
				"currentCommit": zod.z.string().readonly().optional(),
				"candidateVersion": zod.z.string().readonly().optional().describe("Newest published stable SemVer selected from an official `vX.Y.Z` Git tag."),
				"candidateCommit": zod.z.string().readonly().optional(),
				"releaseNotes": zod.z.array(zod.z.string()).readonly().optional().describe("Release notes read from the exact candidate commit."),
				"phase": zod.z.union([
					zod.z.literal("fetching"),
					zod.z.literal("installing"),
					zod.z.literal("verifying")
				]).readonly().optional(),
				"checkedAt": zod.z.number().readonly().optional(),
				"errorCode": zod.z.union([
					zod.z.literal("CATALOG_FETCH_FAILED"),
					zod.z.literal("CATALOG_INVALID"),
					zod.z.literal("CATALOG_STALE"),
					zod.z.literal("ASSET_NOT_FOUND"),
					zod.z.literal("ASSET_README_FETCH_FAILED"),
					zod.z.literal("ASSET_README_NOT_FOUND"),
					zod.z.literal("ASSET_README_INVALID"),
					zod.z.literal("INSTALL_INVALID_TREE"),
					zod.z.literal("INSTALL_LIMIT_EXCEEDED"),
					zod.z.literal("INSTALL_GIT_FAILED"),
					zod.z.literal("INSTALL_EXPOSURE_FAILED"),
					zod.z.literal("INSTALL_RECORD_CORRUPT"),
					zod.z.literal("INSTALL_WRITE_FAILED"),
					zod.z.literal("INSTALLED_VERSION_NOT_FOUND"),
					zod.z.literal("INSTALLED_VERSION_NOT_SKILL"),
					zod.z.literal("INSTALLED_VERSION_NOT_AGENT"),
					zod.z.literal("APPLICATION_UPDATE_CHECK_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_NOT_AVAILABLE"),
					zod.z.literal("APPLICATION_UPDATE_DOWNLOAD_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_INSTALL_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_VERIFY_FAILED"),
					zod.z.literal("APPLICATION_UPDATE_STATE_CORRUPT"),
					zod.z.literal("APPLICATION_UPDATE_PATH_INVALID"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_DIRTY"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_REMOTE"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_BRANCH"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_AHEAD"),
					zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_DIVERGED")
				]).readonly().optional()
			}).readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStatus_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStatus_result$schema$value ??= zod.z.object({
			"state": zod.z.union([
				zod.z.literal("idle"),
				zod.z.literal("checking"),
				zod.z.literal("current"),
				zod.z.literal("available"),
				zod.z.literal("preparing"),
				zod.z.literal("ready"),
				zod.z.literal("blocked"),
				zod.z.literal("failed")
			]).readonly(),
			"source": zod.z.union([zod.z.literal("github"), zod.z.literal("gitee")]).readonly().optional().describe("Official Git service used by the active or latest completed operation."),
			"currentVersion": zod.z.string().readonly().optional().describe("Installed application SemVer read from the active package manifest."),
			"currentCommit": zod.z.string().readonly().optional(),
			"candidateVersion": zod.z.string().readonly().optional().describe("Newest published stable SemVer selected from an official `vX.Y.Z` Git tag."),
			"candidateCommit": zod.z.string().readonly().optional(),
			"releaseNotes": zod.z.array(zod.z.string()).readonly().optional().describe("Release notes read from the exact candidate commit."),
			"phase": zod.z.union([
				zod.z.literal("fetching"),
				zod.z.literal("installing"),
				zod.z.literal("verifying")
			]).readonly().optional(),
			"checkedAt": zod.z.number().readonly().optional(),
			"errorCode": zod.z.union([
				zod.z.literal("CATALOG_FETCH_FAILED"),
				zod.z.literal("CATALOG_INVALID"),
				zod.z.literal("CATALOG_STALE"),
				zod.z.literal("ASSET_NOT_FOUND"),
				zod.z.literal("ASSET_README_FETCH_FAILED"),
				zod.z.literal("ASSET_README_NOT_FOUND"),
				zod.z.literal("ASSET_README_INVALID"),
				zod.z.literal("INSTALL_INVALID_TREE"),
				zod.z.literal("INSTALL_LIMIT_EXCEEDED"),
				zod.z.literal("INSTALL_GIT_FAILED"),
				zod.z.literal("INSTALL_EXPOSURE_FAILED"),
				zod.z.literal("INSTALL_RECORD_CORRUPT"),
				zod.z.literal("INSTALL_WRITE_FAILED"),
				zod.z.literal("INSTALLED_VERSION_NOT_FOUND"),
				zod.z.literal("INSTALLED_VERSION_NOT_SKILL"),
				zod.z.literal("INSTALLED_VERSION_NOT_AGENT"),
				zod.z.literal("APPLICATION_UPDATE_CHECK_FAILED"),
				zod.z.literal("APPLICATION_UPDATE_NOT_AVAILABLE"),
				zod.z.literal("APPLICATION_UPDATE_DOWNLOAD_FAILED"),
				zod.z.literal("APPLICATION_UPDATE_INSTALL_FAILED"),
				zod.z.literal("APPLICATION_UPDATE_VERIFY_FAILED"),
				zod.z.literal("APPLICATION_UPDATE_STATE_CORRUPT"),
				zod.z.literal("APPLICATION_UPDATE_PATH_INVALID"),
				zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_DIRTY"),
				zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_REMOTE"),
				zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_BRANCH"),
				zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_AHEAD"),
				zod.z.literal("APPLICATION_UPDATE_DEVELOPMENT_DIVERGED")
			]).readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0$schema$value ??= zod.z.object({
			"assetId": zod.z.string().readonly(),
			"observedSnapshotId": zod.z.string().readonly(),
			"observedCommit": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_result$schema$value ??= zod.z.object({
			"assetId": zod.z.string().readonly(),
			"commit": zod.z.string().readonly(),
			"path": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("README.md")]).readonly(),
			"markdown": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_catalog_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_catalog_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_catalog_result$schema$value ??= zod.z.object({
			"snapshotId": zod.z.string().readonly(),
			"refreshAfterMs": zod.z.number().readonly().describe("Host-configured delay before the Client checks the official catalog again."),
			"categories": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"labelEn": zod.z.string().readonly(),
				"labelZh": zod.z.string().readonly(),
				"subcategories": zod.z.array(zod.z.object({
					"id": zod.z.string().readonly(),
					"labelEn": zod.z.string().readonly(),
					"labelZh": zod.z.string().readonly()
				})).readonly()
			})).readonly(),
			"assets": zod.z.array(zod.z.object({
				"assetId": zod.z.string().readonly(),
				"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
				"repository": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
				"displayNames": zod.z.object({
					"zhCN": zod.z.string().readonly(),
					"en": zod.z.string().readonly().optional()
				}).readonly(),
				"aliases": zod.z.array(zod.z.string()).readonly(),
				"nameSource": zod.z.union([
					zod.z.literal("catalog"),
					zod.z.literal("declaration"),
					zod.z.literal("generated"),
					zod.z.literal("asset-id")
				]).readonly(),
				"title": zod.z.string().readonly().optional(),
				"category": zod.z.string().readonly().optional(),
				"subcategory": zod.z.string().readonly().optional(),
				"description": zod.z.string().readonly().optional(),
				"health": zod.z.string().readonly().optional(),
				"validationLevel": zod.z.string().readonly().optional(),
				"requires": zod.z.array(zod.z.string()).readonly().optional(),
				"summaryEn": zod.z.string().readonly().optional(),
				"summaryZh": zod.z.string().readonly().optional()
			})).readonly(),
			"sync": zod.z.object({
				"mode": zod.z.union([zod.z.literal("manual"), zod.z.literal("event-stream")]).readonly().describe("How the Host learns that the official publication may have changed."),
				"state": zod.z.union([
					zod.z.literal("connected"),
					zod.z.literal("error"),
					zod.z.literal("idle"),
					zod.z.literal("connecting"),
					zod.z.literal("reconnecting")
				]).readonly().describe("Current event-stream lifecycle state; manual mode stays `idle`."),
				"connectedAt": zod.z.number().readonly().optional().describe("Last successful event-stream connection time."),
				"eventReceivedAt": zod.z.number().readonly().optional().describe("Last catalog change event accepted from the relay."),
				"error": zod.z.string().readonly().optional().describe("User-safe failure summary while reconnecting.")
			}).readonly().describe("Live Host delivery state for this official catalog projection.")
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_catalogSyncStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_catalogSyncStatus_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_catalogSyncStatus_result$schema$value ??= zod.z.object({
			"mode": zod.z.union([zod.z.literal("manual"), zod.z.literal("event-stream")]).readonly().describe("How the Host learns that the official publication may have changed."),
			"state": zod.z.union([
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("idle"),
				zod.z.literal("connecting"),
				zod.z.literal("reconnecting")
			]).readonly().describe("Current event-stream lifecycle state; manual mode stays `idle`."),
			"connectedAt": zod.z.number().readonly().optional().describe("Last successful event-stream connection time."),
			"eventReceivedAt": zod.z.number().readonly().optional().describe("Last catalog change event accepted from the relay."),
			"error": zod.z.string().readonly().optional().describe("User-safe failure summary while reconnecting.")
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0$schema$value ??= zod.z.object({
			"assetId": zod.z.string().readonly(),
			"observedSnapshotId": zod.z.string().readonly(),
			"observedCommit": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_result$schema$value ??= zod.z.object({
			"versionId": zod.z.string().readonly(),
			"assetId": zod.z.string().readonly(),
			"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
			"repository": zod.z.string().readonly(),
			"commit": zod.z.string().readonly(),
			"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
			"treeDigest": zod.z.string().readonly(),
			"fileCount": zod.z.number().readonly(),
			"totalBytes": zod.z.number().readonly(),
			"installedAt": zod.z.number().readonly(),
			"exposure": zod.z.union([zod.z.literal("skill-registry"), zod.z.literal("agent-template")]).readonly().describe("Skills are registry-visible; Agents expose a validated user-Agent template."),
			"origin": zod.z.union([zod.z.literal("catalog"), zod.z.literal("local-authoring")]).readonly().describe("Publication owner for this immutable version."),
			"declarationTitleZh": zod.z.string().readonly().optional().describe("Chinese H1 read from this exact installed declaration, when present.")
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_list_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_list_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_list_result$schema$value ??= zod.z.object({ "versions": zod.z.array(zod.z.object({
			"versionId": zod.z.string().readonly(),
			"assetId": zod.z.string().readonly(),
			"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
			"repository": zod.z.string().readonly(),
			"commit": zod.z.string().readonly(),
			"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
			"treeDigest": zod.z.string().readonly(),
			"fileCount": zod.z.number().readonly(),
			"totalBytes": zod.z.number().readonly(),
			"installedAt": zod.z.number().readonly(),
			"exposure": zod.z.union([zod.z.literal("skill-registry"), zod.z.literal("agent-template")]).readonly().describe("Skills are registry-visible; Agents expose a validated user-Agent template."),
			"origin": zod.z.union([zod.z.literal("catalog"), zod.z.literal("local-authoring")]).readonly().describe("Publication owner for this immutable version."),
			"declarationTitleZh": zod.z.string().readonly().optional().describe("Chinese H1 read from this exact installed declaration, when present.")
		})).readonly() });
		let _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0$schema$value ??= zod.z.string();
		let _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_result$schema$value ??= zod.z.string();
		let _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0$schema$value ??= zod.z.object({
			"markdown": zod.z.string().readonly(),
			"mode": zod.z.union([
				zod.z.literal("create"),
				zod.z.literal("edit"),
				zod.z.literal("copy")
			]).readonly(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"copyAssetId": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_result$schema$value ??= zod.z.object({
			"versionId": zod.z.string().readonly(),
			"assetId": zod.z.string().readonly(),
			"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
			"repository": zod.z.string().readonly(),
			"commit": zod.z.string().readonly(),
			"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
			"treeDigest": zod.z.string().readonly(),
			"fileCount": zod.z.number().readonly(),
			"totalBytes": zod.z.number().readonly(),
			"installedAt": zod.z.number().readonly(),
			"exposure": zod.z.union([zod.z.literal("skill-registry"), zod.z.literal("agent-template")]).readonly().describe("Skills are registry-visible; Agents expose a validated user-Agent template."),
			"origin": zod.z.union([zod.z.literal("catalog"), zod.z.literal("local-authoring")]).readonly().describe("Publication owner for this immutable version."),
			"declarationTitleZh": zod.z.string().readonly().optional().describe("Chinese H1 read from this exact installed declaration, when present.")
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0$schema$value ??= zod.z.object({ "assetId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_result$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_result$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0_strict$schema$value ??= zod.z.string();
		let _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0_strict$schema$value ??= zod.z.strictObject({ "source": zod.z.union([zod.z.literal("github"), zod.z.literal("gitee")]).readonly() });
		let _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"assetId": zod.z.string().readonly(),
			"observedSnapshotId": zod.z.string().readonly(),
			"observedCommit": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"assetId": zod.z.string().readonly(),
			"observedSnapshotId": zod.z.string().readonly(),
			"observedCommit": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0_strict$schema$value ??= zod.z.string();
		let _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"markdown": zod.z.string().readonly(),
			"mode": zod.z.union([
				zod.z.literal("create"),
				zod.z.literal("edit"),
				zod.z.literal("copy")
			]).readonly(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"copyAssetId": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0_strict$schema$value ??= zod.z.strictObject({ "assetId": zod.z.string().readonly() });
		const TYPERT_REMOTE$2 = createTypertRemoteInfo({
			package: "@deepseek-ai/dsh-quantskills-host",
			methods: {
				"quantSkills/agentTemplate": {
					service: "quantSkillsHost",
					description: "Resolve one exact installed Agent as an editable user-Agent template.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "versionId",
						description: "Host-issued immutable installed-version identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersionId",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersionId",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledAgentTemplate",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_agentTemplate_result$schema,
						description: "validated Agent metadata, instructions, and exact dependency identities.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"version": {
									"type": "object",
									"properties": {
										"versionId": { "type": "string" },
										"assetId": { "type": "string" },
										"kind": {
											"type": "string",
											"enum": ["skill", "agent"]
										},
										"repository": { "type": "string" },
										"commit": { "type": "string" },
										"declaration": {
											"type": "string",
											"enum": ["SKILL.md", "AGENTS.md"]
										},
										"treeDigest": { "type": "string" },
										"fileCount": { "type": "number" },
										"totalBytes": { "type": "number" },
										"installedAt": { "type": "number" },
										"exposure": {
											"type": "string",
											"enum": ["skill-registry", "agent-template"],
											"description": "Skills are registry-visible; Agents expose a validated user-Agent template."
										},
										"origin": {
											"type": "string",
											"enum": ["catalog", "local-authoring"],
											"description": "Publication owner for this immutable version."
										},
										"declarationTitleZh": {
											"type": "string",
											"description": "Chinese H1 read from this exact installed declaration, when present."
										}
									},
									"required": [
										"versionId",
										"assetId",
										"kind",
										"repository",
										"commit",
										"declaration",
										"treeDigest",
										"fileCount",
										"totalBytes",
										"installedAt",
										"exposure",
										"origin"
									],
									"additionalProperties": true
								},
								"name": { "type": "string" },
								"description": { "type": "string" },
								"instructions": { "type": "string" },
								"requires": {
									"type": "array",
									"items": { "type": "string" }
								},
								"promptForm": {
									"oneOf": [{
										"type": "object",
										"properties": {
											"status": {
												"type": "string",
												"const": "ready"
											},
											"form": {
												"type": "object",
												"properties": {
													"version": {
														"type": "number",
														"const": 1
													},
													"task": {
														"type": "object",
														"properties": {
															"placeholder": { "type": "string" },
															"required": { "type": "boolean" }
														},
														"required": [],
														"additionalProperties": true
													},
													"fields": {
														"type": "array",
														"items": {
															"type": "object",
															"properties": {
																"key": { "type": "string" },
																"label": { "type": "string" },
																"type": {
																	"type": "string",
																	"enum": [
																		"number",
																		"text",
																		"textarea",
																		"select",
																		"date"
																	]
																},
																"required": { "type": "boolean" },
																"placeholder": { "type": "string" },
																"help": { "type": "string" },
																"default": { "oneOf": [{ "type": "string" }, { "type": "number" }] },
																"options": {
																	"type": "array",
																	"items": {
																		"type": "object",
																		"properties": {
																			"value": { "type": "string" },
																			"label": { "type": "string" }
																		},
																		"required": ["value", "label"],
																		"additionalProperties": true
																	}
																}
															},
															"required": [
																"key",
																"label",
																"type"
															],
															"additionalProperties": true
														}
													},
													"promptTemplate": { "type": "string" }
												},
												"required": [
													"version",
													"fields",
													"promptTemplate"
												],
												"additionalProperties": true
											},
											"adaptations": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"code": {
															"type": "string",
															"const": "number-default-string"
														},
														"fieldKey": { "type": "string" }
													},
													"required": ["code", "fieldKey"],
													"additionalProperties": true
												}
											}
										},
										"required": ["status", "form"],
										"additionalProperties": true
									}, {
										"type": "object",
										"properties": {
											"status": {
												"type": "string",
												"const": "invalid"
											},
											"reason": { "type": "string" }
										},
										"required": ["status", "reason"],
										"additionalProperties": true
									}],
									"description": "Optional form metadata parsed independently from the literal Agent instructions."
								}
							},
							"required": [
								"version",
								"name",
								"description",
								"instructions",
								"requires"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 680,
						"column": 3
					}
				},
				"quantSkills/applicationUpdateCheck": {
					service: "quantSkillsHost",
					description: "Start a user-requested official version check without downloading an update.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "explicit Git service selected by the user.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateCheckRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "source": {
									"type": "string",
									"enum": ["github", "gitee"]
								} },
								"required": ["source"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateCheckRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "source": {
									"type": "string",
									"enum": ["github", "gitee"]
								} },
								"required": ["source"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateStartResult",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateCheck_result$schema,
						description: "immediate started-or-reused acknowledgement.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"accepted": {
									"type": "string",
									"enum": ["started", "reused"]
								},
								"status": {
									"type": "object",
									"properties": {
										"state": {
											"type": "string",
											"enum": [
												"idle",
												"checking",
												"current",
												"available",
												"preparing",
												"ready",
												"blocked",
												"failed"
											]
										},
										"source": {
											"type": "string",
											"enum": ["github", "gitee"],
											"description": "Official Git service used by the active or latest completed operation."
										},
										"currentVersion": {
											"type": "string",
											"description": "Installed application SemVer read from the active package manifest."
										},
										"currentCommit": { "type": "string" },
										"candidateVersion": {
											"type": "string",
											"description": "Newest published stable SemVer selected from an official `vX.Y.Z` Git tag."
										},
										"candidateCommit": { "type": "string" },
										"releaseNotes": {
											"type": "array",
											"items": { "type": "string" },
											"description": "Release notes read from the exact candidate commit."
										},
										"phase": {
											"type": "string",
											"enum": [
												"fetching",
												"installing",
												"verifying"
											]
										},
										"checkedAt": { "type": "number" },
										"errorCode": {
											"type": "string",
											"enum": [
												"CATALOG_FETCH_FAILED",
												"CATALOG_INVALID",
												"CATALOG_STALE",
												"ASSET_NOT_FOUND",
												"ASSET_README_FETCH_FAILED",
												"ASSET_README_NOT_FOUND",
												"ASSET_README_INVALID",
												"INSTALL_INVALID_TREE",
												"INSTALL_LIMIT_EXCEEDED",
												"INSTALL_GIT_FAILED",
												"INSTALL_EXPOSURE_FAILED",
												"INSTALL_RECORD_CORRUPT",
												"INSTALL_WRITE_FAILED",
												"INSTALLED_VERSION_NOT_FOUND",
												"INSTALLED_VERSION_NOT_SKILL",
												"INSTALLED_VERSION_NOT_AGENT",
												"APPLICATION_UPDATE_CHECK_FAILED",
												"APPLICATION_UPDATE_NOT_AVAILABLE",
												"APPLICATION_UPDATE_DOWNLOAD_FAILED",
												"APPLICATION_UPDATE_INSTALL_FAILED",
												"APPLICATION_UPDATE_VERIFY_FAILED",
												"APPLICATION_UPDATE_STATE_CORRUPT",
												"APPLICATION_UPDATE_PATH_INVALID",
												"APPLICATION_UPDATE_DEVELOPMENT_DIRTY",
												"APPLICATION_UPDATE_DEVELOPMENT_REMOTE",
												"APPLICATION_UPDATE_DEVELOPMENT_BRANCH",
												"APPLICATION_UPDATE_DEVELOPMENT_AHEAD",
												"APPLICATION_UPDATE_DEVELOPMENT_DIVERGED"
											]
										}
									},
									"required": ["state"],
									"additionalProperties": true
								}
							},
							"required": ["accepted", "status"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 549,
						"column": 3
					}
				},
				"quantSkills/applicationUpdateStart": {
					service: "quantSkillsHost",
					description: "Prepare the version selected by the user's latest completed check.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateStartResult",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStart_result$schema,
						description: "immediate started-or-reused acknowledgement.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"accepted": {
									"type": "string",
									"enum": ["started", "reused"]
								},
								"status": {
									"type": "object",
									"properties": {
										"state": {
											"type": "string",
											"enum": [
												"idle",
												"checking",
												"current",
												"available",
												"preparing",
												"ready",
												"blocked",
												"failed"
											]
										},
										"source": {
											"type": "string",
											"enum": ["github", "gitee"],
											"description": "Official Git service used by the active or latest completed operation."
										},
										"currentVersion": {
											"type": "string",
											"description": "Installed application SemVer read from the active package manifest."
										},
										"currentCommit": { "type": "string" },
										"candidateVersion": {
											"type": "string",
											"description": "Newest published stable SemVer selected from an official `vX.Y.Z` Git tag."
										},
										"candidateCommit": { "type": "string" },
										"releaseNotes": {
											"type": "array",
											"items": { "type": "string" },
											"description": "Release notes read from the exact candidate commit."
										},
										"phase": {
											"type": "string",
											"enum": [
												"fetching",
												"installing",
												"verifying"
											]
										},
										"checkedAt": { "type": "number" },
										"errorCode": {
											"type": "string",
											"enum": [
												"CATALOG_FETCH_FAILED",
												"CATALOG_INVALID",
												"CATALOG_STALE",
												"ASSET_NOT_FOUND",
												"ASSET_README_FETCH_FAILED",
												"ASSET_README_NOT_FOUND",
												"ASSET_README_INVALID",
												"INSTALL_INVALID_TREE",
												"INSTALL_LIMIT_EXCEEDED",
												"INSTALL_GIT_FAILED",
												"INSTALL_EXPOSURE_FAILED",
												"INSTALL_RECORD_CORRUPT",
												"INSTALL_WRITE_FAILED",
												"INSTALLED_VERSION_NOT_FOUND",
												"INSTALLED_VERSION_NOT_SKILL",
												"INSTALLED_VERSION_NOT_AGENT",
												"APPLICATION_UPDATE_CHECK_FAILED",
												"APPLICATION_UPDATE_NOT_AVAILABLE",
												"APPLICATION_UPDATE_DOWNLOAD_FAILED",
												"APPLICATION_UPDATE_INSTALL_FAILED",
												"APPLICATION_UPDATE_VERIFY_FAILED",
												"APPLICATION_UPDATE_STATE_CORRUPT",
												"APPLICATION_UPDATE_PATH_INVALID",
												"APPLICATION_UPDATE_DEVELOPMENT_DIRTY",
												"APPLICATION_UPDATE_DEVELOPMENT_REMOTE",
												"APPLICATION_UPDATE_DEVELOPMENT_BRANCH",
												"APPLICATION_UPDATE_DEVELOPMENT_AHEAD",
												"APPLICATION_UPDATE_DEVELOPMENT_DIVERGED"
											]
										}
									},
									"required": ["state"],
									"additionalProperties": true
								}
							},
							"required": ["accepted", "status"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 558,
						"column": 3
					}
				},
				"quantSkills/applicationUpdateStatus": {
					service: "quantSkillsHost",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsApplicationUpdateStatus",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_applicationUpdateStatus_result$schema,
						description: "the current background application-update state without network I/O.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"state": {
									"type": "string",
									"enum": [
										"idle",
										"checking",
										"current",
										"available",
										"preparing",
										"ready",
										"blocked",
										"failed"
									]
								},
								"source": {
									"type": "string",
									"enum": ["github", "gitee"],
									"description": "Official Git service used by the active or latest completed operation."
								},
								"currentVersion": {
									"type": "string",
									"description": "Installed application SemVer read from the active package manifest."
								},
								"currentCommit": { "type": "string" },
								"candidateVersion": {
									"type": "string",
									"description": "Newest published stable SemVer selected from an official `vX.Y.Z` Git tag."
								},
								"candidateCommit": { "type": "string" },
								"releaseNotes": {
									"type": "array",
									"items": { "type": "string" },
									"description": "Release notes read from the exact candidate commit."
								},
								"phase": {
									"type": "string",
									"enum": [
										"fetching",
										"installing",
										"verifying"
									]
								},
								"checkedAt": { "type": "number" },
								"errorCode": {
									"type": "string",
									"enum": [
										"CATALOG_FETCH_FAILED",
										"CATALOG_INVALID",
										"CATALOG_STALE",
										"ASSET_NOT_FOUND",
										"ASSET_README_FETCH_FAILED",
										"ASSET_README_NOT_FOUND",
										"ASSET_README_INVALID",
										"INSTALL_INVALID_TREE",
										"INSTALL_LIMIT_EXCEEDED",
										"INSTALL_GIT_FAILED",
										"INSTALL_EXPOSURE_FAILED",
										"INSTALL_RECORD_CORRUPT",
										"INSTALL_WRITE_FAILED",
										"INSTALLED_VERSION_NOT_FOUND",
										"INSTALLED_VERSION_NOT_SKILL",
										"INSTALLED_VERSION_NOT_AGENT",
										"APPLICATION_UPDATE_CHECK_FAILED",
										"APPLICATION_UPDATE_NOT_AVAILABLE",
										"APPLICATION_UPDATE_DOWNLOAD_FAILED",
										"APPLICATION_UPDATE_INSTALL_FAILED",
										"APPLICATION_UPDATE_VERIFY_FAILED",
										"APPLICATION_UPDATE_STATE_CORRUPT",
										"APPLICATION_UPDATE_PATH_INVALID",
										"APPLICATION_UPDATE_DEVELOPMENT_DIRTY",
										"APPLICATION_UPDATE_DEVELOPMENT_REMOTE",
										"APPLICATION_UPDATE_DEVELOPMENT_BRANCH",
										"APPLICATION_UPDATE_DEVELOPMENT_AHEAD",
										"APPLICATION_UPDATE_DEVELOPMENT_DIVERGED"
									]
								}
							},
							"required": ["state"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 539,
						"column": 3
					}
				},
				"quantSkills/assetReadme": {
					service: "quantSkillsHost",
					description: "Read the repository's real README at the exact commit shown by the Client.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "catalog-bound asset identity and exact observed commit.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsAssetReadmeRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"assetId": { "type": "string" },
									"observedSnapshotId": { "type": "string" },
									"observedCommit": { "type": "string" }
								},
								"required": [
									"assetId",
									"observedSnapshotId",
									"observedCommit"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsAssetReadmeRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"assetId": { "type": "string" },
									"observedSnapshotId": { "type": "string" },
									"observedCommit": { "type": "string" }
								},
								"required": [
									"assetId",
									"observedSnapshotId",
									"observedCommit"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsAssetReadme",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_assetReadme_result$schema,
						description: "bounded UTF-8 Markdown from the approved repository version.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"assetId": { "type": "string" },
								"commit": { "type": "string" },
								"path": {
									"type": "string",
									"enum": ["SKILL.md", "README.md"]
								},
								"markdown": { "type": "string" }
							},
							"required": [
								"assetId",
								"commit",
								"path",
								"markdown"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 569,
						"column": 3
					}
				},
				"quantSkills/catalog": {
					service: "quantSkillsHost",
					description: "Read the approved official catalog without making a validated process cache wait on GitHub.",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsCatalogSnapshot",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_catalog_result$schema,
						description: "a bounded, validated point-in-time snapshot.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"snapshotId": { "type": "string" },
								"refreshAfterMs": {
									"type": "number",
									"description": "Host-configured delay before the Client checks the official catalog again."
								},
								"categories": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"labelEn": { "type": "string" },
											"labelZh": { "type": "string" },
											"subcategories": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"labelEn": { "type": "string" },
														"labelZh": { "type": "string" }
													},
													"required": [
														"id",
														"labelEn",
														"labelZh"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"labelEn",
											"labelZh",
											"subcategories"
										],
										"additionalProperties": true
									}
								},
								"assets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"assetId": { "type": "string" },
											"kind": {
												"type": "string",
												"enum": ["skill", "agent"]
											},
											"repository": { "type": "string" },
											"commit": { "type": "string" },
											"declaration": {
												"type": "string",
												"enum": ["SKILL.md", "AGENTS.md"]
											},
											"displayNames": {
												"type": "object",
												"properties": {
													"zhCN": { "type": "string" },
													"en": { "type": "string" }
												},
												"required": ["zhCN"],
												"additionalProperties": true
											},
											"aliases": {
												"type": "array",
												"items": { "type": "string" }
											},
											"nameSource": {
												"type": "string",
												"enum": [
													"catalog",
													"declaration",
													"generated",
													"asset-id"
												]
											},
											"title": { "type": "string" },
											"category": { "type": "string" },
											"subcategory": { "type": "string" },
											"description": { "type": "string" },
											"health": { "type": "string" },
											"validationLevel": { "type": "string" },
											"requires": {
												"type": "array",
												"items": { "type": "string" }
											},
											"summaryEn": { "type": "string" },
											"summaryZh": { "type": "string" }
										},
										"required": [
											"assetId",
											"kind",
											"repository",
											"commit",
											"declaration",
											"displayNames",
											"aliases",
											"nameSource"
										],
										"additionalProperties": true
									}
								},
								"sync": {
									"type": "object",
									"properties": {
										"mode": {
											"type": "string",
											"enum": ["manual", "event-stream"],
											"description": "How the Host learns that the official publication may have changed."
										},
										"state": {
											"type": "string",
											"enum": [
												"connected",
												"error",
												"idle",
												"connecting",
												"reconnecting"
											],
											"description": "Current event-stream lifecycle state; manual mode stays `idle`."
										},
										"connectedAt": {
											"type": "number",
											"description": "Last successful event-stream connection time."
										},
										"eventReceivedAt": {
											"type": "number",
											"description": "Last catalog change event accepted from the relay."
										},
										"error": {
											"type": "string",
											"description": "User-safe failure summary while reconnecting."
										}
									},
									"required": ["mode", "state"],
									"additionalProperties": true,
									"description": "Live Host delivery state for this official catalog projection."
								}
							},
							"required": [
								"snapshotId",
								"refreshAfterMs",
								"categories",
								"assets",
								"sync"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 487,
						"column": 3
					}
				},
				"quantSkills/catalogSyncStatus": {
					service: "quantSkillsHost",
					description: "Read the current event-driven catalog delivery state.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsCatalogSyncStatus",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_catalogSyncStatus_result$schema,
						description: "Host-owned connection state for the configured relay.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"mode": {
									"type": "string",
									"enum": ["manual", "event-stream"],
									"description": "How the Host learns that the official publication may have changed."
								},
								"state": {
									"type": "string",
									"enum": [
										"connected",
										"error",
										"idle",
										"connecting",
										"reconnecting"
									],
									"description": "Current event-stream lifecycle state; manual mode stays `idle`."
								},
								"connectedAt": {
									"type": "number",
									"description": "Last successful event-stream connection time."
								},
								"eventReceivedAt": {
									"type": "number",
									"description": "Last catalog change event accepted from the relay."
								},
								"error": {
									"type": "string",
									"description": "User-safe failure summary while reconnecting."
								}
							},
							"required": ["mode", "state"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 503,
						"column": 3
					}
				},
				"quantSkills/installAsset": {
					service: "quantSkillsHost",
					description: "Re-fetch the catalog, enforce the Client's observed snapshot and commit, and atomically publish one validated immutable version.",
					implementation: "install",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "catalog-bound asset identity and exact observed commit.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstallRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"assetId": { "type": "string" },
									"observedSnapshotId": { "type": "string" },
									"observedCommit": { "type": "string" }
								},
								"required": [
									"assetId",
									"observedSnapshotId",
									"observedCommit"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstallRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"assetId": { "type": "string" },
									"observedSnapshotId": { "type": "string" },
									"observedCommit": { "type": "string" }
								},
								"required": [
									"assetId",
									"observedSnapshotId",
									"observedCommit"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersion",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_installAsset_result$schema,
						description: "the Host-committed installation record.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"versionId": { "type": "string" },
								"assetId": { "type": "string" },
								"kind": {
									"type": "string",
									"enum": ["skill", "agent"]
								},
								"repository": { "type": "string" },
								"commit": { "type": "string" },
								"declaration": {
									"type": "string",
									"enum": ["SKILL.md", "AGENTS.md"]
								},
								"treeDigest": { "type": "string" },
								"fileCount": { "type": "number" },
								"totalBytes": { "type": "number" },
								"installedAt": { "type": "number" },
								"exposure": {
									"type": "string",
									"enum": ["skill-registry", "agent-template"],
									"description": "Skills are registry-visible; Agents expose a validated user-Agent template."
								},
								"origin": {
									"type": "string",
									"enum": ["catalog", "local-authoring"],
									"description": "Publication owner for this immutable version."
								},
								"declarationTitleZh": {
									"type": "string",
									"description": "Chinese H1 read from this exact installed declaration, when present."
								}
							},
							"required": [
								"versionId",
								"assetId",
								"kind",
								"repository",
								"commit",
								"declaration",
								"treeDigest",
								"fileCount",
								"totalBytes",
								"installedAt",
								"exposure",
								"origin"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 584,
						"column": 3
					}
				},
				"quantSkills/list": {
					service: "quantSkillsHost",
					description: "List versions with a complete Host publication record.",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledSnapshot",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_list_result$schema,
						description: "immutable installed versions sorted by asset and commit.",
						jsonSchema: {
							"type": "object",
							"properties": { "versions": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"versionId": { "type": "string" },
										"assetId": { "type": "string" },
										"kind": {
											"type": "string",
											"enum": ["skill", "agent"]
										},
										"repository": { "type": "string" },
										"commit": { "type": "string" },
										"declaration": {
											"type": "string",
											"enum": ["SKILL.md", "AGENTS.md"]
										},
										"treeDigest": { "type": "string" },
										"fileCount": { "type": "number" },
										"totalBytes": { "type": "number" },
										"installedAt": { "type": "number" },
										"exposure": {
											"type": "string",
											"enum": ["skill-registry", "agent-template"],
											"description": "Skills are registry-visible; Agents expose a validated user-Agent template."
										},
										"origin": {
											"type": "string",
											"enum": ["catalog", "local-authoring"],
											"description": "Publication owner for this immutable version."
										},
										"declarationTitleZh": {
											"type": "string",
											"description": "Chinese H1 read from this exact installed declaration, when present."
										}
									},
									"required": [
										"versionId",
										"assetId",
										"kind",
										"repository",
										"commit",
										"declaration",
										"treeDigest",
										"fileCount",
										"totalBytes",
										"installedAt",
										"exposure",
										"origin"
									],
									"additionalProperties": true
								}
							} },
							"required": ["versions"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 513,
						"column": 3
					}
				},
				"quantSkills/manualSkillRead": {
					service: "quantSkillsHost",
					description: "Save a manual declaration through the same admission and immutable publication as AI creation.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "versionId",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersionId",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersionId",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/manualSkillRead:result",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillRead_result$schema,
						jsonSchema: { "type": "string" }
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 787,
						"column": 9
					}
				},
				"quantSkills/manualSkillSave": {
					service: "quantSkillsHost",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsManualSkillSaveRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"markdown": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": [
											"create",
											"edit",
											"copy"
										]
									},
									"sourceVersionId": { "type": "string" },
									"copyAssetId": { "type": "string" }
								},
								"required": ["markdown", "mode"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsManualSkillSaveRequest",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"markdown": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": [
											"create",
											"edit",
											"copy"
										]
									},
									"sourceVersionId": { "type": "string" },
									"copyAssetId": { "type": "string" }
								},
								"required": ["markdown", "mode"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host/types#QuantSkillsInstalledVersion",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_manualSkillSave_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"versionId": { "type": "string" },
								"assetId": { "type": "string" },
								"kind": {
									"type": "string",
									"enum": ["skill", "agent"]
								},
								"repository": { "type": "string" },
								"commit": { "type": "string" },
								"declaration": {
									"type": "string",
									"enum": ["SKILL.md", "AGENTS.md"]
								},
								"treeDigest": { "type": "string" },
								"fileCount": { "type": "number" },
								"totalBytes": { "type": "number" },
								"installedAt": { "type": "number" },
								"exposure": {
									"type": "string",
									"enum": ["skill-registry", "agent-template"],
									"description": "Skills are registry-visible; Agents expose a validated user-Agent template."
								},
								"origin": {
									"type": "string",
									"enum": ["catalog", "local-authoring"],
									"description": "Publication owner for this immutable version."
								},
								"declarationTitleZh": {
									"type": "string",
									"description": "Chinese H1 read from this exact installed declaration, when present."
								}
							},
							"required": [
								"versionId",
								"assetId",
								"kind",
								"repository",
								"commit",
								"declaration",
								"treeDigest",
								"fileCount",
								"totalBytes",
								"installedAt",
								"exposure",
								"origin"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 798,
						"column": 3
					}
				},
				"quantSkills/uninstallAsset": {
					service: "quantSkillsHost",
					description: "Remove a catalog asset from discovery while retaining immutable versions for existing sessions.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/uninstallAsset:request",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "assetId": { "type": "string" } },
								"required": ["assetId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/uninstallAsset:request",
							create: _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "assetId": { "type": "string" } },
								"required": ["assetId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-host#quantSkills/uninstallAsset:result",
						create: _deepseek_ai_dsh_quantskills_host_quantSkills_uninstallAsset_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-host/src/index.ts",
						"line": 519,
						"column": 3
					}
				}
			}
		}, zod.z);
		//#endregion
		//#region ../quantskills-session/lib/typert.remote-client.js
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0$schema$value ??= zod.z.object({
			"purpose": zod.z.literal("authoring-helper").readonly().optional().describe("Explicitly create a hidden application helper; never inferred from its name."),
			"copyFrom": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"expectedRevision": zod.z.number().readonly()
			}).readonly().optional().describe("Explicit personal copy of a saved definition, checked before publication."),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.object({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly().optional(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"versionIds": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_result$schema$value ??= zod.z.object({
			"agentId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.object({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"skills": zod.z.array(zod.z.object({
				"assetId": zod.z.string().readonly(),
				"versionId": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"treeDigest": zod.z.string().readonly()
			})).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0$schema$value ??= zod.z.object({
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentLibrarySources_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentLibrarySources_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentLibrarySources_result$schema$value ??= zod.z.array(zod.z.object({
			"id": zod.z.string().readonly(),
			"kind": zod.z.union([zod.z.literal("agent"), zod.z.literal("agent-team")]).readonly(),
			"source": zod.z.union([
				zod.z.literal("personal"),
				zod.z.literal("installed"),
				zod.z.literal("internal")
			]).readonly(),
			"method": zod.z.union([
				zod.z.literal("manual"),
				zod.z.literal("internal"),
				zod.z.literal("ai"),
				zod.z.literal("installation"),
				zod.z.literal("recovered")
			]).readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentList_result$schema$value ??= zod.z.array(zod.z.object({
			"agentId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.object({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"skills": zod.z.array(zod.z.object({
				"assetId": zod.z.string().readonly(),
				"versionId": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"treeDigest": zod.z.string().readonly()
			})).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"agent": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"role": zod.z.string().readonly(),
				"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
				"model": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly().optional(),
				"permission": zod.z.union([
					zod.z.literal("read-only"),
					zod.z.literal("workspace-write"),
					zod.z.literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": zod.z.string().readonly().optional(),
				"skills": zod.z.array(zod.z.object({
					"assetId": zod.z.string().readonly(),
					"versionId": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"treeDigest": zod.z.string().readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0$schema$value ??= zod.z.object({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_result$schema$value ??= zod.z.array(zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"agent": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"role": zod.z.string().readonly(),
				"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
				"model": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly().optional(),
				"permission": zod.z.union([
					zod.z.literal("read-only"),
					zod.z.literal("workspace-write"),
					zod.z.literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": zod.z.string().readonly().optional(),
				"skills": zod.z.array(zod.z.object({
					"assetId": zod.z.string().readonly(),
					"versionId": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"treeDigest": zod.z.string().readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"title": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"parentSessionId": zod.z.string().readonly().optional(),
			"archived": zod.z.boolean().readonly(),
			"running": zod.z.boolean().readonly(),
			"runState": zod.z.union([
				zod.z.literal("idle"),
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("cancelled"),
				zod.z.literal("running")
			]).readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0$schema$value ??= zod.z.object({
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"leadAgentId": zod.z.string().readonly(),
			"leadAgentRevision": zod.z.number().readonly(),
			"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.object({
				"name": zod.z.string().readonly(),
				"agentId": zod.z.string().readonly(),
				"agentRevision": zod.z.number().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_result$schema$value ??= zod.z.object({
			"teamId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"lead": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"role": zod.z.string().readonly(),
				"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
				"model": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly().optional(),
				"permission": zod.z.union([
					zod.z.literal("read-only"),
					zod.z.literal("workspace-write"),
					zod.z.literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": zod.z.string().readonly().optional(),
				"skills": zod.z.array(zod.z.object({
					"assetId": zod.z.string().readonly(),
					"versionId": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"treeDigest": zod.z.string().readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.object({
				"name": zod.z.string().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"agent": zod.z.object({
					"agentId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"role": zod.z.string().readonly(),
					"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
					"model": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly().optional(),
					"permission": zod.z.union([
						zod.z.literal("read-only"),
						zod.z.literal("workspace-write"),
						zod.z.literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": zod.z.string().readonly().optional(),
					"skills": zod.z.array(zod.z.object({
						"assetId": zod.z.string().readonly(),
						"versionId": zod.z.string().readonly(),
						"commit": zod.z.string().readonly(),
						"treeDigest": zod.z.string().readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly(),
				"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0$schema$value ??= zod.z.object({
			"teamId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamList_result$schema$value ??= zod.z.array(zod.z.object({
			"teamId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"lead": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"role": zod.z.string().readonly(),
				"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
				"model": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly().optional(),
				"permission": zod.z.union([
					zod.z.literal("read-only"),
					zod.z.literal("workspace-write"),
					zod.z.literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": zod.z.string().readonly().optional(),
				"skills": zod.z.array(zod.z.object({
					"assetId": zod.z.string().readonly(),
					"versionId": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"treeDigest": zod.z.string().readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.object({
				"name": zod.z.string().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"agent": zod.z.object({
					"agentId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"role": zod.z.string().readonly(),
					"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
					"model": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly().optional(),
					"permission": zod.z.union([
						zod.z.literal("read-only"),
						zod.z.literal("workspace-write"),
						zod.z.literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": zod.z.string().readonly().optional(),
					"skills": zod.z.array(zod.z.object({
						"assetId": zod.z.string().readonly(),
						"versionId": zod.z.string().readonly(),
						"commit": zod.z.string().readonly(),
						"treeDigest": zod.z.string().readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly(),
				"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"teamId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"team": zod.z.object({
				"teamId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"description": zod.z.string().readonly(),
				"lead": zod.z.object({
					"agentId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"role": zod.z.string().readonly(),
					"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
					"model": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly().optional(),
					"permission": zod.z.union([
						zod.z.literal("read-only"),
						zod.z.literal("workspace-write"),
						zod.z.literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": zod.z.string().readonly().optional(),
					"skills": zod.z.array(zod.z.object({
						"assetId": zod.z.string().readonly(),
						"versionId": zod.z.string().readonly(),
						"commit": zod.z.string().readonly(),
						"treeDigest": zod.z.string().readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly(),
				"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly(),
				"members": zod.z.array(zod.z.object({
					"name": zod.z.string().readonly(),
					"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
					"agent": zod.z.object({
						"agentId": zod.z.string().readonly(),
						"revision": zod.z.number().readonly(),
						"name": zod.z.string().readonly(),
						"role": zod.z.string().readonly(),
						"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
						"model": zod.z.object({
							"provider": zod.z.string().readonly(),
							"model": zod.z.string().readonly(),
							"reasoningEffort": zod.z.string().readonly().optional()
						}).readonly().optional(),
						"permission": zod.z.union([
							zod.z.literal("read-only"),
							zod.z.literal("workspace-write"),
							zod.z.literal("danger-full-access")
						]).readonly(),
						"sourceVersionId": zod.z.string().readonly().optional(),
						"skills": zod.z.array(zod.z.object({
							"assetId": zod.z.string().readonly(),
							"versionId": zod.z.string().readonly(),
							"commit": zod.z.string().readonly(),
							"treeDigest": zod.z.string().readonly()
						})).readonly(),
						"createdAt": zod.z.number().readonly(),
						"updatedAt": zod.z.number().readonly()
					}).readonly(),
					"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
						"kind": zod.z.literal("fixed").readonly(),
						"selection": zod.z.object({
							"provider": zod.z.string().readonly(),
							"model": zod.z.string().readonly(),
							"reasoningEffort": zod.z.string().readonly().optional()
						}).readonly()
					})]).readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0$schema$value ??= zod.z.object({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_result$schema$value ??= zod.z.array(zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"team": zod.z.object({
				"teamId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"description": zod.z.string().readonly(),
				"lead": zod.z.object({
					"agentId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"role": zod.z.string().readonly(),
					"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
					"model": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly().optional(),
					"permission": zod.z.union([
						zod.z.literal("read-only"),
						zod.z.literal("workspace-write"),
						zod.z.literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": zod.z.string().readonly().optional(),
					"skills": zod.z.array(zod.z.object({
						"assetId": zod.z.string().readonly(),
						"versionId": zod.z.string().readonly(),
						"commit": zod.z.string().readonly(),
						"treeDigest": zod.z.string().readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly(),
				"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly(),
				"members": zod.z.array(zod.z.object({
					"name": zod.z.string().readonly(),
					"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
					"agent": zod.z.object({
						"agentId": zod.z.string().readonly(),
						"revision": zod.z.number().readonly(),
						"name": zod.z.string().readonly(),
						"role": zod.z.string().readonly(),
						"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
						"model": zod.z.object({
							"provider": zod.z.string().readonly(),
							"model": zod.z.string().readonly(),
							"reasoningEffort": zod.z.string().readonly().optional()
						}).readonly().optional(),
						"permission": zod.z.union([
							zod.z.literal("read-only"),
							zod.z.literal("workspace-write"),
							zod.z.literal("danger-full-access")
						]).readonly(),
						"sourceVersionId": zod.z.string().readonly().optional(),
						"skills": zod.z.array(zod.z.object({
							"assetId": zod.z.string().readonly(),
							"versionId": zod.z.string().readonly(),
							"commit": zod.z.string().readonly(),
							"treeDigest": zod.z.string().readonly()
						})).readonly(),
						"createdAt": zod.z.number().readonly(),
						"updatedAt": zod.z.number().readonly()
					}).readonly(),
					"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
						"kind": zod.z.literal("fixed").readonly(),
						"selection": zod.z.object({
							"provider": zod.z.string().readonly(),
							"model": zod.z.string().readonly(),
							"reasoningEffort": zod.z.string().readonly().optional()
						}).readonly()
					})]).readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"title": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"parentSessionId": zod.z.string().readonly().optional(),
			"archived": zod.z.boolean().readonly(),
			"running": zod.z.boolean().readonly(),
			"runState": zod.z.union([
				zod.z.literal("idle"),
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("cancelled"),
				zod.z.literal("running")
			]).readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0$schema$value ??= zod.z.object({
			"teamId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"leadAgentId": zod.z.string().readonly(),
			"leadAgentRevision": zod.z.number().readonly(),
			"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.object({
				"name": zod.z.string().readonly(),
				"agentId": zod.z.string().readonly(),
				"agentRevision": zod.z.number().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_result$schema$value ??= zod.z.object({
			"teamId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"lead": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"role": zod.z.string().readonly(),
				"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
				"model": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly().optional(),
				"permission": zod.z.union([
					zod.z.literal("read-only"),
					zod.z.literal("workspace-write"),
					zod.z.literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": zod.z.string().readonly().optional(),
				"skills": zod.z.array(zod.z.object({
					"assetId": zod.z.string().readonly(),
					"versionId": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"treeDigest": zod.z.string().readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.object({
				"name": zod.z.string().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"agent": zod.z.object({
					"agentId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"role": zod.z.string().readonly(),
					"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
					"model": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly().optional(),
					"permission": zod.z.union([
						zod.z.literal("read-only"),
						zod.z.literal("workspace-write"),
						zod.z.literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": zod.z.string().readonly().optional(),
					"skills": zod.z.array(zod.z.object({
						"assetId": zod.z.string().readonly(),
						"versionId": zod.z.string().readonly(),
						"commit": zod.z.string().readonly(),
						"treeDigest": zod.z.string().readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly(),
				"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0$schema$value ??= zod.z.object({
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0$schema$value ??= zod.z.object({
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"purpose": zod.z.literal("authoring-helper").readonly().optional().describe("Explicitly create a hidden application helper; never inferred from its name."),
			"copyFrom": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"expectedRevision": zod.z.number().readonly()
			}).readonly().optional().describe("Explicit personal copy of a saved definition, checked before publication."),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.object({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly().optional(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"versionIds": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_result$schema$value ??= zod.z.object({
			"agentId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.object({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"skills": zod.z.array(zod.z.object({
				"assetId": zod.z.string().readonly(),
				"versionId": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"treeDigest": zod.z.string().readonly()
			})).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_archivedConversations_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_archivedConversations_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_archivedConversations_result$schema$value ??= zod.z.array(zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"title": zod.z.string().readonly(),
			"kind": zod.z.union([
				zod.z.literal("skill"),
				zod.z.literal("agent"),
				zod.z.literal("plain"),
				zod.z.literal("team")
			]).readonly(),
			"updatedAt": zod.z.number().readonly(),
			"running": zod.z.boolean().readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"toolCallId": zod.z.string().readonly(),
			"expectedTreeDigest": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_result$schema$value ??= zod.z.union([
			zod.z.object({
				"kind": zod.z.literal("skill").readonly(),
				"version": zod.z.object({
					"versionId": zod.z.string().readonly(),
					"assetId": zod.z.string().readonly(),
					"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
					"repository": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
					"treeDigest": zod.z.string().readonly(),
					"fileCount": zod.z.number().readonly(),
					"totalBytes": zod.z.number().readonly(),
					"installedAt": zod.z.number().readonly(),
					"exposure": zod.z.union([zod.z.literal("skill-registry"), zod.z.literal("agent-template")]).readonly(),
					"origin": zod.z.union([zod.z.literal("catalog"), zod.z.literal("local-authoring")]).readonly(),
					"declarationTitleZh": zod.z.string().readonly().optional()
				}).readonly()
			}),
			zod.z.object({
				"kind": zod.z.literal("agent").readonly(),
				"version": zod.z.object({
					"versionId": zod.z.string().readonly(),
					"assetId": zod.z.string().readonly(),
					"kind": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
					"repository": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"declaration": zod.z.union([zod.z.literal("SKILL.md"), zod.z.literal("AGENTS.md")]).readonly(),
					"treeDigest": zod.z.string().readonly(),
					"fileCount": zod.z.number().readonly(),
					"totalBytes": zod.z.number().readonly(),
					"installedAt": zod.z.number().readonly(),
					"exposure": zod.z.union([zod.z.literal("skill-registry"), zod.z.literal("agent-template")]).readonly(),
					"origin": zod.z.union([zod.z.literal("catalog"), zod.z.literal("local-authoring")]).readonly(),
					"declarationTitleZh": zod.z.string().readonly().optional()
				}).readonly(),
				"agent": zod.z.object({
					"agentId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"role": zod.z.string().readonly(),
					"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
					"model": zod.z.object({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly().optional(),
					"permission": zod.z.union([
						zod.z.literal("read-only"),
						zod.z.literal("workspace-write"),
						zod.z.literal("danger-full-access")
					]).readonly(),
					"sourceVersionId": zod.z.string().readonly().optional(),
					"skills": zod.z.array(zod.z.object({
						"assetId": zod.z.string().readonly(),
						"versionId": zod.z.string().readonly(),
						"commit": zod.z.string().readonly(),
						"treeDigest": zod.z.string().readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly()
			}),
			zod.z.object({
				"kind": zod.z.literal("agent-team").readonly(),
				"team": zod.z.object({
					"teamId": zod.z.string().readonly(),
					"revision": zod.z.number().readonly(),
					"name": zod.z.string().readonly(),
					"description": zod.z.string().readonly(),
					"lead": zod.z.object({
						"agentId": zod.z.string().readonly(),
						"revision": zod.z.number().readonly(),
						"name": zod.z.string().readonly(),
						"role": zod.z.string().readonly(),
						"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
						"model": zod.z.object({
							"provider": zod.z.string().readonly(),
							"model": zod.z.string().readonly(),
							"reasoningEffort": zod.z.string().readonly().optional()
						}).readonly().optional(),
						"permission": zod.z.union([
							zod.z.literal("read-only"),
							zod.z.literal("workspace-write"),
							zod.z.literal("danger-full-access")
						]).readonly(),
						"sourceVersionId": zod.z.string().readonly().optional(),
						"skills": zod.z.array(zod.z.object({
							"assetId": zod.z.string().readonly(),
							"versionId": zod.z.string().readonly(),
							"commit": zod.z.string().readonly(),
							"treeDigest": zod.z.string().readonly()
						})).readonly(),
						"createdAt": zod.z.number().readonly(),
						"updatedAt": zod.z.number().readonly()
					}).readonly(),
					"leadModel": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
						"kind": zod.z.literal("fixed").readonly(),
						"selection": zod.z.object({
							"provider": zod.z.string().readonly(),
							"model": zod.z.string().readonly(),
							"reasoningEffort": zod.z.string().readonly().optional()
						}).readonly()
					})]).readonly(),
					"members": zod.z.array(zod.z.object({
						"name": zod.z.string().readonly(),
						"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
						"agent": zod.z.object({
							"agentId": zod.z.string().readonly(),
							"revision": zod.z.number().readonly(),
							"name": zod.z.string().readonly(),
							"role": zod.z.string().readonly(),
							"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
							"model": zod.z.object({
								"provider": zod.z.string().readonly(),
								"model": zod.z.string().readonly(),
								"reasoningEffort": zod.z.string().readonly().optional()
							}).readonly().optional(),
							"permission": zod.z.union([
								zod.z.literal("read-only"),
								zod.z.literal("workspace-write"),
								zod.z.literal("danger-full-access")
							]).readonly(),
							"sourceVersionId": zod.z.string().readonly().optional(),
							"skills": zod.z.array(zod.z.object({
								"assetId": zod.z.string().readonly(),
								"versionId": zod.z.string().readonly(),
								"commit": zod.z.string().readonly(),
								"treeDigest": zod.z.string().readonly()
							})).readonly(),
							"createdAt": zod.z.number().readonly(),
							"updatedAt": zod.z.number().readonly()
						}).readonly(),
						"model": zod.z.union([zod.z.object({ "kind": zod.z.literal("default").readonly() }), zod.z.object({
							"kind": zod.z.literal("fixed").readonly(),
							"selection": zod.z.object({
								"provider": zod.z.string().readonly(),
								"model": zod.z.string().readonly(),
								"reasoningEffort": zod.z.string().readonly().optional()
							}).readonly()
						})]).readonly()
					})).readonly(),
					"createdAt": zod.z.number().readonly(),
					"updatedAt": zod.z.number().readonly()
				}).readonly()
			})
		]);
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0$schema$value ??= zod.z.object({
			"kind": zod.z.union([
				zod.z.literal("skill"),
				zod.z.literal("agent"),
				zod.z.literal("agent-team")
			]).readonly(),
			"sessionId": zod.z.string().readonly(),
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"agent": zod.z.object({
				"agentId": zod.z.string().readonly(),
				"revision": zod.z.number().readonly(),
				"name": zod.z.string().readonly(),
				"role": zod.z.string().readonly(),
				"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
				"model": zod.z.object({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly().optional(),
				"permission": zod.z.union([
					zod.z.literal("read-only"),
					zod.z.literal("workspace-write"),
					zod.z.literal("danger-full-access")
				]).readonly(),
				"sourceVersionId": zod.z.string().readonly().optional(),
				"skills": zod.z.array(zod.z.object({
					"assetId": zod.z.string().readonly(),
					"versionId": zod.z.string().readonly(),
					"commit": zod.z.string().readonly(),
					"treeDigest": zod.z.string().readonly()
				})).readonly(),
				"createdAt": zod.z.number().readonly(),
				"updatedAt": zod.z.number().readonly()
			}).readonly(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestCheckUpdate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestCheckUpdate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestCheckUpdate_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestConnect_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestConnect_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestConnect_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDisconnect_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDisconnect_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDisconnect_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0$schema$value ??= zod.z.object({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0$schema$value ??= zod.z.object({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_result$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"sessionId": zod.z.string().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly(),
			"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
			"createdAt": zod.z.number().readonly(),
			"expiresAt": zod.z.number().readonly(),
			"summary": zod.z.string().readonly(),
			"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
			"clientRequestId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("prepared"),
				zod.z.literal("executing"),
				zod.z.literal("completed"),
				zod.z.literal("unknown"),
				zod.z.literal("cancelled"),
				zod.z.literal("expired"),
				zod.z.literal("queued"),
				zod.z.literal("submitted"),
				zod.z.literal("partial")
			]),
			"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
			"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
			"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"tradeId": zod.z.string(),
				"orderId": zod.z.string(),
				"price": zod.z.number(),
				"volume": zod.z.number(),
				"time": zod.z.string()
			}))]).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_result$schema$value ??= zod.z.object({
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly(),
			"fetchedAt": zod.z.number().readonly(),
			"account": zod.z.object({
				"data": zod.z.json().readonly(),
				"meta": zod.z.record(zod.z.string(), zod.z.json()).readonly().optional(),
				"fetchedAt": zod.z.number().readonly()
			}).readonly(),
			"positions": zod.z.object({
				"data": zod.z.json().readonly(),
				"meta": zod.z.record(zod.z.string(), zod.z.json()).readonly().optional(),
				"fetchedAt": zod.z.number().readonly()
			}).readonly(),
			"openOrders": zod.z.object({
				"data": zod.z.json().readonly(),
				"meta": zod.z.record(zod.z.string(), zod.z.json()).readonly().optional(),
				"fetchedAt": zod.z.number().readonly()
			}).readonly(),
			"pendingPlans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly(),
			"summary": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0$schema$value ??= zod.z.object({
			"apiKey": zod.z.string().optional(),
			"translator": zod.z.object({
				"provider": zod.z.string(),
				"model": zod.z.string()
			}).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_result$schema$value ??= zod.z.object({
			"configured": zod.z.boolean(),
			"writable": zod.z.boolean(),
			"model": zod.z.string(),
			"testedAt": zod.z.number().optional(),
			"latencyMs": zod.z.number().optional(),
			"message": zod.z.string().optional(),
			"translator": zod.z.union([zod.z.undefined(), zod.z.object({
				"provider": zod.z.string(),
				"model": zod.z.string()
			})]).optional(),
			"translationModels": zod.z.array(zod.z.object({
				"provider": zod.z.string(),
				"model": zod.z.string()
			})).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevSettings_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevSettings_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevSettings_result$schema$value ??= zod.z.object({
			"configured": zod.z.boolean(),
			"writable": zod.z.boolean(),
			"model": zod.z.string(),
			"testedAt": zod.z.number().optional(),
			"latencyMs": zod.z.number().optional(),
			"message": zod.z.string().optional(),
			"translator": zod.z.union([zod.z.undefined(), zod.z.object({
				"provider": zod.z.string(),
				"model": zod.z.string()
			})]).optional(),
			"translationModels": zod.z.array(zod.z.object({
				"provider": zod.z.string(),
				"model": zod.z.string()
			})).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevUsage_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevUsage_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevUsage_result$schema$value ??= zod.z.object({
			"since": zod.z.number(),
			"requests": zod.z.number(),
			"responsesOk": zod.z.number(),
			"unknownUsage": zod.z.number(),
			"inputTokens": zod.z.number(),
			"outputTokens": zod.z.number(),
			"records": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"purpose": zod.z.union([
					zod.z.literal("watch"),
					zod.z.literal("connection-test"),
					zod.z.literal("research"),
					zod.z.literal("validation")
				]),
				"startedAt": zod.z.number(),
				"finishedAt": zod.z.number(),
				"keyFingerprint": zod.z.string(),
				"httpStatus": zod.z.number().optional(),
				"model": zod.z.string().optional(),
				"usage": zod.z.object({
					"input_tokens": zod.z.number(),
					"output_tokens": zod.z.number()
				}).optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0$schema$value ??= zod.z.object({ "enabled": zod.z.boolean() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0$schema$value ??= zod.z.object({
			"kind": zod.z.union([
				zod.z.literal("account"),
				zod.z.literal("positions"),
				zod.z.literal("open-orders"),
				zod.z.literal("orders"),
				zod.z.literal("trades"),
				zod.z.literal("ranking"),
				zod.z.literal("ranking-me"),
				zod.z.literal("settlements"),
				zod.z.literal("quote"),
				zod.z.literal("varieties")
			]).readonly(),
			"symbol": zod.z.string().readonly().optional(),
			"date": zod.z.string().readonly().optional(),
			"lastId": zod.z.string().readonly().optional(),
			"board": zod.z.union([zod.z.literal("live"), zod.z.literal("settled")]).readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_result$schema$value ??= zod.z.object({
			"data": zod.z.json().readonly(),
			"meta": zod.z.record(zod.z.string(), zod.z.json()).readonly().optional(),
			"fetchedAt": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0$schema$value ??= zod.z.object({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_result$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"sessionId": zod.z.string().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly(),
			"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
			"createdAt": zod.z.number().readonly(),
			"expiresAt": zod.z.number().readonly(),
			"summary": zod.z.string().readonly(),
			"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
			"clientRequestId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("prepared"),
				zod.z.literal("executing"),
				zod.z.literal("completed"),
				zod.z.literal("unknown"),
				zod.z.literal("cancelled"),
				zod.z.literal("expired"),
				zod.z.literal("queued"),
				zod.z.literal("submitted"),
				zod.z.literal("partial")
			]),
			"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
			"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
			"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"tradeId": zod.z.string(),
				"orderId": zod.z.string(),
				"price": zod.z.number(),
				"volume": zod.z.number(),
				"time": zod.z.string()
			}))]).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"topic": zod.z.boolean().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"binding": zod.z.object({
				"purpose": zod.z.union([
					zod.z.literal("ordinary"),
					zod.z.literal("role-helper"),
					zod.z.literal("contest"),
					zod.z.literal("factor-contest")
				]).readonly(),
				"contest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"factorContest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"contestConversation": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("main"),
					zod.z.literal("topic")
				]).readonly().optional()
			}).readonly(),
			"created": zod.z.boolean().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestUpdate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestUpdate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestUpdate_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean().readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]).readonly(),
			"cliVersion": zod.z.string().readonly().optional(),
			"latestVersion": zod.z.string().readonly().optional(),
			"updateAvailable": zod.z.boolean().readonly(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).readonly().optional(),
			"message": zod.z.string().readonly(),
			"retryAt": zod.z.number().readonly().optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"sessionId": zod.z.string().readonly(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}).readonly(),
				"operation": zod.z.union([zod.z.literal("place_order"), zod.z.literal("cancel_order")]).readonly(),
				"createdAt": zod.z.number().readonly(),
				"expiresAt": zod.z.number().readonly(),
				"summary": zod.z.string().readonly(),
				"details": zod.z.record(zod.z.string(), zod.z.json()).readonly(),
				"clientRequestId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired"),
					zod.z.literal("queued"),
					zod.z.literal("submitted"),
					zod.z.literal("partial")
				]),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"result": zod.z.union([zod.z.undefined(), zod.z.record(zod.z.string(), zod.z.json())]).optional(),
				"fills": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"tradeId": zod.z.string(),
					"orderId": zod.z.string(),
					"price": zod.z.number(),
					"volume": zod.z.number(),
					"time": zod.z.string()
				}))]).optional()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchDatasets_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchDatasets_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchDatasets_result$schema$value ??= zod.z.array(zod.z.object({
			"id": zod.z.string(),
			"name": zod.z.string(),
			"columns": zod.z.array(zod.z.string()),
			"rows": zod.z.number(),
			"source": zod.z.string()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0$schema$value ??= zod.z.object({
			"symbol": zod.z.string(),
			"barSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_result$schema$value ??= zod.z.object({
			"datasetId": zod.z.string(),
			"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
			"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
			"refresh": zod.z.boolean(),
			"columns": zod.z.object({
				"time": zod.z.string(),
				"symbol": zod.z.string(),
				"open": zod.z.string(),
				"high": zod.z.string(),
				"low": zod.z.string(),
				"close": zod.z.string()
			})
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0$schema$value ??= zod.z.object({
			"name": zod.z.string(),
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			})
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_result$schema$value ??= zod.z.array(zod.z.object({
			"name": zod.z.string(),
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			})
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0$schema$value ??= zod.z.object({
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			}),
			"confirmed": zod.z.boolean(),
			"executionConsent": zod.z.string().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_result$schema$value ??= zod.z.object({
			"markets": zod.z.array(zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("checking"),
					zod.z.literal("sampling"),
					zod.z.literal("waiting_quote"),
					zod.z.literal("deciding"),
					zod.z.literal("waiting_plan")
				]).optional(),
				"message": zod.z.string(),
				"sampleCount": zod.z.number(),
				"samples": zod.z.array(zod.z.object({
					"time": zod.z.number(),
					"price": zod.z.number(),
					"bid": zod.z.number().optional(),
					"ask": zod.z.number().optional()
				})).optional(),
				"analyses": zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"startedAt": zod.z.number(),
					"responseAt": zod.z.number().optional(),
					"finishedAt": zod.z.number().optional(),
					"sampleCount": zod.z.number(),
					"fromTime": zod.z.number(),
					"toTime": zod.z.number(),
					"price": zod.z.number(),
					"allowedActions": zod.z.array(zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					])),
					"decision": zod.z.object({
						"action": zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						]),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
						"model": zod.z.string(),
						"time": zod.z.number(),
						"usage": zod.z.object({
							"input_tokens": zod.z.number(),
							"output_tokens": zod.z.number()
						}).optional(),
						"assessments": zod.z.object({
							"regime": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							}),
							"fit": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							}),
							"blocker": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							})
						}).optional()
					}).optional(),
					"outcome": zod.z.string(),
					"planId": zod.z.string().optional(),
					"strategyName": zod.z.string().optional(),
					"strategyVersion": zod.z.string().optional(),
					"evidence": zod.z.object({
						"evaluatedAt": zod.z.number(),
						"decisionMode": zod.z.union([zod.z.literal("jev"), zod.z.literal("strict")]).optional(),
						"history": zod.z.object({
							"source": zod.z.string(),
							"barSeconds": zod.z.number(),
							"count": zod.z.number(),
							"from": zod.z.number().optional(),
							"to": zod.z.number().optional(),
							"fetchedAt": zod.z.number().optional(),
							"issue": zod.z.string().optional(),
							"warning": zod.z.string().optional(),
							"diagnostic": zod.z.object({
								"stage": zod.z.string(),
								"code": zod.z.string(),
								"retryable": zod.z.boolean()
							}).optional()
						}),
						"features": zod.z.object({
							"quoteWindowSeconds": zod.z.number(),
							"quoteCount": zod.z.number(),
							"lower": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"upper": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"widthTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"lowerTouches": zod.z.number(),
							"upperTouches": zod.z.number(),
							"location": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"reboundTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"pullbackTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"spreadTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"longRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"shortRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()])
						}),
						"checks": zod.z.array(zod.z.object({
							"id": zod.z.string(),
							"label": zod.z.string(),
							"state": zod.z.union([
								zod.z.literal("unknown"),
								zod.z.literal("pass"),
								zod.z.literal("fail")
							]),
							"detail": zod.z.string(),
							"actions": zod.z.array(zod.z.union([
								zod.z.literal("hold"),
								zod.z.literal("open_long"),
								zod.z.literal("open_short"),
								zod.z.literal("close_long"),
								zod.z.literal("close_short")
							])),
							"enforcement": zod.z.union([zod.z.literal("hard"), zod.z.literal("reference")]).optional(),
							"facts": zod.z.record(zod.z.string(), zod.z.union([
								zod.z.literal(null),
								zod.z.string(),
								zod.z.number(),
								zod.z.literal(false),
								zod.z.literal(true)
							])).optional()
						})),
						"allowedActions": zod.z.array(zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						]))
					}).optional(),
					"planStatus": zod.z.union([
						zod.z.literal("blocked"),
						zod.z.literal("prepared"),
						zod.z.literal("submitted"),
						zod.z.literal("hold"),
						zod.z.literal("restricted"),
						zod.z.literal("candidate")
					]).optional(),
					"reviewNotes": zod.z.array(zod.z.string()).optional()
				})).optional(),
				"lastDecision": zod.z.object({
					"action": zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]),
					"confidence": zod.z.number(),
					"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
					"model": zod.z.string(),
					"time": zod.z.number(),
					"usage": zod.z.object({
						"input_tokens": zod.z.number(),
						"output_tokens": zod.z.number()
					}).optional(),
					"assessments": zod.z.object({
						"regime": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"fit": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"blocker": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						})
					}).optional()
				}).optional(),
				"lastQuoteCheckedAt": zod.z.number().optional(),
				"nextDecisionAt": zod.z.number().optional(),
				"symbol": zod.z.string()
			})).optional(),
			"executionAuthorization": zod.z.object({
				"version": zod.z.string(),
				"acceptedAt": zod.z.number(),
				"runId": zod.z.string()
			}).optional(),
			"running": zod.z.boolean(),
			"message": zod.z.string(),
			"strategyNotices": zod.z.array(zod.z.string()).optional(),
			"phase": zod.z.union([
				zod.z.literal("checking"),
				zod.z.literal("sampling"),
				zod.z.literal("waiting_quote"),
				zod.z.literal("deciding"),
				zod.z.literal("waiting_plan")
			]).optional(),
			"lastQuoteCheckedAt": zod.z.number().optional(),
			"nextDecisionAt": zod.z.number().optional(),
			"openingCooldownUntil": zod.z.number().optional(),
			"nextRetryAt": zod.z.number().optional(),
			"accountCheckedAt": zod.z.number().optional(),
			"samples": zod.z.array(zod.z.object({
				"time": zod.z.number(),
				"price": zod.z.number(),
				"bid": zod.z.number().optional(),
				"ask": zod.z.number().optional()
			})).optional(),
			"analyses": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"startedAt": zod.z.number(),
				"responseAt": zod.z.number().optional(),
				"finishedAt": zod.z.number().optional(),
				"sampleCount": zod.z.number(),
				"fromTime": zod.z.number(),
				"toTime": zod.z.number(),
				"price": zod.z.number(),
				"allowedActions": zod.z.array(zod.z.union([
					zod.z.literal("hold"),
					zod.z.literal("open_long"),
					zod.z.literal("open_short"),
					zod.z.literal("close_long"),
					zod.z.literal("close_short")
				])),
				"decision": zod.z.object({
					"action": zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]),
					"confidence": zod.z.number(),
					"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
					"model": zod.z.string(),
					"time": zod.z.number(),
					"usage": zod.z.object({
						"input_tokens": zod.z.number(),
						"output_tokens": zod.z.number()
					}).optional(),
					"assessments": zod.z.object({
						"regime": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"fit": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"blocker": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						})
					}).optional()
				}).optional(),
				"outcome": zod.z.string(),
				"planId": zod.z.string().optional(),
				"strategyName": zod.z.string().optional(),
				"strategyVersion": zod.z.string().optional(),
				"evidence": zod.z.object({
					"evaluatedAt": zod.z.number(),
					"decisionMode": zod.z.union([zod.z.literal("jev"), zod.z.literal("strict")]).optional(),
					"history": zod.z.object({
						"source": zod.z.string(),
						"barSeconds": zod.z.number(),
						"count": zod.z.number(),
						"from": zod.z.number().optional(),
						"to": zod.z.number().optional(),
						"fetchedAt": zod.z.number().optional(),
						"issue": zod.z.string().optional(),
						"warning": zod.z.string().optional(),
						"diagnostic": zod.z.object({
							"stage": zod.z.string(),
							"code": zod.z.string(),
							"retryable": zod.z.boolean()
						}).optional()
					}),
					"features": zod.z.object({
						"quoteWindowSeconds": zod.z.number(),
						"quoteCount": zod.z.number(),
						"lower": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"upper": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"widthTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"lowerTouches": zod.z.number(),
						"upperTouches": zod.z.number(),
						"location": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"reboundTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"pullbackTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"spreadTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"longRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"shortRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()])
					}),
					"checks": zod.z.array(zod.z.object({
						"id": zod.z.string(),
						"label": zod.z.string(),
						"state": zod.z.union([
							zod.z.literal("unknown"),
							zod.z.literal("pass"),
							zod.z.literal("fail")
						]),
						"detail": zod.z.string(),
						"actions": zod.z.array(zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						])),
						"enforcement": zod.z.union([zod.z.literal("hard"), zod.z.literal("reference")]).optional(),
						"facts": zod.z.record(zod.z.string(), zod.z.union([
							zod.z.literal(null),
							zod.z.string(),
							zod.z.number(),
							zod.z.literal(false),
							zod.z.literal(true)
						])).optional()
					})),
					"allowedActions": zod.z.array(zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]))
				}).optional(),
				"planStatus": zod.z.union([
					zod.z.literal("blocked"),
					zod.z.literal("prepared"),
					zod.z.literal("submitted"),
					zod.z.literal("hold"),
					zod.z.literal("restricted"),
					zod.z.literal("candidate")
				]).optional(),
				"reviewNotes": zod.z.array(zod.z.string()).optional()
			})).optional(),
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			}).optional(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"runId": zod.z.string().optional(),
			"startedAt": zod.z.number().optional(),
			"expiresAt": zod.z.number().optional(),
			"equityBaseline": zod.z.number().optional(),
			"sampleCount": zod.z.number(),
			"planCount": zod.z.number(),
			"openingPlanCount": zod.z.number().optional(),
			"lastPlanId": zod.z.string().optional(),
			"lastDecision": zod.z.object({
				"action": zod.z.union([
					zod.z.literal("hold"),
					zod.z.literal("open_long"),
					zod.z.literal("open_short"),
					zod.z.literal("close_long"),
					zod.z.literal("close_short")
				]),
				"confidence": zod.z.number(),
				"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
				"model": zod.z.string(),
				"time": zod.z.number(),
				"usage": zod.z.object({
					"input_tokens": zod.z.number(),
					"output_tokens": zod.z.number()
				}).optional(),
				"assessments": zod.z.object({
					"regime": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					}),
					"fit": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					}),
					"blocker": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					})
				}).optional()
			}).optional(),
			"events": zod.z.array(zod.z.object({
				"time": zod.z.number(),
				"message": zod.z.string()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStatus_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStatus_result$schema$value ??= zod.z.object({
			"markets": zod.z.array(zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("checking"),
					zod.z.literal("sampling"),
					zod.z.literal("waiting_quote"),
					zod.z.literal("deciding"),
					zod.z.literal("waiting_plan")
				]).optional(),
				"message": zod.z.string(),
				"sampleCount": zod.z.number(),
				"samples": zod.z.array(zod.z.object({
					"time": zod.z.number(),
					"price": zod.z.number(),
					"bid": zod.z.number().optional(),
					"ask": zod.z.number().optional()
				})).optional(),
				"analyses": zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"startedAt": zod.z.number(),
					"responseAt": zod.z.number().optional(),
					"finishedAt": zod.z.number().optional(),
					"sampleCount": zod.z.number(),
					"fromTime": zod.z.number(),
					"toTime": zod.z.number(),
					"price": zod.z.number(),
					"allowedActions": zod.z.array(zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					])),
					"decision": zod.z.object({
						"action": zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						]),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
						"model": zod.z.string(),
						"time": zod.z.number(),
						"usage": zod.z.object({
							"input_tokens": zod.z.number(),
							"output_tokens": zod.z.number()
						}).optional(),
						"assessments": zod.z.object({
							"regime": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							}),
							"fit": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							}),
							"blocker": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							})
						}).optional()
					}).optional(),
					"outcome": zod.z.string(),
					"planId": zod.z.string().optional(),
					"strategyName": zod.z.string().optional(),
					"strategyVersion": zod.z.string().optional(),
					"evidence": zod.z.object({
						"evaluatedAt": zod.z.number(),
						"decisionMode": zod.z.union([zod.z.literal("jev"), zod.z.literal("strict")]).optional(),
						"history": zod.z.object({
							"source": zod.z.string(),
							"barSeconds": zod.z.number(),
							"count": zod.z.number(),
							"from": zod.z.number().optional(),
							"to": zod.z.number().optional(),
							"fetchedAt": zod.z.number().optional(),
							"issue": zod.z.string().optional(),
							"warning": zod.z.string().optional(),
							"diagnostic": zod.z.object({
								"stage": zod.z.string(),
								"code": zod.z.string(),
								"retryable": zod.z.boolean()
							}).optional()
						}),
						"features": zod.z.object({
							"quoteWindowSeconds": zod.z.number(),
							"quoteCount": zod.z.number(),
							"lower": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"upper": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"widthTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"lowerTouches": zod.z.number(),
							"upperTouches": zod.z.number(),
							"location": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"reboundTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"pullbackTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"spreadTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"longRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"shortRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()])
						}),
						"checks": zod.z.array(zod.z.object({
							"id": zod.z.string(),
							"label": zod.z.string(),
							"state": zod.z.union([
								zod.z.literal("unknown"),
								zod.z.literal("pass"),
								zod.z.literal("fail")
							]),
							"detail": zod.z.string(),
							"actions": zod.z.array(zod.z.union([
								zod.z.literal("hold"),
								zod.z.literal("open_long"),
								zod.z.literal("open_short"),
								zod.z.literal("close_long"),
								zod.z.literal("close_short")
							])),
							"enforcement": zod.z.union([zod.z.literal("hard"), zod.z.literal("reference")]).optional(),
							"facts": zod.z.record(zod.z.string(), zod.z.union([
								zod.z.literal(null),
								zod.z.string(),
								zod.z.number(),
								zod.z.literal(false),
								zod.z.literal(true)
							])).optional()
						})),
						"allowedActions": zod.z.array(zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						]))
					}).optional(),
					"planStatus": zod.z.union([
						zod.z.literal("blocked"),
						zod.z.literal("prepared"),
						zod.z.literal("submitted"),
						zod.z.literal("hold"),
						zod.z.literal("restricted"),
						zod.z.literal("candidate")
					]).optional(),
					"reviewNotes": zod.z.array(zod.z.string()).optional()
				})).optional(),
				"lastDecision": zod.z.object({
					"action": zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]),
					"confidence": zod.z.number(),
					"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
					"model": zod.z.string(),
					"time": zod.z.number(),
					"usage": zod.z.object({
						"input_tokens": zod.z.number(),
						"output_tokens": zod.z.number()
					}).optional(),
					"assessments": zod.z.object({
						"regime": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"fit": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"blocker": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						})
					}).optional()
				}).optional(),
				"lastQuoteCheckedAt": zod.z.number().optional(),
				"nextDecisionAt": zod.z.number().optional(),
				"symbol": zod.z.string()
			})).optional(),
			"executionAuthorization": zod.z.object({
				"version": zod.z.string(),
				"acceptedAt": zod.z.number(),
				"runId": zod.z.string()
			}).optional(),
			"running": zod.z.boolean(),
			"message": zod.z.string(),
			"strategyNotices": zod.z.array(zod.z.string()).optional(),
			"phase": zod.z.union([
				zod.z.literal("checking"),
				zod.z.literal("sampling"),
				zod.z.literal("waiting_quote"),
				zod.z.literal("deciding"),
				zod.z.literal("waiting_plan")
			]).optional(),
			"lastQuoteCheckedAt": zod.z.number().optional(),
			"nextDecisionAt": zod.z.number().optional(),
			"openingCooldownUntil": zod.z.number().optional(),
			"nextRetryAt": zod.z.number().optional(),
			"accountCheckedAt": zod.z.number().optional(),
			"samples": zod.z.array(zod.z.object({
				"time": zod.z.number(),
				"price": zod.z.number(),
				"bid": zod.z.number().optional(),
				"ask": zod.z.number().optional()
			})).optional(),
			"analyses": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"startedAt": zod.z.number(),
				"responseAt": zod.z.number().optional(),
				"finishedAt": zod.z.number().optional(),
				"sampleCount": zod.z.number(),
				"fromTime": zod.z.number(),
				"toTime": zod.z.number(),
				"price": zod.z.number(),
				"allowedActions": zod.z.array(zod.z.union([
					zod.z.literal("hold"),
					zod.z.literal("open_long"),
					zod.z.literal("open_short"),
					zod.z.literal("close_long"),
					zod.z.literal("close_short")
				])),
				"decision": zod.z.object({
					"action": zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]),
					"confidence": zod.z.number(),
					"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
					"model": zod.z.string(),
					"time": zod.z.number(),
					"usage": zod.z.object({
						"input_tokens": zod.z.number(),
						"output_tokens": zod.z.number()
					}).optional(),
					"assessments": zod.z.object({
						"regime": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"fit": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"blocker": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						})
					}).optional()
				}).optional(),
				"outcome": zod.z.string(),
				"planId": zod.z.string().optional(),
				"strategyName": zod.z.string().optional(),
				"strategyVersion": zod.z.string().optional(),
				"evidence": zod.z.object({
					"evaluatedAt": zod.z.number(),
					"decisionMode": zod.z.union([zod.z.literal("jev"), zod.z.literal("strict")]).optional(),
					"history": zod.z.object({
						"source": zod.z.string(),
						"barSeconds": zod.z.number(),
						"count": zod.z.number(),
						"from": zod.z.number().optional(),
						"to": zod.z.number().optional(),
						"fetchedAt": zod.z.number().optional(),
						"issue": zod.z.string().optional(),
						"warning": zod.z.string().optional(),
						"diagnostic": zod.z.object({
							"stage": zod.z.string(),
							"code": zod.z.string(),
							"retryable": zod.z.boolean()
						}).optional()
					}),
					"features": zod.z.object({
						"quoteWindowSeconds": zod.z.number(),
						"quoteCount": zod.z.number(),
						"lower": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"upper": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"widthTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"lowerTouches": zod.z.number(),
						"upperTouches": zod.z.number(),
						"location": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"reboundTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"pullbackTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"spreadTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"longRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"shortRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()])
					}),
					"checks": zod.z.array(zod.z.object({
						"id": zod.z.string(),
						"label": zod.z.string(),
						"state": zod.z.union([
							zod.z.literal("unknown"),
							zod.z.literal("pass"),
							zod.z.literal("fail")
						]),
						"detail": zod.z.string(),
						"actions": zod.z.array(zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						])),
						"enforcement": zod.z.union([zod.z.literal("hard"), zod.z.literal("reference")]).optional(),
						"facts": zod.z.record(zod.z.string(), zod.z.union([
							zod.z.literal(null),
							zod.z.string(),
							zod.z.number(),
							zod.z.literal(false),
							zod.z.literal(true)
						])).optional()
					})),
					"allowedActions": zod.z.array(zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]))
				}).optional(),
				"planStatus": zod.z.union([
					zod.z.literal("blocked"),
					zod.z.literal("prepared"),
					zod.z.literal("submitted"),
					zod.z.literal("hold"),
					zod.z.literal("restricted"),
					zod.z.literal("candidate")
				]).optional(),
				"reviewNotes": zod.z.array(zod.z.string()).optional()
			})).optional(),
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			}).optional(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"runId": zod.z.string().optional(),
			"startedAt": zod.z.number().optional(),
			"expiresAt": zod.z.number().optional(),
			"equityBaseline": zod.z.number().optional(),
			"sampleCount": zod.z.number(),
			"planCount": zod.z.number(),
			"openingPlanCount": zod.z.number().optional(),
			"lastPlanId": zod.z.string().optional(),
			"lastDecision": zod.z.object({
				"action": zod.z.union([
					zod.z.literal("hold"),
					zod.z.literal("open_long"),
					zod.z.literal("open_short"),
					zod.z.literal("close_long"),
					zod.z.literal("close_short")
				]),
				"confidence": zod.z.number(),
				"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
				"model": zod.z.string(),
				"time": zod.z.number(),
				"usage": zod.z.object({
					"input_tokens": zod.z.number(),
					"output_tokens": zod.z.number()
				}).optional(),
				"assessments": zod.z.object({
					"regime": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					}),
					"fit": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					}),
					"blocker": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					})
				}).optional()
			}).optional(),
			"events": zod.z.array(zod.z.object({
				"time": zod.z.number(),
				"message": zod.z.string()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStop_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStop_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStop_result$schema$value ??= zod.z.object({
			"markets": zod.z.array(zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("checking"),
					zod.z.literal("sampling"),
					zod.z.literal("waiting_quote"),
					zod.z.literal("deciding"),
					zod.z.literal("waiting_plan")
				]).optional(),
				"message": zod.z.string(),
				"sampleCount": zod.z.number(),
				"samples": zod.z.array(zod.z.object({
					"time": zod.z.number(),
					"price": zod.z.number(),
					"bid": zod.z.number().optional(),
					"ask": zod.z.number().optional()
				})).optional(),
				"analyses": zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"startedAt": zod.z.number(),
					"responseAt": zod.z.number().optional(),
					"finishedAt": zod.z.number().optional(),
					"sampleCount": zod.z.number(),
					"fromTime": zod.z.number(),
					"toTime": zod.z.number(),
					"price": zod.z.number(),
					"allowedActions": zod.z.array(zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					])),
					"decision": zod.z.object({
						"action": zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						]),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
						"model": zod.z.string(),
						"time": zod.z.number(),
						"usage": zod.z.object({
							"input_tokens": zod.z.number(),
							"output_tokens": zod.z.number()
						}).optional(),
						"assessments": zod.z.object({
							"regime": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							}),
							"fit": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							}),
							"blocker": zod.z.object({
								"choice": zod.z.string(),
								"confidence": zod.z.number(),
								"probabilities": zod.z.record(zod.z.string(), zod.z.number())
							})
						}).optional()
					}).optional(),
					"outcome": zod.z.string(),
					"planId": zod.z.string().optional(),
					"strategyName": zod.z.string().optional(),
					"strategyVersion": zod.z.string().optional(),
					"evidence": zod.z.object({
						"evaluatedAt": zod.z.number(),
						"decisionMode": zod.z.union([zod.z.literal("jev"), zod.z.literal("strict")]).optional(),
						"history": zod.z.object({
							"source": zod.z.string(),
							"barSeconds": zod.z.number(),
							"count": zod.z.number(),
							"from": zod.z.number().optional(),
							"to": zod.z.number().optional(),
							"fetchedAt": zod.z.number().optional(),
							"issue": zod.z.string().optional(),
							"warning": zod.z.string().optional(),
							"diagnostic": zod.z.object({
								"stage": zod.z.string(),
								"code": zod.z.string(),
								"retryable": zod.z.boolean()
							}).optional()
						}),
						"features": zod.z.object({
							"quoteWindowSeconds": zod.z.number(),
							"quoteCount": zod.z.number(),
							"lower": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"upper": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"widthTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"lowerTouches": zod.z.number(),
							"upperTouches": zod.z.number(),
							"location": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"reboundTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"pullbackTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"spreadTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"longRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()]),
							"shortRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()])
						}),
						"checks": zod.z.array(zod.z.object({
							"id": zod.z.string(),
							"label": zod.z.string(),
							"state": zod.z.union([
								zod.z.literal("unknown"),
								zod.z.literal("pass"),
								zod.z.literal("fail")
							]),
							"detail": zod.z.string(),
							"actions": zod.z.array(zod.z.union([
								zod.z.literal("hold"),
								zod.z.literal("open_long"),
								zod.z.literal("open_short"),
								zod.z.literal("close_long"),
								zod.z.literal("close_short")
							])),
							"enforcement": zod.z.union([zod.z.literal("hard"), zod.z.literal("reference")]).optional(),
							"facts": zod.z.record(zod.z.string(), zod.z.union([
								zod.z.literal(null),
								zod.z.string(),
								zod.z.number(),
								zod.z.literal(false),
								zod.z.literal(true)
							])).optional()
						})),
						"allowedActions": zod.z.array(zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						]))
					}).optional(),
					"planStatus": zod.z.union([
						zod.z.literal("blocked"),
						zod.z.literal("prepared"),
						zod.z.literal("submitted"),
						zod.z.literal("hold"),
						zod.z.literal("restricted"),
						zod.z.literal("candidate")
					]).optional(),
					"reviewNotes": zod.z.array(zod.z.string()).optional()
				})).optional(),
				"lastDecision": zod.z.object({
					"action": zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]),
					"confidence": zod.z.number(),
					"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
					"model": zod.z.string(),
					"time": zod.z.number(),
					"usage": zod.z.object({
						"input_tokens": zod.z.number(),
						"output_tokens": zod.z.number()
					}).optional(),
					"assessments": zod.z.object({
						"regime": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"fit": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"blocker": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						})
					}).optional()
				}).optional(),
				"lastQuoteCheckedAt": zod.z.number().optional(),
				"nextDecisionAt": zod.z.number().optional(),
				"symbol": zod.z.string()
			})).optional(),
			"executionAuthorization": zod.z.object({
				"version": zod.z.string(),
				"acceptedAt": zod.z.number(),
				"runId": zod.z.string()
			}).optional(),
			"running": zod.z.boolean(),
			"message": zod.z.string(),
			"strategyNotices": zod.z.array(zod.z.string()).optional(),
			"phase": zod.z.union([
				zod.z.literal("checking"),
				zod.z.literal("sampling"),
				zod.z.literal("waiting_quote"),
				zod.z.literal("deciding"),
				zod.z.literal("waiting_plan")
			]).optional(),
			"lastQuoteCheckedAt": zod.z.number().optional(),
			"nextDecisionAt": zod.z.number().optional(),
			"openingCooldownUntil": zod.z.number().optional(),
			"nextRetryAt": zod.z.number().optional(),
			"accountCheckedAt": zod.z.number().optional(),
			"samples": zod.z.array(zod.z.object({
				"time": zod.z.number(),
				"price": zod.z.number(),
				"bid": zod.z.number().optional(),
				"ask": zod.z.number().optional()
			})).optional(),
			"analyses": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"startedAt": zod.z.number(),
				"responseAt": zod.z.number().optional(),
				"finishedAt": zod.z.number().optional(),
				"sampleCount": zod.z.number(),
				"fromTime": zod.z.number(),
				"toTime": zod.z.number(),
				"price": zod.z.number(),
				"allowedActions": zod.z.array(zod.z.union([
					zod.z.literal("hold"),
					zod.z.literal("open_long"),
					zod.z.literal("open_short"),
					zod.z.literal("close_long"),
					zod.z.literal("close_short")
				])),
				"decision": zod.z.object({
					"action": zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]),
					"confidence": zod.z.number(),
					"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
					"model": zod.z.string(),
					"time": zod.z.number(),
					"usage": zod.z.object({
						"input_tokens": zod.z.number(),
						"output_tokens": zod.z.number()
					}).optional(),
					"assessments": zod.z.object({
						"regime": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"fit": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						}),
						"blocker": zod.z.object({
							"choice": zod.z.string(),
							"confidence": zod.z.number(),
							"probabilities": zod.z.record(zod.z.string(), zod.z.number())
						})
					}).optional()
				}).optional(),
				"outcome": zod.z.string(),
				"planId": zod.z.string().optional(),
				"strategyName": zod.z.string().optional(),
				"strategyVersion": zod.z.string().optional(),
				"evidence": zod.z.object({
					"evaluatedAt": zod.z.number(),
					"decisionMode": zod.z.union([zod.z.literal("jev"), zod.z.literal("strict")]).optional(),
					"history": zod.z.object({
						"source": zod.z.string(),
						"barSeconds": zod.z.number(),
						"count": zod.z.number(),
						"from": zod.z.number().optional(),
						"to": zod.z.number().optional(),
						"fetchedAt": zod.z.number().optional(),
						"issue": zod.z.string().optional(),
						"warning": zod.z.string().optional(),
						"diagnostic": zod.z.object({
							"stage": zod.z.string(),
							"code": zod.z.string(),
							"retryable": zod.z.boolean()
						}).optional()
					}),
					"features": zod.z.object({
						"quoteWindowSeconds": zod.z.number(),
						"quoteCount": zod.z.number(),
						"lower": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"upper": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"widthTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"lowerTouches": zod.z.number(),
						"upperTouches": zod.z.number(),
						"location": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"reboundTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"pullbackTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"spreadTicks": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"longRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()]),
						"shortRewardCostRatio": zod.z.union([zod.z.literal(null), zod.z.number()])
					}),
					"checks": zod.z.array(zod.z.object({
						"id": zod.z.string(),
						"label": zod.z.string(),
						"state": zod.z.union([
							zod.z.literal("unknown"),
							zod.z.literal("pass"),
							zod.z.literal("fail")
						]),
						"detail": zod.z.string(),
						"actions": zod.z.array(zod.z.union([
							zod.z.literal("hold"),
							zod.z.literal("open_long"),
							zod.z.literal("open_short"),
							zod.z.literal("close_long"),
							zod.z.literal("close_short")
						])),
						"enforcement": zod.z.union([zod.z.literal("hard"), zod.z.literal("reference")]).optional(),
						"facts": zod.z.record(zod.z.string(), zod.z.union([
							zod.z.literal(null),
							zod.z.string(),
							zod.z.number(),
							zod.z.literal(false),
							zod.z.literal(true)
						])).optional()
					})),
					"allowedActions": zod.z.array(zod.z.union([
						zod.z.literal("hold"),
						zod.z.literal("open_long"),
						zod.z.literal("open_short"),
						zod.z.literal("close_long"),
						zod.z.literal("close_short")
					]))
				}).optional(),
				"planStatus": zod.z.union([
					zod.z.literal("blocked"),
					zod.z.literal("prepared"),
					zod.z.literal("submitted"),
					zod.z.literal("hold"),
					zod.z.literal("restricted"),
					zod.z.literal("candidate")
				]).optional(),
				"reviewNotes": zod.z.array(zod.z.string()).optional()
			})).optional(),
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			}).optional(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"runId": zod.z.string().optional(),
			"startedAt": zod.z.number().optional(),
			"expiresAt": zod.z.number().optional(),
			"equityBaseline": zod.z.number().optional(),
			"sampleCount": zod.z.number(),
			"planCount": zod.z.number(),
			"openingPlanCount": zod.z.number().optional(),
			"lastPlanId": zod.z.string().optional(),
			"lastDecision": zod.z.object({
				"action": zod.z.union([
					zod.z.literal("hold"),
					zod.z.literal("open_long"),
					zod.z.literal("open_short"),
					zod.z.literal("close_long"),
					zod.z.literal("close_short")
				]),
				"confidence": zod.z.number(),
				"probabilities": zod.z.record(zod.z.string(), zod.z.number()),
				"model": zod.z.string(),
				"time": zod.z.number(),
				"usage": zod.z.object({
					"input_tokens": zod.z.number(),
					"output_tokens": zod.z.number()
				}).optional(),
				"assessments": zod.z.object({
					"regime": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					}),
					"fit": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					}),
					"blocker": zod.z.object({
						"choice": zod.z.string(),
						"confidence": zod.z.number(),
						"probabilities": zod.z.record(zod.z.string(), zod.z.number())
					})
				}).optional()
			}).optional(),
			"events": zod.z.array(zod.z.object({
				"time": zod.z.number(),
				"message": zod.z.string()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchTemplates_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchTemplates_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchTemplates_result$schema$value ??= zod.z.array(zod.z.object({
			"name": zod.z.string(),
			"config": zod.z.object({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.object({
					"symbol": zod.z.string(),
					"instrument": zod.z.object({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.object({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.object({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.object({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.object({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.object({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.object({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			})
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"binding": zod.z.object({
				"assetId": zod.z.string().readonly(),
				"versionId": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"treeDigest": zod.z.string().readonly()
			}).readonly(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"token": zod.z.string().readonly(),
			"files": zod.z.array(zod.z.object({
				"path": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly()
			})).readonly(),
			"retained": zod.z.array(zod.z.object({
				"path": zod.z.string().readonly(),
				"reason": zod.z.string().readonly()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorCheckUpdate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorCheckUpdate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorCheckUpdate_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]),
			"cliVersion": zod.z.string().optional(),
			"latestVersion": zod.z.string().optional(),
			"updateAvailable": zod.z.boolean(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"message": zod.z.string(),
			"inspection": zod.z.object({
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"fetchedAt": zod.z.number(),
				"balance": zod.z.number(),
				"registration": zod.z.json(),
				"pool": zod.z.json()
			}).optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"action": zod.z.union([
					zod.z.object({
						"kind": zod.z.literal("create-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("update-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly().optional()
					}),
					zod.z.object({
						"kind": zod.z.literal("add-factor").readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("replace-factor").readonly(),
						"factorId": zod.z.string().readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("remove-factor").readonly(),
						"factorId": zod.z.string().readonly()
					}),
					zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("budget").readonly(),
						"batch": zod.z.object({
							"hypothesis": zod.z.string().readonly(),
							"maxRuns": zod.z.number().readonly(),
							"creditThreshold": zod.z.number().readonly(),
							"startDate": zod.z.string().readonly(),
							"endDate": zod.z.string().readonly(),
							"cycle": zod.z.number().readonly()
						}).readonly()
					})
				]),
				"summary": zod.z.string(),
				"snapshot": zod.z.json(),
				"snapshotHash": zod.z.string(),
				"createdAt": zod.z.number(),
				"expiresAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired")
				]),
				"result": zod.z.json().optional()
			})),
			"budgets": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"runsUsed": zod.z.number(),
				"creditsUsed": zod.z.number(),
				"baseline": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("stopped"),
					zod.z.literal("exhausted")
				]),
				"hypothesis": zod.z.string().readonly(),
				"maxRuns": zod.z.number().readonly(),
				"creditThreshold": zod.z.number().readonly(),
				"startDate": zod.z.string().readonly(),
				"endDate": zod.z.string().readonly(),
				"cycle": zod.z.number().readonly()
			})),
			"runs": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"budgetId": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"candidate": zod.z.object({
					"requestId": zod.z.string().readonly(),
					"name": zod.z.string().readonly(),
					"formula": zod.z.string().readonly().optional(),
					"code": zod.z.string().readonly().optional(),
					"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
				}),
				"workflowId": zod.z.string().optional(),
				"runId": zod.z.string().optional(),
				"createdAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("creating"),
					zod.z.literal("running")
				]),
				"result": zod.z.json().optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0$schema$value ??= zod.z.object({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"sessionId": zod.z.string(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}),
			"action": zod.z.union([
				zod.z.object({
					"kind": zod.z.literal("create-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("update-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly().optional()
				}),
				zod.z.object({
					"kind": zod.z.literal("add-factor").readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("replace-factor").readonly(),
					"factorId": zod.z.string().readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("remove-factor").readonly(),
					"factorId": zod.z.string().readonly()
				}),
				zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
				zod.z.object({
					"kind": zod.z.literal("budget").readonly(),
					"batch": zod.z.object({
						"hypothesis": zod.z.string().readonly(),
						"maxRuns": zod.z.number().readonly(),
						"creditThreshold": zod.z.number().readonly(),
						"startDate": zod.z.string().readonly(),
						"endDate": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}).readonly()
				})
			]),
			"summary": zod.z.string(),
			"snapshot": zod.z.json(),
			"snapshotHash": zod.z.string(),
			"createdAt": zod.z.number(),
			"expiresAt": zod.z.number(),
			"status": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("prepared"),
				zod.z.literal("executing"),
				zod.z.literal("completed"),
				zod.z.literal("unknown"),
				zod.z.literal("cancelled"),
				zod.z.literal("expired")
			]),
			"result": zod.z.json().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0$schema$value ??= zod.z.object({ "credentials": zod.z.object({
			"phone": zod.z.string().readonly(),
			"password": zod.z.string().readonly()
		}).optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]),
			"cliVersion": zod.z.string().optional(),
			"latestVersion": zod.z.string().optional(),
			"updateAvailable": zod.z.boolean(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"message": zod.z.string(),
			"inspection": zod.z.object({
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"fetchedAt": zod.z.number(),
				"balance": zod.z.number(),
				"registration": zod.z.json(),
				"pool": zod.z.json()
			}).optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"action": zod.z.union([
					zod.z.object({
						"kind": zod.z.literal("create-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("update-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly().optional()
					}),
					zod.z.object({
						"kind": zod.z.literal("add-factor").readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("replace-factor").readonly(),
						"factorId": zod.z.string().readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("remove-factor").readonly(),
						"factorId": zod.z.string().readonly()
					}),
					zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("budget").readonly(),
						"batch": zod.z.object({
							"hypothesis": zod.z.string().readonly(),
							"maxRuns": zod.z.number().readonly(),
							"creditThreshold": zod.z.number().readonly(),
							"startDate": zod.z.string().readonly(),
							"endDate": zod.z.string().readonly(),
							"cycle": zod.z.number().readonly()
						}).readonly()
					})
				]),
				"summary": zod.z.string(),
				"snapshot": zod.z.json(),
				"snapshotHash": zod.z.string(),
				"createdAt": zod.z.number(),
				"expiresAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired")
				]),
				"result": zod.z.json().optional()
			})),
			"budgets": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"runsUsed": zod.z.number(),
				"creditsUsed": zod.z.number(),
				"baseline": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("stopped"),
					zod.z.literal("exhausted")
				]),
				"hypothesis": zod.z.string().readonly(),
				"maxRuns": zod.z.number().readonly(),
				"creditThreshold": zod.z.number().readonly(),
				"startDate": zod.z.string().readonly(),
				"endDate": zod.z.string().readonly(),
				"cycle": zod.z.number().readonly()
			})),
			"runs": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"budgetId": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"candidate": zod.z.object({
					"requestId": zod.z.string().readonly(),
					"name": zod.z.string().readonly(),
					"formula": zod.z.string().readonly().optional(),
					"code": zod.z.string().readonly().optional(),
					"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
				}),
				"workflowId": zod.z.string().optional(),
				"runId": zod.z.string().optional(),
				"createdAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("creating"),
					zod.z.literal("running")
				]),
				"result": zod.z.json().optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDisconnect_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDisconnect_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDisconnect_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]),
			"cliVersion": zod.z.string().optional(),
			"latestVersion": zod.z.string().optional(),
			"updateAvailable": zod.z.boolean(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"message": zod.z.string(),
			"inspection": zod.z.object({
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"fetchedAt": zod.z.number(),
				"balance": zod.z.number(),
				"registration": zod.z.json(),
				"pool": zod.z.json()
			}).optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"action": zod.z.union([
					zod.z.object({
						"kind": zod.z.literal("create-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("update-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly().optional()
					}),
					zod.z.object({
						"kind": zod.z.literal("add-factor").readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("replace-factor").readonly(),
						"factorId": zod.z.string().readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("remove-factor").readonly(),
						"factorId": zod.z.string().readonly()
					}),
					zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("budget").readonly(),
						"batch": zod.z.object({
							"hypothesis": zod.z.string().readonly(),
							"maxRuns": zod.z.number().readonly(),
							"creditThreshold": zod.z.number().readonly(),
							"startDate": zod.z.string().readonly(),
							"endDate": zod.z.string().readonly(),
							"cycle": zod.z.number().readonly()
						}).readonly()
					})
				]),
				"summary": zod.z.string(),
				"snapshot": zod.z.json(),
				"snapshotHash": zod.z.string(),
				"createdAt": zod.z.number(),
				"expiresAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired")
				]),
				"result": zod.z.json().optional()
			})),
			"budgets": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"runsUsed": zod.z.number(),
				"creditsUsed": zod.z.number(),
				"baseline": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("stopped"),
					zod.z.literal("exhausted")
				]),
				"hypothesis": zod.z.string().readonly(),
				"maxRuns": zod.z.number().readonly(),
				"creditThreshold": zod.z.number().readonly(),
				"startDate": zod.z.string().readonly(),
				"endDate": zod.z.string().readonly(),
				"cycle": zod.z.number().readonly()
			})),
			"runs": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"budgetId": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"candidate": zod.z.object({
					"requestId": zod.z.string().readonly(),
					"name": zod.z.string().readonly(),
					"formula": zod.z.string().readonly().optional(),
					"code": zod.z.string().readonly().optional(),
					"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
				}),
				"workflowId": zod.z.string().optional(),
				"runId": zod.z.string().optional(),
				"createdAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("creating"),
					zod.z.literal("running")
				]),
				"result": zod.z.json().optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0$schema$value ??= zod.z.object({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_result$schema$value ??= zod.z.object({
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}),
			"fetchedAt": zod.z.number(),
			"balance": zod.z.number(),
			"registration": zod.z.json(),
			"pool": zod.z.json()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0$schema$value ??= zod.z.object({ "enabled": zod.z.boolean() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]),
			"cliVersion": zod.z.string().optional(),
			"latestVersion": zod.z.string().optional(),
			"updateAvailable": zod.z.boolean(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"message": zod.z.string(),
			"inspection": zod.z.object({
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"fetchedAt": zod.z.number(),
				"balance": zod.z.number(),
				"registration": zod.z.json(),
				"pool": zod.z.json()
			}).optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"action": zod.z.union([
					zod.z.object({
						"kind": zod.z.literal("create-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("update-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly().optional()
					}),
					zod.z.object({
						"kind": zod.z.literal("add-factor").readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("replace-factor").readonly(),
						"factorId": zod.z.string().readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("remove-factor").readonly(),
						"factorId": zod.z.string().readonly()
					}),
					zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("budget").readonly(),
						"batch": zod.z.object({
							"hypothesis": zod.z.string().readonly(),
							"maxRuns": zod.z.number().readonly(),
							"creditThreshold": zod.z.number().readonly(),
							"startDate": zod.z.string().readonly(),
							"endDate": zod.z.string().readonly(),
							"cycle": zod.z.number().readonly()
						}).readonly()
					})
				]),
				"summary": zod.z.string(),
				"snapshot": zod.z.json(),
				"snapshotHash": zod.z.string(),
				"createdAt": zod.z.number(),
				"expiresAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired")
				]),
				"result": zod.z.json().optional()
			})),
			"budgets": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"runsUsed": zod.z.number(),
				"creditsUsed": zod.z.number(),
				"baseline": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("stopped"),
					zod.z.literal("exhausted")
				]),
				"hypothesis": zod.z.string().readonly(),
				"maxRuns": zod.z.number().readonly(),
				"creditThreshold": zod.z.number().readonly(),
				"startDate": zod.z.string().readonly(),
				"endDate": zod.z.string().readonly(),
				"cycle": zod.z.number().readonly()
			})),
			"runs": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"budgetId": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"candidate": zod.z.object({
					"requestId": zod.z.string().readonly(),
					"name": zod.z.string().readonly(),
					"formula": zod.z.string().readonly().optional(),
					"code": zod.z.string().readonly().optional(),
					"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
				}),
				"workflowId": zod.z.string().optional(),
				"runId": zod.z.string().optional(),
				"createdAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("creating"),
					zod.z.literal("running")
				]),
				"result": zod.z.json().optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0$schema$value ??= zod.z.object({
			"action": zod.z.union([
				zod.z.object({
					"kind": zod.z.literal("create-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("update-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly().optional()
				}),
				zod.z.object({
					"kind": zod.z.literal("add-factor").readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("replace-factor").readonly(),
					"factorId": zod.z.string().readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("remove-factor").readonly(),
					"factorId": zod.z.string().readonly()
				}),
				zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
				zod.z.object({
					"kind": zod.z.literal("budget").readonly(),
					"batch": zod.z.object({
						"hypothesis": zod.z.string().readonly(),
						"maxRuns": zod.z.number().readonly(),
						"creditThreshold": zod.z.number().readonly(),
						"startDate": zod.z.string().readonly(),
						"endDate": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}).readonly()
				})
			]),
			"sessionId": zod.z.string().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"sessionId": zod.z.string(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}),
			"action": zod.z.union([
				zod.z.object({
					"kind": zod.z.literal("create-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("update-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly().optional()
				}),
				zod.z.object({
					"kind": zod.z.literal("add-factor").readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("replace-factor").readonly(),
					"factorId": zod.z.string().readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("remove-factor").readonly(),
					"factorId": zod.z.string().readonly()
				}),
				zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
				zod.z.object({
					"kind": zod.z.literal("budget").readonly(),
					"batch": zod.z.object({
						"hypothesis": zod.z.string().readonly(),
						"maxRuns": zod.z.number().readonly(),
						"creditThreshold": zod.z.number().readonly(),
						"startDate": zod.z.string().readonly(),
						"endDate": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}).readonly()
				})
			]),
			"summary": zod.z.string(),
			"snapshot": zod.z.json(),
			"snapshotHash": zod.z.string(),
			"createdAt": zod.z.number(),
			"expiresAt": zod.z.number(),
			"status": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("prepared"),
				zod.z.literal("executing"),
				zod.z.literal("completed"),
				zod.z.literal("unknown"),
				zod.z.literal("cancelled"),
				zod.z.literal("expired")
			]),
			"result": zod.z.json().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0$schema$value ??= zod.z.object({
			"kind": zod.z.union([
				zod.z.literal("pool"),
				zod.z.literal("workflows"),
				zod.z.literal("scores"),
				zod.z.literal("factor-info"),
				zod.z.literal("factor-result"),
				zod.z.literal("factors")
			]).readonly(),
			"id": zod.z.string().readonly().optional(),
			"page": zod.z.number().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_result$schema$value ??= zod.z.json();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0$schema$value ??= zod.z.object({ "planId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"sessionId": zod.z.string(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}),
			"action": zod.z.union([
				zod.z.object({
					"kind": zod.z.literal("create-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("update-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly().optional()
				}),
				zod.z.object({
					"kind": zod.z.literal("add-factor").readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("replace-factor").readonly(),
					"factorId": zod.z.string().readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.object({
					"kind": zod.z.literal("remove-factor").readonly(),
					"factorId": zod.z.string().readonly()
				}),
				zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
				zod.z.object({
					"kind": zod.z.literal("budget").readonly(),
					"batch": zod.z.object({
						"hypothesis": zod.z.string().readonly(),
						"maxRuns": zod.z.number().readonly(),
						"creditThreshold": zod.z.number().readonly(),
						"startDate": zod.z.string().readonly(),
						"endDate": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}).readonly()
				})
			]),
			"summary": zod.z.string(),
			"snapshot": zod.z.json(),
			"snapshotHash": zod.z.string(),
			"createdAt": zod.z.number(),
			"expiresAt": zod.z.number(),
			"status": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("prepared"),
				zod.z.literal("executing"),
				zod.z.literal("completed"),
				zod.z.literal("unknown"),
				zod.z.literal("cancelled"),
				zod.z.literal("expired")
			]),
			"result": zod.z.json().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0$schema$value ??= zod.z.object({ "runId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"budgetId": zod.z.string(),
			"sessionId": zod.z.string(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}),
			"candidate": zod.z.object({
				"requestId": zod.z.string().readonly(),
				"name": zod.z.string().readonly(),
				"formula": zod.z.string().readonly().optional(),
				"code": zod.z.string().readonly().optional(),
				"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
			}),
			"workflowId": zod.z.string().optional(),
			"runId": zod.z.string().optional(),
			"createdAt": zod.z.number(),
			"status": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("unknown"),
				zod.z.literal("creating"),
				zod.z.literal("running")
			]),
			"result": zod.z.json().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"topic": zod.z.boolean().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"binding": zod.z.object({
				"purpose": zod.z.union([
					zod.z.literal("ordinary"),
					zod.z.literal("role-helper"),
					zod.z.literal("contest"),
					zod.z.literal("factor-contest")
				]).readonly(),
				"contest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"factorContest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"contestConversation": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("main"),
					zod.z.literal("topic")
				]).readonly().optional()
			}).readonly(),
			"created": zod.z.boolean().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]),
			"cliVersion": zod.z.string().optional(),
			"latestVersion": zod.z.string().optional(),
			"updateAvailable": zod.z.boolean(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"message": zod.z.string(),
			"inspection": zod.z.object({
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"fetchedAt": zod.z.number(),
				"balance": zod.z.number(),
				"registration": zod.z.json(),
				"pool": zod.z.json()
			}).optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"action": zod.z.union([
					zod.z.object({
						"kind": zod.z.literal("create-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("update-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly().optional()
					}),
					zod.z.object({
						"kind": zod.z.literal("add-factor").readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("replace-factor").readonly(),
						"factorId": zod.z.string().readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("remove-factor").readonly(),
						"factorId": zod.z.string().readonly()
					}),
					zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("budget").readonly(),
						"batch": zod.z.object({
							"hypothesis": zod.z.string().readonly(),
							"maxRuns": zod.z.number().readonly(),
							"creditThreshold": zod.z.number().readonly(),
							"startDate": zod.z.string().readonly(),
							"endDate": zod.z.string().readonly(),
							"cycle": zod.z.number().readonly()
						}).readonly()
					})
				]),
				"summary": zod.z.string(),
				"snapshot": zod.z.json(),
				"snapshotHash": zod.z.string(),
				"createdAt": zod.z.number(),
				"expiresAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired")
				]),
				"result": zod.z.json().optional()
			})),
			"budgets": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"runsUsed": zod.z.number(),
				"creditsUsed": zod.z.number(),
				"baseline": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("stopped"),
					zod.z.literal("exhausted")
				]),
				"hypothesis": zod.z.string().readonly(),
				"maxRuns": zod.z.number().readonly(),
				"creditThreshold": zod.z.number().readonly(),
				"startDate": zod.z.string().readonly(),
				"endDate": zod.z.string().readonly(),
				"cycle": zod.z.number().readonly()
			})),
			"runs": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"budgetId": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"candidate": zod.z.object({
					"requestId": zod.z.string().readonly(),
					"name": zod.z.string().readonly(),
					"formula": zod.z.string().readonly().optional(),
					"code": zod.z.string().readonly().optional(),
					"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
				}),
				"workflowId": zod.z.string().optional(),
				"runId": zod.z.string().optional(),
				"createdAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("creating"),
					zod.z.literal("running")
				]),
				"result": zod.z.json().optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0$schema$value ??= zod.z.object({ "budgetId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorUpdate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorUpdate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorUpdate_result$schema$value ??= zod.z.object({
			"enabled": zod.z.boolean(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("error"),
				zod.z.literal("installing"),
				zod.z.literal("off")
			]),
			"cliVersion": zod.z.string().optional(),
			"latestVersion": zod.z.string().optional(),
			"updateAvailable": zod.z.boolean(),
			"identity": zod.z.object({
				"accountId": zod.z.string().readonly(),
				"contestId": zod.z.string().readonly()
			}).optional(),
			"message": zod.z.string(),
			"inspection": zod.z.object({
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"fetchedAt": zod.z.number(),
				"balance": zod.z.number(),
				"registration": zod.z.json(),
				"pool": zod.z.json()
			}).optional(),
			"plans": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"action": zod.z.union([
					zod.z.object({
						"kind": zod.z.literal("create-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("update-pool").readonly(),
						"name": zod.z.string().readonly(),
						"style": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly().optional()
					}),
					zod.z.object({
						"kind": zod.z.literal("add-factor").readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("replace-factor").readonly(),
						"factorId": zod.z.string().readonly(),
						"workflowId": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("remove-factor").readonly(),
						"factorId": zod.z.string().readonly()
					}),
					zod.z.object({ "kind": zod.z.literal("submit-pool").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("budget").readonly(),
						"batch": zod.z.object({
							"hypothesis": zod.z.string().readonly(),
							"maxRuns": zod.z.number().readonly(),
							"creditThreshold": zod.z.number().readonly(),
							"startDate": zod.z.string().readonly(),
							"endDate": zod.z.string().readonly(),
							"cycle": zod.z.number().readonly()
						}).readonly()
					})
				]),
				"summary": zod.z.string(),
				"snapshot": zod.z.json(),
				"snapshotHash": zod.z.string(),
				"createdAt": zod.z.number(),
				"expiresAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("prepared"),
					zod.z.literal("executing"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("cancelled"),
					zod.z.literal("expired")
				]),
				"result": zod.z.json().optional()
			})),
			"budgets": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"runsUsed": zod.z.number(),
				"creditsUsed": zod.z.number(),
				"baseline": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("stopped"),
					zod.z.literal("exhausted")
				]),
				"hypothesis": zod.z.string().readonly(),
				"maxRuns": zod.z.number().readonly(),
				"creditThreshold": zod.z.number().readonly(),
				"startDate": zod.z.string().readonly(),
				"endDate": zod.z.string().readonly(),
				"cycle": zod.z.number().readonly()
			})),
			"runs": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"budgetId": zod.z.string(),
				"sessionId": zod.z.string(),
				"identity": zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				}),
				"candidate": zod.z.object({
					"requestId": zod.z.string().readonly(),
					"name": zod.z.string().readonly(),
					"formula": zod.z.string().readonly().optional(),
					"code": zod.z.string().readonly().optional(),
					"direction": zod.z.union([zod.z.literal(0), zod.z.literal(1)]).readonly()
				}),
				"workflowId": zod.z.string().optional(),
				"runId": zod.z.string().optional(),
				"createdAt": zod.z.number(),
				"status": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("unknown"),
					zod.z.literal("creating"),
					zod.z.literal("running")
				]),
				"result": zod.z.json().optional()
			}))
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"data": zod.z.string().readonly(),
			"mediaType": zod.z.string().readonly(),
			"name": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_result$schema$value ??= zod.z.object({
			"file": zod.z.object({
				"attachmentId": zod.z.string().readonly(),
				"mediaType": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly(),
				"name": zod.z.string().readonly()
			}).readonly(),
			"parsing": zod.z.union([
				zod.z.object({
					"status": zod.z.literal("ready").readonly(),
					"kind": zod.z.literal("utf8-text").readonly()
				}),
				zod.z.object({
					"status": zod.z.literal("ready").readonly(),
					"kind": zod.z.union([
						zod.z.literal("pdf"),
						zod.z.literal("office-document"),
						zod.z.literal("spreadsheet")
					]).readonly()
				}),
				zod.z.object({
					"status": zod.z.literal("unsupported").readonly(),
					"reason": zod.z.string().readonly()
				}),
				zod.z.object({
					"status": zod.z.literal("failed").readonly(),
					"reason": zod.z.string().readonly()
				})
			]).readonly(),
			"attachedAt": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_result$schema$value ??= zod.z.object({
			"files": zod.z.array(zod.z.object({
				"file": zod.z.object({
					"attachmentId": zod.z.string().readonly(),
					"mediaType": zod.z.string().readonly(),
					"bytes": zod.z.number().readonly(),
					"name": zod.z.string().readonly()
				}).readonly(),
				"parsing": zod.z.union([
					zod.z.object({
						"status": zod.z.literal("ready").readonly(),
						"kind": zod.z.literal("utf8-text").readonly()
					}),
					zod.z.object({
						"status": zod.z.literal("ready").readonly(),
						"kind": zod.z.union([
							zod.z.literal("pdf"),
							zod.z.literal("office-document"),
							zod.z.literal("spreadsheet")
						]).readonly()
					}),
					zod.z.object({
						"status": zod.z.literal("unsupported").readonly(),
						"reason": zod.z.string().readonly()
					}),
					zod.z.object({
						"status": zod.z.literal("failed").readonly(),
						"reason": zod.z.string().readonly()
					})
				]).readonly(),
				"attachedAt": zod.z.number().readonly()
			})).readonly(),
			"limits": zod.z.object({
				"maxFileBytes": zod.z.number().readonly(),
				"maxSessionFileBytes": zod.z.number().readonly()
			}).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"attachmentId": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_result$schema$value ??= zod.z.object({
			"file": zod.z.object({
				"attachmentId": zod.z.string().readonly(),
				"mediaType": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly(),
				"name": zod.z.string().readonly()
			}).readonly(),
			"text": zod.z.string().readonly(),
			"truncated": zod.z.boolean().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0$schema$value ??= zod.z.union([zod.z.undefined(), zod.z.object({
			"blenderPath": zod.z.string().optional(),
			"neural": zod.z.boolean().optional()
		})]);
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_result$schema$value ??= zod.z.object({
			"supported": zod.z.boolean(),
			"installed": zod.z.boolean(),
			"running": zod.z.boolean(),
			"installing": zod.z.boolean(),
			"message": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0$schema$value ??= zod.z.object({
			"path": zod.z.string(),
			"body": zod.z.json().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_result$schema$value ??= zod.z.json();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyStatus_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyStatus_result$schema$value ??= zod.z.object({
			"supported": zod.z.boolean(),
			"installed": zod.z.boolean(),
			"running": zod.z.boolean(),
			"installing": zod.z.boolean(),
			"message": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0$schema$value ??= zod.z.object({
			"limit": zod.z.number().readonly().optional(),
			"includeArchived": zod.z.boolean().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_result$schema$value ??= zod.z.array(zod.z.object({
			"assetId": zod.z.string().readonly(),
			"sessionCount": zod.z.number().readonly(),
			"lastUsedAt": zod.z.number().readonly(),
			"recentSessionId": zod.z.string().readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string(),
			"continuePending": zod.z.boolean().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_result$schema$value ??= zod.z.object({
			"delivered": zod.z.number(),
			"pending": zod.z.number(),
			"uncertain": zod.z.number(),
			"unknownEvents": zod.z.number()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0$schema$value ??= zod.z.object({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_result$schema$value ??= zod.z.array(zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"binding": zod.z.object({
				"assetId": zod.z.string().readonly(),
				"versionId": zod.z.string().readonly(),
				"commit": zod.z.string().readonly(),
				"treeDigest": zod.z.string().readonly()
			}).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"title": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"parentSessionId": zod.z.string().readonly().optional(),
			"archived": zod.z.boolean().readonly(),
			"running": zod.z.boolean().readonly(),
			"runState": zod.z.union([
				zod.z.literal("idle"),
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("cancelled"),
				zod.z.literal("running")
			]).readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0$schema$value ??= zod.z.object({
			"action": zod.z.union([
				zod.z.literal("auto"),
				zod.z.literal("list"),
				zod.z.literal("verify"),
				zod.z.literal("save"),
				zod.z.literal("remove"),
				zod.z.literal("test")
			]),
			"model": zod.z.string().optional(),
			"draft": zod.z.object({
				"route": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"service": zod.z.string(),
				"name": zod.z.string(),
				"baseURL": zod.z.string(),
				"api": zod.z.string(),
				"apiKey": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"modelIds": zod.z.array(zod.z.string()),
				"auto": zod.z.boolean(),
				"reasoning": zod.z.union([zod.z.undefined(), zod.z.string()]).optional().describe("Optional route default used by the adapter for every model on this route."),
				"modelsJson": zod.z.union([zod.z.undefined(), zod.z.string()]).optional().describe("Optional advanced model declarations; omitted preserves existing overrides.")
			}).optional(),
			"route": zod.z.string().optional(),
			"enabled": zod.z.boolean().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_result$schema$value ??= zod.z.object({
			"catalog": zod.z.array(zod.z.object({
				"id": zod.z.string(),
				"name": zod.z.string(),
				"api": zod.z.string(),
				"variants": zod.z.array(zod.z.object({
					"id": zod.z.string(),
					"name": zod.z.string(),
					"baseURL": zod.z.string(),
					"catalogProvider": zod.z.string().optional()
				})),
				"docs": zod.z.string(),
				"discovery": zod.z.boolean(),
				"recommendations": zod.z.array(zod.z.object({
					"name": zod.z.string(),
					"exactId": zod.z.boolean().describe("True only when `name` is an API-callable model id, rather than a vendor family name."),
					"roles": zod.z.array(zod.z.union([
						zod.z.literal("economy"),
						zod.z.literal("balanced"),
						zod.z.literal("frontier"),
						zod.z.literal("coding"),
						zod.z.literal("vision"),
						zod.z.literal("long-context"),
						zod.z.literal("low-latency")
					])),
					"summary": zod.z.string(),
					"lifecycle": zod.z.union([
						zod.z.literal("stable"),
						zod.z.literal("preview"),
						zod.z.literal("experimental")
					]).optional(),
					"source": zod.z.string(),
					"checkedAt": zod.z.string()
				})).optional().describe("Discoverable before connection, but never copied into a live route automatically.")
			})),
			"connections": zod.z.array(zod.z.object({
				"route": zod.z.string(),
				"service": zod.z.string(),
				"name": zod.z.string(),
				"baseURL": zod.z.string(),
				"api": zod.z.string(),
				"configured": zod.z.boolean(),
				"auto": zod.z.boolean(),
				"modelIds": zod.z.array(zod.z.string()),
				"modelsJson": zod.z.string(),
				"reasoning": zod.z.string().optional(),
				"state": zod.z.string(),
				"message": zod.z.string()
			})),
			"verification": zod.z.object({
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("verified"),
					zod.z.literal("discovery-unavailable")
				]),
				"code": zod.z.string(),
				"message": zod.z.string(),
				"modelIds": zod.z.array(zod.z.string()),
				"modelProfiles": zod.z.array(zod.z.record(zod.z.string(), zod.z.json())).optional().describe("Host-suggested safe model declarations derived from a trusted service preset.")
			}).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"purpose": zod.z.union([
				zod.z.literal("ordinary"),
				zod.z.literal("role-helper"),
				zod.z.literal("contest"),
				zod.z.literal("factor-contest")
			]).readonly(),
			"contestConversation": zod.z.union([zod.z.literal("main"), zod.z.literal("topic")]).readonly().optional(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_result$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"binding": zod.z.object({
				"purpose": zod.z.union([
					zod.z.literal("ordinary"),
					zod.z.literal("role-helper"),
					zod.z.literal("contest"),
					zod.z.literal("factor-contest")
				]).readonly(),
				"contest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"factorContest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"contestConversation": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("main"),
					zod.z.literal("topic")
				]).readonly().optional()
			}).readonly(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0$schema$value ??= zod.z.object({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_result$schema$value ??= zod.z.array(zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"binding": zod.z.object({
				"purpose": zod.z.union([
					zod.z.literal("ordinary"),
					zod.z.literal("role-helper"),
					zod.z.literal("contest"),
					zod.z.literal("factor-contest")
				]).readonly(),
				"contest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"factorContest": zod.z.union([zod.z.undefined(), zod.z.object({
					"accountId": zod.z.string().readonly(),
					"contestId": zod.z.string().readonly()
				})]).readonly().optional(),
				"contestConversation": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("main"),
					zod.z.literal("topic")
				]).readonly().optional()
			}).readonly(),
			"createdAt": zod.z.number().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"title": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"parentSessionId": zod.z.string().readonly().optional(),
			"archived": zod.z.boolean().readonly(),
			"running": zod.z.boolean().readonly(),
			"runState": zod.z.union([
				zod.z.literal("idle"),
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("cancelled"),
				zod.z.literal("running")
			]).readonly()
		}));
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_result$schema$value ??= zod.z.object({ "forms": zod.z.array(zod.z.object({
			"assetId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"source": zod.z.union([zod.z.literal("skill"), zod.z.literal("agent")]).readonly(),
			"promptForm": zod.z.union([zod.z.object({
				"status": zod.z.literal("ready").readonly(),
				"form": zod.z.object({
					"version": zod.z.literal(1).readonly(),
					"task": zod.z.object({
						"placeholder": zod.z.string().readonly().optional(),
						"required": zod.z.boolean().readonly().optional()
					}).readonly().optional(),
					"fields": zod.z.array(zod.z.object({
						"key": zod.z.string().readonly(),
						"label": zod.z.string().readonly(),
						"type": zod.z.union([
							zod.z.literal("number"),
							zod.z.literal("text"),
							zod.z.literal("textarea"),
							zod.z.literal("select"),
							zod.z.literal("date")
						]).readonly(),
						"required": zod.z.boolean().readonly().optional(),
						"placeholder": zod.z.string().readonly().optional(),
						"help": zod.z.string().readonly().optional(),
						"default": zod.z.union([zod.z.string(), zod.z.number()]).readonly().optional(),
						"options": zod.z.array(zod.z.object({
							"label": zod.z.string().readonly(),
							"value": zod.z.string().readonly()
						})).readonly().optional()
					})).readonly(),
					"promptTemplate": zod.z.string().readonly()
				}).readonly(),
				"adaptations": zod.z.array(zod.z.object({
					"code": zod.z.literal("number-default-string").readonly(),
					"fieldKey": zod.z.string().readonly()
				})).readonly().optional()
			}), zod.z.object({
				"status": zod.z.literal("invalid").readonly(),
				"reason": zod.z.string().readonly()
			})]).readonly()
		})).readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"task": zod.z.string().readonly().optional(),
			"values": zod.z.record(zod.z.string(), zod.z.union([zod.z.string(), zod.z.number()])).readonly().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_result$schema$value ??= zod.z.object({ "text": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_result$schema$value ??= zod.z.object({ "skills": zod.z.array(zod.z.object({
			"assetId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"commit": zod.z.string().readonly(),
			"treeDigest": zod.z.string().readonly()
		})).readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"assetId": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_result$schema$value ??= zod.z.object({ "skills": zod.z.array(zod.z.object({
			"assetId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"commit": zod.z.string().readonly(),
			"treeDigest": zod.z.string().readonly()
		})).readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_result$schema$value ??= zod.z.object({ "results": zod.z.array(zod.z.union([zod.z.object({
			"status": zod.z.literal("ready").readonly(),
			"inputPath": zod.z.string().readonly(),
			"path": zod.z.string().readonly().describe("Canonical path relative to the addressed Session workspace."),
			"archived": zod.z.boolean().readonly().describe("Whether the Host copied an authorized external result into the Session workspace.")
		}), zod.z.object({
			"status": zod.z.literal("unavailable").readonly(),
			"inputPath": zod.z.string().readonly(),
			"reason": zod.z.string().readonly()
		})])).readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"paths": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_result$schema$value ??= zod.z.object({ "results": zod.z.array(zod.z.union([zod.z.object({
			"status": zod.z.literal("ready").readonly(),
			"inputPath": zod.z.string().readonly(),
			"path": zod.z.string().readonly().describe("Canonical path relative to the addressed Session workspace."),
			"archived": zod.z.boolean().readonly().describe("Whether the Host copied an authorized external result into the Session workspace.")
		}), zod.z.object({
			"status": zod.z.literal("unavailable").readonly(),
			"inputPath": zod.z.string().readonly(),
			"reason": zod.z.string().readonly()
		})])).readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"path": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_result$schema$value ??= zod.z.union([
			zod.z.object({
				"kind": zod.z.literal("directory").readonly(),
				"path": zod.z.string().readonly(),
				"bytes": zod.z.literal(0).readonly(),
				"entries": zod.z.array(zod.z.object({
					"name": zod.z.string().readonly(),
					"path": zod.z.string().readonly(),
					"type": zod.z.union([zod.z.literal("file"), zod.z.literal("directory")]).readonly(),
					"bytes": zod.z.number().readonly().optional()
				})).readonly()
			}),
			zod.z.object({
				"kind": zod.z.literal("text").readonly(),
				"path": zod.z.string().readonly(),
				"mediaType": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly(),
				"text": zod.z.string().readonly()
			}),
			zod.z.object({
				"kind": zod.z.literal("document").readonly(),
				"path": zod.z.string().readonly(),
				"mediaType": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly(),
				"text": zod.z.string().readonly(),
				"truncated": zod.z.boolean().readonly()
			}),
			zod.z.object({
				"kind": zod.z.literal("binary").readonly(),
				"path": zod.z.string().readonly(),
				"mediaType": zod.z.union([
					zod.z.literal("application/pdf"),
					zod.z.literal("image/png"),
					zod.z.literal("image/jpeg"),
					zod.z.literal("image/gif"),
					zod.z.literal("image/webp")
				]).readonly(),
				"bytes": zod.z.number().readonly(),
				"data": zod.z.string().readonly(),
				"url": zod.z.string().readonly().optional().describe("Authenticated same-Host stream used for PDFs that must not be buffered into RPC.")
			}),
			zod.z.object({
				"kind": zod.z.literal("resource").readonly(),
				"path": zod.z.string().readonly(),
				"mediaType": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly(),
				"url": zod.z.string().readonly().describe("Authenticated, workspace-contained URL that streams the complete local file."),
				"presentation": zod.z.union([
					zod.z.literal("text"),
					zod.z.literal("pdf"),
					zod.z.literal("image"),
					zod.z.literal("audio"),
					zod.z.literal("video"),
					zod.z.literal("external")
				]).readonly()
			}),
			zod.z.object({
				"kind": zod.z.literal("unsupported").readonly(),
				"path": zod.z.string().readonly(),
				"bytes": zod.z.number().readonly(),
				"reason": zod.z.string().readonly()
			})
		]);
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0$schema$value ??= zod.z.object({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_result$schema$value ??= zod.z.object({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"action": zod.z.union([
				zod.z.literal("archive"),
				zod.z.literal("restore"),
				zod.z.literal("delete")
			]).readonly(),
			"filesToken": zod.z.string().readonly().optional().describe("Issued by deletionPreview; scopes file erasure to the exact reviewed file versions.")
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0$schema$value ??= zod.z.object({ "preferredWorkspaceId": zod.z.string().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_result$schema$value ??= zod.z.object({
			"workspace": zod.z.object({
				"workspaceId": zod.z.string().readonly(),
				"path": zod.z.string().readonly(),
				"title": zod.z.string().readonly()
			}).readonly(),
			"source": zod.z.union([zod.z.literal("preferred"), zod.z.literal("managed")]).readonly(),
			"recoveredPreferredWorkspaceId": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0$schema$value ??= zod.z.object({ "preferredWorkspaceId": zod.z.string().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_result$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_result$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_result$schema$value ??= zod.z.object({
			"managedPath": zod.z.string().readonly(),
			"managedWorkspace": zod.z.object({
				"workspaceId": zod.z.string().readonly(),
				"path": zod.z.string().readonly(),
				"title": zod.z.string().readonly()
			}).readonly().optional(),
			"preferredWorkspace": zod.z.object({
				"workspaceId": zod.z.string().readonly(),
				"path": zod.z.string().readonly(),
				"title": zod.z.string().readonly()
			}).readonly().optional(),
			"preferredMissing": zod.z.boolean().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"purpose": zod.z.literal("authoring-helper").readonly().optional().describe("Explicitly create a hidden application helper; never inferred from its name."),
			"copyFrom": zod.z.strictObject({
				"agentId": zod.z.string().readonly(),
				"expectedRevision": zod.z.number().readonly()
			}).readonly().optional().describe("Explicit personal copy of a saved definition, checked before publication."),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.strictObject({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly().optional(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"versionIds": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"leadAgentId": zod.z.string().readonly(),
			"leadAgentRevision": zod.z.number().readonly(),
			"leadModel": zod.z.union([zod.z.strictObject({ "kind": zod.z.literal("default").readonly() }), zod.z.strictObject({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.strictObject({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.strictObject({
				"name": zod.z.string().readonly(),
				"agentId": zod.z.string().readonly(),
				"agentRevision": zod.z.number().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"model": zod.z.union([zod.z.strictObject({ "kind": zod.z.literal("default").readonly() }), zod.z.strictObject({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.strictObject({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"teamId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"teamId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"teamId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"name": zod.z.string().readonly(),
			"description": zod.z.string().readonly(),
			"leadAgentId": zod.z.string().readonly(),
			"leadAgentRevision": zod.z.number().readonly(),
			"leadModel": zod.z.union([zod.z.strictObject({ "kind": zod.z.literal("default").readonly() }), zod.z.strictObject({
				"kind": zod.z.literal("fixed").readonly(),
				"selection": zod.z.strictObject({
					"provider": zod.z.string().readonly(),
					"model": zod.z.string().readonly(),
					"reasoningEffort": zod.z.string().readonly().optional()
				}).readonly()
			})]).readonly(),
			"members": zod.z.array(zod.z.strictObject({
				"name": zod.z.string().readonly(),
				"agentId": zod.z.string().readonly(),
				"agentRevision": zod.z.number().readonly(),
				"context": zod.z.union([zod.z.literal("fresh"), zod.z.literal("fork")]).readonly(),
				"model": zod.z.union([zod.z.strictObject({ "kind": zod.z.literal("default").readonly() }), zod.z.strictObject({
					"kind": zod.z.literal("fixed").readonly(),
					"selection": zod.z.strictObject({
						"provider": zod.z.string().readonly(),
						"model": zod.z.string().readonly(),
						"reasoningEffort": zod.z.string().readonly().optional()
					}).readonly()
				})]).readonly()
			})).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"purpose": zod.z.literal("authoring-helper").readonly().optional().describe("Explicitly create a hidden application helper; never inferred from its name."),
			"copyFrom": zod.z.strictObject({
				"agentId": zod.z.string().readonly(),
				"expectedRevision": zod.z.number().readonly()
			}).readonly().optional().describe("Explicit personal copy of a saved definition, checked before publication."),
			"name": zod.z.string().readonly(),
			"role": zod.z.string().readonly(),
			"mode": zod.z.union([zod.z.literal("dynamic"), zod.z.literal("fixed")]).readonly(),
			"model": zod.z.strictObject({
				"provider": zod.z.string().readonly(),
				"model": zod.z.string().readonly(),
				"reasoningEffort": zod.z.string().readonly().optional()
			}).readonly().optional(),
			"permission": zod.z.union([
				zod.z.literal("read-only"),
				zod.z.literal("workspace-write"),
				zod.z.literal("danger-full-access")
			]).readonly().optional(),
			"sourceVersionId": zod.z.string().readonly().optional(),
			"versionIds": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"toolCallId": zod.z.string().readonly(),
			"expectedTreeDigest": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"kind": zod.z.union([
				zod.z.literal("skill"),
				zod.z.literal("agent"),
				zod.z.literal("agent-team")
			]).readonly(),
			"sessionId": zod.z.string().readonly(),
			"agentId": zod.z.string().readonly(),
			"expectedRevision": zod.z.number().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"apiKey": zod.z.string().optional(),
			"translator": zod.z.strictObject({
				"provider": zod.z.string(),
				"model": zod.z.string()
			}).optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0_strict$schema$value ??= zod.z.strictObject({ "enabled": zod.z.boolean() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"kind": zod.z.union([
				zod.z.literal("account"),
				zod.z.literal("positions"),
				zod.z.literal("open-orders"),
				zod.z.literal("orders"),
				zod.z.literal("trades"),
				zod.z.literal("ranking"),
				zod.z.literal("ranking-me"),
				zod.z.literal("settlements"),
				zod.z.literal("quote"),
				zod.z.literal("varieties")
			]).readonly(),
			"symbol": zod.z.string().readonly().optional(),
			"date": zod.z.string().readonly().optional(),
			"lastId": zod.z.string().readonly().optional(),
			"board": zod.z.union([zod.z.literal("live"), zod.z.literal("settled")]).readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"topic": zod.z.boolean().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"symbol": zod.z.string(),
			"barSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"name": zod.z.string(),
			"config": zod.z.strictObject({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.strictObject({
					"symbol": zod.z.string(),
					"instrument": zod.z.strictObject({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.strictObject({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			})
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"config": zod.z.strictObject({
				"executionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("manual"),
					zod.z.literal("automatic")
				]).optional(),
				"symbol": zod.z.string(),
				"contracts": zod.z.union([zod.z.undefined(), zod.z.array(zod.z.strictObject({
					"symbol": zod.z.string(),
					"instrument": zod.z.strictObject({
						"product": zod.z.string(),
						"exchange": zod.z.union([
							zod.z.literal("SHF"),
							zod.z.literal("DCE"),
							zod.z.literal("CZC"),
							zod.z.literal("CFE"),
							zod.z.literal("INE"),
							zod.z.literal("GFE")
						]),
						"tickSize": zod.z.number()
					})
				}))]).optional().describe("Selected actual contracts; omitted for older single-contract configurations."),
				"volume": zod.z.number(),
				"intervalSeconds": zod.z.number(),
				"decisionIntervalSeconds": zod.z.number().optional(),
				"openingCooldownSeconds": zod.z.number().optional(),
				"decisionMode": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("jev"),
					zod.z.literal("strict")
				]).optional(),
				"durationMinutes": zod.z.number(),
				"minConfidence": zod.z.number(),
				"maxEquityDrop": zod.z.number(),
				"maxPlans": zod.z.number(),
				"instructions": zod.z.string(),
				"strategyName": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"actionCriteria": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"hold": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"open_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_long": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
					"close_short": zod.z.union([zod.z.undefined(), zod.z.string()]).optional()
				})]).optional(),
				"referenceMaterial": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"allowedSide": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("both"),
					zod.z.literal("long_only"),
					zod.z.literal("short_only")
				]).optional(),
				"minSamples": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"maxSpread": zod.z.union([zod.z.undefined(), zod.z.number()]).optional(),
				"builtInTemplate": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("rb-range"),
					zod.z.literal("range"),
					zod.z.literal("trend"),
					zod.z.literal("breakout")
				]).optional(),
				"customStrategy": zod.z.union([
					zod.z.undefined(),
					zod.z.literal(false),
					zod.z.literal(true)
				]).optional(),
				"instrument": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"product": zod.z.string(),
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"tickSize": zod.z.number()
				})]).optional(),
				"signalRules": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"kind": zod.z.union([zod.z.literal("trend"), zod.z.literal("breakout")]),
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number(),
					"fastBars": zod.z.number(),
					"slowBars": zod.z.number(),
					"pullbackTicks": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"bufferTicks": zod.z.number(),
					"maxChaseTicks": zod.z.number()
				})]).optional(),
				"autoHistory": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"exchange": zod.z.union([
						zod.z.literal("SHF"),
						zod.z.literal("DCE"),
						zod.z.literal("CZC"),
						zod.z.literal("CFE"),
						zod.z.literal("INE"),
						zod.z.literal("GFE")
					]),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)])
				})]).optional(),
				"history": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"datasetId": zod.z.string(),
					"barSeconds": zod.z.union([zod.z.literal(60), zod.z.literal(300)]),
					"timeMeaning": zod.z.union([zod.z.literal("open"), zod.z.literal("close")]),
					"refresh": zod.z.boolean(),
					"columns": zod.z.strictObject({
						"time": zod.z.string(),
						"symbol": zod.z.string(),
						"open": zod.z.string(),
						"high": zod.z.string(),
						"low": zod.z.string(),
						"close": zod.z.string()
					})
				})]).optional(),
				"rangeRules": zod.z.union([zod.z.undefined(), zod.z.strictObject({
					"lookbackBars": zod.z.number(),
					"tickSize": zod.z.number(),
					"minWidthTicks": zod.z.number(),
					"minTouches": zod.z.number(),
					"edgeFraction": zod.z.number(),
					"reboundTicks": zod.z.number(),
					"roundTripCostTicks": zod.z.number(),
					"minRewardCostRatio": zod.z.number(),
					"stopLossTicks": zod.z.number(),
					"takeProfitTicks": zod.z.number()
				})]).optional()
			}),
			"confirmed": zod.z.boolean(),
			"executionConsent": zod.z.string().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0_strict$schema$value ??= zod.z.strictObject({ "credentials": zod.z.strictObject({
			"phone": zod.z.string().readonly(),
			"password": zod.z.string().readonly()
		}).optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"planId": zod.z.string(),
			"sessionId": zod.z.string()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0_strict$schema$value ??= zod.z.strictObject({ "enabled": zod.z.boolean() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"action": zod.z.union([
				zod.z.strictObject({
					"kind": zod.z.literal("create-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly()
				}),
				zod.z.strictObject({
					"kind": zod.z.literal("update-pool").readonly(),
					"name": zod.z.string().readonly(),
					"style": zod.z.string().readonly(),
					"cycle": zod.z.number().readonly().optional()
				}),
				zod.z.strictObject({
					"kind": zod.z.literal("add-factor").readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.strictObject({
					"kind": zod.z.literal("replace-factor").readonly(),
					"factorId": zod.z.string().readonly(),
					"workflowId": zod.z.string().readonly()
				}),
				zod.z.strictObject({
					"kind": zod.z.literal("remove-factor").readonly(),
					"factorId": zod.z.string().readonly()
				}),
				zod.z.strictObject({ "kind": zod.z.literal("submit-pool").readonly() }),
				zod.z.strictObject({
					"kind": zod.z.literal("budget").readonly(),
					"batch": zod.z.strictObject({
						"hypothesis": zod.z.string().readonly(),
						"maxRuns": zod.z.number().readonly(),
						"creditThreshold": zod.z.number().readonly(),
						"startDate": zod.z.string().readonly(),
						"endDate": zod.z.string().readonly(),
						"cycle": zod.z.number().readonly()
					}).readonly()
				})
			]),
			"sessionId": zod.z.string().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"kind": zod.z.union([
				zod.z.literal("pool"),
				zod.z.literal("workflows"),
				zod.z.literal("scores"),
				zod.z.literal("factor-info"),
				zod.z.literal("factor-result"),
				zod.z.literal("factors")
			]).readonly(),
			"id": zod.z.string().readonly().optional(),
			"page": zod.z.number().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0_strict$schema$value ??= zod.z.strictObject({ "planId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0_strict$schema$value ??= zod.z.strictObject({ "runId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"topic": zod.z.boolean().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0_strict$schema$value ??= zod.z.strictObject({ "budgetId": zod.z.string() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"data": zod.z.string().readonly(),
			"mediaType": zod.z.string().readonly(),
			"name": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"attachmentId": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0_strict$schema$value ??= zod.z.union([zod.z.undefined(), zod.z.strictObject({
			"blenderPath": zod.z.string().optional(),
			"neural": zod.z.boolean().optional()
		})]);
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"path": zod.z.string(),
			"body": zod.z.json().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"limit": zod.z.number().readonly().optional(),
			"includeArchived": zod.z.boolean().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string(),
			"continuePending": zod.z.boolean().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"action": zod.z.union([
				zod.z.literal("auto"),
				zod.z.literal("list"),
				zod.z.literal("verify"),
				zod.z.literal("save"),
				zod.z.literal("remove"),
				zod.z.literal("test")
			]),
			"model": zod.z.string().optional(),
			"draft": zod.z.strictObject({
				"route": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"service": zod.z.string(),
				"name": zod.z.string(),
				"baseURL": zod.z.string(),
				"api": zod.z.string(),
				"apiKey": zod.z.union([zod.z.undefined(), zod.z.string()]).optional(),
				"modelIds": zod.z.array(zod.z.string()),
				"auto": zod.z.boolean(),
				"reasoning": zod.z.union([zod.z.undefined(), zod.z.string()]).optional().describe("Optional route default used by the adapter for every model on this route."),
				"modelsJson": zod.z.union([zod.z.undefined(), zod.z.string()]).optional().describe("Optional advanced model declarations; omitted preserves existing overrides.")
			}).optional(),
			"route": zod.z.string().optional(),
			"enabled": zod.z.boolean().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"purpose": zod.z.union([
				zod.z.literal("ordinary"),
				zod.z.literal("role-helper"),
				zod.z.literal("contest"),
				zod.z.literal("factor-contest")
			]).readonly(),
			"contestConversation": zod.z.union([zod.z.literal("main"), zod.z.literal("topic")]).readonly().optional(),
			"workspaceId": zod.z.string().readonly().optional(),
			"cwd": zod.z.string().readonly().optional(),
			"agentPreset": zod.z.string().readonly().optional()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeArchived": zod.z.boolean().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly(),
			"task": zod.z.string().readonly().optional(),
			"values": zod.z.record(zod.z.string(), zod.z.union([zod.z.string(), zod.z.number()])).readonly().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"versionId": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"assetId": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"paths": zod.z.array(zod.z.string()).readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"path": zod.z.string().readonly()
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0_strict$schema$value ??= zod.z.strictObject({ "sessionId": zod.z.string().readonly() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"action": zod.z.union([
				zod.z.literal("archive"),
				zod.z.literal("restore"),
				zod.z.literal("delete")
			]).readonly(),
			"filesToken": zod.z.string().readonly().optional().describe("Issued by deletionPreview; scopes file erasure to the exact reviewed file versions.")
		});
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0_strict$schema$value ??= zod.z.strictObject({ "preferredWorkspaceId": zod.z.string().readonly().optional() });
		let _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0_strict$schema = () => _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0_strict$schema$value ??= zod.z.strictObject({ "preferredWorkspaceId": zod.z.string().readonly().optional() });
		const TYPERT_REMOTE$1 = createTypertRemoteInfo({
			package: "@deepseek-ai/dsh-quantskills-session",
			methods: {
				"quantSkillsSessions/agentCreate": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"purpose": {
										"type": "string",
										"const": "authoring-helper",
										"description": "Explicitly create a hidden application helper; never inferred from its name."
									},
									"copyFrom": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"expectedRevision": { "type": "number" }
										},
										"required": ["agentId", "expectedRevision"],
										"additionalProperties": true,
										"description": "Explicit personal copy of a saved definition, checked before publication."
									},
									"name": { "type": "string" },
									"role": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": ["dynamic", "fixed"]
									},
									"model": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" },
											"reasoningEffort": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": true
									},
									"permission": {
										"type": "string",
										"enum": [
											"read-only",
											"workspace-write",
											"danger-full-access"
										]
									},
									"sourceVersionId": { "type": "string" },
									"versionIds": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"required": [
									"name",
									"role",
									"mode",
									"versionIds"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"purpose": {
										"type": "string",
										"const": "authoring-helper",
										"description": "Explicitly create a hidden application helper; never inferred from its name."
									},
									"copyFrom": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"expectedRevision": { "type": "number" }
										},
										"required": ["agentId", "expectedRevision"],
										"additionalProperties": false,
										"description": "Explicit personal copy of a saved definition, checked before publication."
									},
									"name": { "type": "string" },
									"role": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": ["dynamic", "fixed"]
									},
									"model": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" },
											"reasoningEffort": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": false
									},
									"permission": {
										"type": "string",
										"enum": [
											"read-only",
											"workspace-write",
											"danger-full-access"
										]
									},
									"sourceVersionId": { "type": "string" },
									"versionIds": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"required": [
									"name",
									"role",
									"mode",
									"versionIds"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDefinition",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentCreate_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"agentId": { "type": "string" },
								"revision": { "type": "number" },
								"name": { "type": "string" },
								"role": { "type": "string" },
								"mode": {
									"type": "string",
									"enum": ["dynamic", "fixed"]
								},
								"model": {
									"type": "object",
									"properties": {
										"provider": { "type": "string" },
										"model": { "type": "string" },
										"reasoningEffort": { "type": "string" }
									},
									"required": ["provider", "model"],
									"additionalProperties": true
								},
								"permission": {
									"type": "string",
									"enum": [
										"read-only",
										"workspace-write",
										"danger-full-access"
									]
								},
								"sourceVersionId": { "type": "string" },
								"skills": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"assetId": { "type": "string" },
											"versionId": { "type": "string" },
											"commit": { "type": "string" },
											"treeDigest": { "type": "string" }
										},
										"required": [
											"assetId",
											"versionId",
											"commit",
											"treeDigest"
										],
										"additionalProperties": true
									}
								},
								"createdAt": { "type": "number" },
								"updatedAt": { "type": "number" }
							},
							"required": [
								"agentId",
								"revision",
								"name",
								"role",
								"mode",
								"permission",
								"skills",
								"createdAt",
								"updatedAt"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1870,
						"column": 9
					}
				},
				"quantSkillsSessions/agentDelete": {
					service: "quantSkillsSessions",
					description: "Delete one durable user Agent through optimistic revision matching. Existing Agent Sessions remain reconstructable from their logs.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "identity and expected revision.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDeleteRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" }
								},
								"required": ["agentId", "expectedRevision"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDeleteRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" }
								},
								"required": ["agentId", "expectedRevision"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentDelete:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentDelete_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1972,
						"column": 9
					}
				},
				"quantSkillsSessions/agentLibrarySources": {
					service: "quantSkillsSessions",
					description: "Explicit provenance only; absent legacy rows remain unknown in the UI.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentLibrarySources:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentLibrarySources_result$schema,
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"kind": {
										"type": "string",
										"enum": ["agent", "agent-team"]
									},
									"source": {
										"type": "string",
										"enum": [
											"personal",
											"installed",
											"internal"
										]
									},
									"method": {
										"type": "string",
										"enum": [
											"manual",
											"internal",
											"ai",
											"installation",
											"recovered"
										]
									}
								},
								"required": [
									"id",
									"kind",
									"source",
									"method"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1858,
						"column": 9
					}
				},
				"quantSkillsSessions/agentList": {
					service: "quantSkillsSessions",
					description: "Read durable user Agent definitions ordered by most recent update.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentList:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentList_result$schema,
						description: "immutable validated definitions.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"revision": { "type": "number" },
									"name": { "type": "string" },
									"role": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": ["dynamic", "fixed"]
									},
									"model": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" },
											"reasoningEffort": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": true
									},
									"permission": {
										"type": "string",
										"enum": [
											"read-only",
											"workspace-write",
											"danger-full-access"
										]
									},
									"sourceVersionId": { "type": "string" },
									"skills": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"assetId": { "type": "string" },
												"versionId": { "type": "string" },
												"commit": { "type": "string" },
												"treeDigest": { "type": "string" }
											},
											"required": [
												"assetId",
												"versionId",
												"commit",
												"treeDigest"
											],
											"additionalProperties": true
										}
									},
									"createdAt": { "type": "number" },
									"updatedAt": { "type": "number" }
								},
								"required": [
									"agentId",
									"revision",
									"name",
									"role",
									"mode",
									"permission",
									"skills",
									"createdAt",
									"updatedAt"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1846,
						"column": 3
					}
				},
				"quantSkillsSessions/agentSessionCreate": {
					service: "quantSkillsSessions",
					description: "Atomically create or adopt one Session under an immutable user Agent composition.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "fresh Session id, exact Agent revision, and ordinary create options.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": [
									"sessionId",
									"agentId",
									"expectedRevision"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": [
									"sessionId",
									"agentId",
									"expectedRevision"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionCreate_result$schema,
						description: "the published Session and logged Agent composition.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"agent": {
									"type": "object",
									"properties": {
										"agentId": { "type": "string" },
										"revision": { "type": "number" },
										"name": { "type": "string" },
										"role": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": ["dynamic", "fixed"]
										},
										"model": {
											"type": "object",
											"properties": {
												"provider": { "type": "string" },
												"model": { "type": "string" },
												"reasoningEffort": { "type": "string" }
											},
											"required": ["provider", "model"],
											"additionalProperties": true
										},
										"permission": {
											"type": "string",
											"enum": [
												"read-only",
												"workspace-write",
												"danger-full-access"
											]
										},
										"sourceVersionId": { "type": "string" },
										"skills": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {
													"assetId": { "type": "string" },
													"versionId": { "type": "string" },
													"commit": { "type": "string" },
													"treeDigest": { "type": "string" }
												},
												"required": [
													"assetId",
													"versionId",
													"commit",
													"treeDigest"
												],
												"additionalProperties": true
											}
										},
										"createdAt": { "type": "number" },
										"updatedAt": { "type": "number" }
									},
									"required": [
										"agentId",
										"revision",
										"name",
										"role",
										"mode",
										"permission",
										"skills",
										"createdAt",
										"updatedAt"
									],
									"additionalProperties": true
								},
								"agentPreset": { "type": "string" }
							},
							"required": ["sessionId", "agent"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2011,
						"column": 9
					}
				},
				"quantSkillsSessions/agentSessionList": {
					service: "quantSkillsSessions",
					description: "List real user Agent conversation archives from live and persisted Session truth.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "archive visibility filter.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentSessionList:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentSessionList_result$schema,
						description: "Agent-bound Sessions ordered by most recent activity.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"agent": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"revision": { "type": "number" },
											"name": { "type": "string" },
											"role": { "type": "string" },
											"mode": {
												"type": "string",
												"enum": ["dynamic", "fixed"]
											},
											"model": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": true
											},
											"permission": {
												"type": "string",
												"enum": [
													"read-only",
													"workspace-write",
													"danger-full-access"
												]
											},
											"sourceVersionId": { "type": "string" },
											"skills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"assetId": { "type": "string" },
														"versionId": { "type": "string" },
														"commit": { "type": "string" },
														"treeDigest": { "type": "string" }
													},
													"required": [
														"assetId",
														"versionId",
														"commit",
														"treeDigest"
													],
													"additionalProperties": true
												}
											},
											"createdAt": { "type": "number" },
											"updatedAt": { "type": "number" }
										},
										"required": [
											"agentId",
											"revision",
											"name",
											"role",
											"mode",
											"permission",
											"skills",
											"createdAt",
											"updatedAt"
										],
										"additionalProperties": true
									},
									"createdAt": { "type": "number" },
									"updatedAt": { "type": "number" },
									"title": { "type": "string" },
									"cwd": { "type": "string" },
									"parentSessionId": { "type": "string" },
									"archived": { "type": "boolean" },
									"running": { "type": "boolean" },
									"runState": {
										"type": "string",
										"enum": [
											"idle",
											"failed",
											"completed",
											"cancelled",
											"running"
										]
									}
								},
								"required": [
									"sessionId",
									"agent",
									"createdAt",
									"updatedAt",
									"archived",
									"running",
									"runState"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2259,
						"column": 9
					}
				},
				"quantSkillsSessions/agentTeamCreate": {
					service: "quantSkillsSessions",
					description: "Resolve Agent references and create one immutable saved Agent Team.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Team name, goal, Lead revision, and member revisions.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"description": { "type": "string" },
									"leadAgentId": { "type": "string" },
									"leadAgentRevision": { "type": "number" },
									"leadModel": { "oneOf": [{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "default"
										} },
										"required": ["kind"],
										"additionalProperties": true
									}, {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "fixed"
											},
											"selection": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": true
											}
										},
										"required": ["kind", "selection"],
										"additionalProperties": true
									}] },
									"members": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"name": { "type": "string" },
												"agentId": { "type": "string" },
												"agentRevision": { "type": "number" },
												"context": {
													"type": "string",
													"enum": ["fresh", "fork"]
												},
												"model": { "oneOf": [{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "default"
													} },
													"required": ["kind"],
													"additionalProperties": true
												}, {
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "fixed"
														},
														"selection": {
															"type": "object",
															"properties": {
																"provider": { "type": "string" },
																"model": { "type": "string" },
																"reasoningEffort": { "type": "string" }
															},
															"required": ["provider", "model"],
															"additionalProperties": true
														}
													},
													"required": ["kind", "selection"],
													"additionalProperties": true
												}] }
											},
											"required": [
												"name",
												"agentId",
												"agentRevision",
												"context",
												"model"
											],
											"additionalProperties": true
										}
									}
								},
								"required": [
									"name",
									"description",
									"leadAgentId",
									"leadAgentRevision",
									"leadModel",
									"members"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"description": { "type": "string" },
									"leadAgentId": { "type": "string" },
									"leadAgentRevision": { "type": "number" },
									"leadModel": { "oneOf": [{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "default"
										} },
										"required": ["kind"],
										"additionalProperties": false
									}, {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "fixed"
											},
											"selection": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": false
											}
										},
										"required": ["kind", "selection"],
										"additionalProperties": false
									}] },
									"members": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"name": { "type": "string" },
												"agentId": { "type": "string" },
												"agentRevision": { "type": "number" },
												"context": {
													"type": "string",
													"enum": ["fresh", "fork"]
												},
												"model": { "oneOf": [{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "default"
													} },
													"required": ["kind"],
													"additionalProperties": false
												}, {
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "fixed"
														},
														"selection": {
															"type": "object",
															"properties": {
																"provider": { "type": "string" },
																"model": { "type": "string" },
																"reasoningEffort": { "type": "string" }
															},
															"required": ["provider", "model"],
															"additionalProperties": false
														}
													},
													"required": ["kind", "selection"],
													"additionalProperties": false
												}] }
											},
											"required": [
												"name",
												"agentId",
												"agentRevision",
												"context",
												"model"
											],
											"additionalProperties": false
										}
									}
								},
								"required": [
									"name",
									"description",
									"leadAgentId",
									"leadAgentRevision",
									"leadModel",
									"members"
								],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDefinition",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamCreate_result$schema,
						description: "the saved exact Team definition.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"teamId": { "type": "string" },
								"revision": { "type": "number" },
								"name": { "type": "string" },
								"description": { "type": "string" },
								"lead": {
									"type": "object",
									"properties": {
										"agentId": { "type": "string" },
										"revision": { "type": "number" },
										"name": { "type": "string" },
										"role": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": ["dynamic", "fixed"]
										},
										"model": {
											"type": "object",
											"properties": {
												"provider": { "type": "string" },
												"model": { "type": "string" },
												"reasoningEffort": { "type": "string" }
											},
											"required": ["provider", "model"],
											"additionalProperties": true
										},
										"permission": {
											"type": "string",
											"enum": [
												"read-only",
												"workspace-write",
												"danger-full-access"
											]
										},
										"sourceVersionId": { "type": "string" },
										"skills": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {
													"assetId": { "type": "string" },
													"versionId": { "type": "string" },
													"commit": { "type": "string" },
													"treeDigest": { "type": "string" }
												},
												"required": [
													"assetId",
													"versionId",
													"commit",
													"treeDigest"
												],
												"additionalProperties": true
											}
										},
										"createdAt": { "type": "number" },
										"updatedAt": { "type": "number" }
									},
									"required": [
										"agentId",
										"revision",
										"name",
										"role",
										"mode",
										"permission",
										"skills",
										"createdAt",
										"updatedAt"
									],
									"additionalProperties": true
								},
								"leadModel": { "oneOf": [{
									"type": "object",
									"properties": { "kind": {
										"type": "string",
										"const": "default"
									} },
									"required": ["kind"],
									"additionalProperties": true
								}, {
									"type": "object",
									"properties": {
										"kind": {
											"type": "string",
											"const": "fixed"
										},
										"selection": {
											"type": "object",
											"properties": {
												"provider": { "type": "string" },
												"model": { "type": "string" },
												"reasoningEffort": { "type": "string" }
											},
											"required": ["provider", "model"],
											"additionalProperties": true
										}
									},
									"required": ["kind", "selection"],
									"additionalProperties": true
								}] },
								"members": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": { "type": "string" },
											"context": {
												"type": "string",
												"enum": ["fresh", "fork"]
											},
											"agent": {
												"type": "object",
												"properties": {
													"agentId": { "type": "string" },
													"revision": { "type": "number" },
													"name": { "type": "string" },
													"role": { "type": "string" },
													"mode": {
														"type": "string",
														"enum": ["dynamic", "fixed"]
													},
													"model": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													},
													"permission": {
														"type": "string",
														"enum": [
															"read-only",
															"workspace-write",
															"danger-full-access"
														]
													},
													"sourceVersionId": { "type": "string" },
													"skills": {
														"type": "array",
														"items": {
															"type": "object",
															"properties": {
																"assetId": { "type": "string" },
																"versionId": { "type": "string" },
																"commit": { "type": "string" },
																"treeDigest": { "type": "string" }
															},
															"required": [
																"assetId",
																"versionId",
																"commit",
																"treeDigest"
															],
															"additionalProperties": true
														}
													},
													"createdAt": { "type": "number" },
													"updatedAt": { "type": "number" }
												},
												"required": [
													"agentId",
													"revision",
													"name",
													"role",
													"mode",
													"permission",
													"skills",
													"createdAt",
													"updatedAt"
												],
												"additionalProperties": true
											},
											"model": { "oneOf": [{
												"type": "object",
												"properties": { "kind": {
													"type": "string",
													"const": "default"
												} },
												"required": ["kind"],
												"additionalProperties": true
											}, {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"const": "fixed"
													},
													"selection": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													}
												},
												"required": ["kind", "selection"],
												"additionalProperties": true
											}] }
										},
										"required": [
											"name",
											"context",
											"agent",
											"model"
										],
										"additionalProperties": true
									}
								},
								"createdAt": { "type": "number" },
								"updatedAt": { "type": "number" }
							},
							"required": [
								"teamId",
								"revision",
								"name",
								"description",
								"lead",
								"leadModel",
								"members",
								"createdAt",
								"updatedAt"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2281,
						"column": 9
					}
				},
				"quantSkillsSessions/agentTeamDelete": {
					service: "quantSkillsSessions",
					description: "Delete one saved Agent Team while preserving every existing Team Session log.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Team identity and observed revision.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDeleteRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"teamId": { "type": "string" },
									"expectedRevision": { "type": "number" }
								},
								"required": ["teamId", "expectedRevision"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDeleteRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"teamId": { "type": "string" },
									"expectedRevision": { "type": "number" }
								},
								"required": ["teamId", "expectedRevision"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamDelete:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamDelete_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2333,
						"column": 9
					}
				},
				"quantSkillsSessions/agentTeamList": {
					service: "quantSkillsSessions",
					description: "Read saved Agent Team definitions ordered by most recent update.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamList:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamList_result$schema,
						description: "immutable Agent Team definitions.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"teamId": { "type": "string" },
									"revision": { "type": "number" },
									"name": { "type": "string" },
									"description": { "type": "string" },
									"lead": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"revision": { "type": "number" },
											"name": { "type": "string" },
											"role": { "type": "string" },
											"mode": {
												"type": "string",
												"enum": ["dynamic", "fixed"]
											},
											"model": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": true
											},
											"permission": {
												"type": "string",
												"enum": [
													"read-only",
													"workspace-write",
													"danger-full-access"
												]
											},
											"sourceVersionId": { "type": "string" },
											"skills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"assetId": { "type": "string" },
														"versionId": { "type": "string" },
														"commit": { "type": "string" },
														"treeDigest": { "type": "string" }
													},
													"required": [
														"assetId",
														"versionId",
														"commit",
														"treeDigest"
													],
													"additionalProperties": true
												}
											},
											"createdAt": { "type": "number" },
											"updatedAt": { "type": "number" }
										},
										"required": [
											"agentId",
											"revision",
											"name",
											"role",
											"mode",
											"permission",
											"skills",
											"createdAt",
											"updatedAt"
										],
										"additionalProperties": true
									},
									"leadModel": { "oneOf": [{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "default"
										} },
										"required": ["kind"],
										"additionalProperties": true
									}, {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "fixed"
											},
											"selection": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": true
											}
										},
										"required": ["kind", "selection"],
										"additionalProperties": true
									}] },
									"members": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"name": { "type": "string" },
												"context": {
													"type": "string",
													"enum": ["fresh", "fork"]
												},
												"agent": {
													"type": "object",
													"properties": {
														"agentId": { "type": "string" },
														"revision": { "type": "number" },
														"name": { "type": "string" },
														"role": { "type": "string" },
														"mode": {
															"type": "string",
															"enum": ["dynamic", "fixed"]
														},
														"model": {
															"type": "object",
															"properties": {
																"provider": { "type": "string" },
																"model": { "type": "string" },
																"reasoningEffort": { "type": "string" }
															},
															"required": ["provider", "model"],
															"additionalProperties": true
														},
														"permission": {
															"type": "string",
															"enum": [
																"read-only",
																"workspace-write",
																"danger-full-access"
															]
														},
														"sourceVersionId": { "type": "string" },
														"skills": {
															"type": "array",
															"items": {
																"type": "object",
																"properties": {
																	"assetId": { "type": "string" },
																	"versionId": { "type": "string" },
																	"commit": { "type": "string" },
																	"treeDigest": { "type": "string" }
																},
																"required": [
																	"assetId",
																	"versionId",
																	"commit",
																	"treeDigest"
																],
																"additionalProperties": true
															}
														},
														"createdAt": { "type": "number" },
														"updatedAt": { "type": "number" }
													},
													"required": [
														"agentId",
														"revision",
														"name",
														"role",
														"mode",
														"permission",
														"skills",
														"createdAt",
														"updatedAt"
													],
													"additionalProperties": true
												},
												"model": { "oneOf": [{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "default"
													} },
													"required": ["kind"],
													"additionalProperties": true
												}, {
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "fixed"
														},
														"selection": {
															"type": "object",
															"properties": {
																"provider": { "type": "string" },
																"model": { "type": "string" },
																"reasoningEffort": { "type": "string" }
															},
															"required": ["provider", "model"],
															"additionalProperties": true
														}
													},
													"required": ["kind", "selection"],
													"additionalProperties": true
												}] }
											},
											"required": [
												"name",
												"context",
												"agent",
												"model"
											],
											"additionalProperties": true
										}
									},
									"createdAt": { "type": "number" },
									"updatedAt": { "type": "number" }
								},
								"required": [
									"teamId",
									"revision",
									"name",
									"description",
									"lead",
									"leadModel",
									"members",
									"createdAt",
									"updatedAt"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2271,
						"column": 3
					}
				},
				"quantSkillsSessions/agentTeamSessionCreate": {
					service: "quantSkillsSessions",
					description: "Atomically create or adopt one Team Lead Session under an exact Team revision.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session identity, exact Team revision, and optional Workspace selection.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"teamId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": [
									"sessionId",
									"teamId",
									"expectedRevision"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"teamId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": [
									"sessionId",
									"teamId",
									"expectedRevision"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamSessionCreateResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionCreate_result$schema,
						description: "the published Lead Session and its immutable Team binding.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"team": {
									"type": "object",
									"properties": {
										"teamId": { "type": "string" },
										"revision": { "type": "number" },
										"name": { "type": "string" },
										"description": { "type": "string" },
										"lead": {
											"type": "object",
											"properties": {
												"agentId": { "type": "string" },
												"revision": { "type": "number" },
												"name": { "type": "string" },
												"role": { "type": "string" },
												"mode": {
													"type": "string",
													"enum": ["dynamic", "fixed"]
												},
												"model": {
													"type": "object",
													"properties": {
														"provider": { "type": "string" },
														"model": { "type": "string" },
														"reasoningEffort": { "type": "string" }
													},
													"required": ["provider", "model"],
													"additionalProperties": true
												},
												"permission": {
													"type": "string",
													"enum": [
														"read-only",
														"workspace-write",
														"danger-full-access"
													]
												},
												"sourceVersionId": { "type": "string" },
												"skills": {
													"type": "array",
													"items": {
														"type": "object",
														"properties": {
															"assetId": { "type": "string" },
															"versionId": { "type": "string" },
															"commit": { "type": "string" },
															"treeDigest": { "type": "string" }
														},
														"required": [
															"assetId",
															"versionId",
															"commit",
															"treeDigest"
														],
														"additionalProperties": true
													}
												},
												"createdAt": { "type": "number" },
												"updatedAt": { "type": "number" }
											},
											"required": [
												"agentId",
												"revision",
												"name",
												"role",
												"mode",
												"permission",
												"skills",
												"createdAt",
												"updatedAt"
											],
											"additionalProperties": true
										},
										"leadModel": { "oneOf": [{
											"type": "object",
											"properties": { "kind": {
												"type": "string",
												"const": "default"
											} },
											"required": ["kind"],
											"additionalProperties": true
										}, {
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "fixed"
												},
												"selection": {
													"type": "object",
													"properties": {
														"provider": { "type": "string" },
														"model": { "type": "string" },
														"reasoningEffort": { "type": "string" }
													},
													"required": ["provider", "model"],
													"additionalProperties": true
												}
											},
											"required": ["kind", "selection"],
											"additionalProperties": true
										}] },
										"members": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {
													"name": { "type": "string" },
													"context": {
														"type": "string",
														"enum": ["fresh", "fork"]
													},
													"agent": {
														"type": "object",
														"properties": {
															"agentId": { "type": "string" },
															"revision": { "type": "number" },
															"name": { "type": "string" },
															"role": { "type": "string" },
															"mode": {
																"type": "string",
																"enum": ["dynamic", "fixed"]
															},
															"model": {
																"type": "object",
																"properties": {
																	"provider": { "type": "string" },
																	"model": { "type": "string" },
																	"reasoningEffort": { "type": "string" }
																},
																"required": ["provider", "model"],
																"additionalProperties": true
															},
															"permission": {
																"type": "string",
																"enum": [
																	"read-only",
																	"workspace-write",
																	"danger-full-access"
																]
															},
															"sourceVersionId": { "type": "string" },
															"skills": {
																"type": "array",
																"items": {
																	"type": "object",
																	"properties": {
																		"assetId": { "type": "string" },
																		"versionId": { "type": "string" },
																		"commit": { "type": "string" },
																		"treeDigest": { "type": "string" }
																	},
																	"required": [
																		"assetId",
																		"versionId",
																		"commit",
																		"treeDigest"
																	],
																	"additionalProperties": true
																}
															},
															"createdAt": { "type": "number" },
															"updatedAt": { "type": "number" }
														},
														"required": [
															"agentId",
															"revision",
															"name",
															"role",
															"mode",
															"permission",
															"skills",
															"createdAt",
															"updatedAt"
														],
														"additionalProperties": true
													},
													"model": { "oneOf": [{
														"type": "object",
														"properties": { "kind": {
															"type": "string",
															"const": "default"
														} },
														"required": ["kind"],
														"additionalProperties": true
													}, {
														"type": "object",
														"properties": {
															"kind": {
																"type": "string",
																"const": "fixed"
															},
															"selection": {
																"type": "object",
																"properties": {
																	"provider": { "type": "string" },
																	"model": { "type": "string" },
																	"reasoningEffort": { "type": "string" }
																},
																"required": ["provider", "model"],
																"additionalProperties": true
															}
														},
														"required": ["kind", "selection"],
														"additionalProperties": true
													}] }
												},
												"required": [
													"name",
													"context",
													"agent",
													"model"
												],
												"additionalProperties": true
											}
										},
										"createdAt": { "type": "number" },
										"updatedAt": { "type": "number" }
									},
									"required": [
										"teamId",
										"revision",
										"name",
										"description",
										"lead",
										"leadModel",
										"members",
										"createdAt",
										"updatedAt"
									],
									"additionalProperties": true
								},
								"agentPreset": { "type": "string" }
							},
							"required": ["sessionId", "team"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2351,
						"column": 9
					}
				},
				"quantSkillsSessions/agentTeamSessionList": {
					service: "quantSkillsSessions",
					description: "List real Agent Team Lead conversation archives from live and persisted Session truth.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "archive visibility filter.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentTeamSessionList:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamSessionList_result$schema,
						description: "Team Lead Sessions ordered by most recent activity.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"team": {
										"type": "object",
										"properties": {
											"teamId": { "type": "string" },
											"revision": { "type": "number" },
											"name": { "type": "string" },
											"description": { "type": "string" },
											"lead": {
												"type": "object",
												"properties": {
													"agentId": { "type": "string" },
													"revision": { "type": "number" },
													"name": { "type": "string" },
													"role": { "type": "string" },
													"mode": {
														"type": "string",
														"enum": ["dynamic", "fixed"]
													},
													"model": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													},
													"permission": {
														"type": "string",
														"enum": [
															"read-only",
															"workspace-write",
															"danger-full-access"
														]
													},
													"sourceVersionId": { "type": "string" },
													"skills": {
														"type": "array",
														"items": {
															"type": "object",
															"properties": {
																"assetId": { "type": "string" },
																"versionId": { "type": "string" },
																"commit": { "type": "string" },
																"treeDigest": { "type": "string" }
															},
															"required": [
																"assetId",
																"versionId",
																"commit",
																"treeDigest"
															],
															"additionalProperties": true
														}
													},
													"createdAt": { "type": "number" },
													"updatedAt": { "type": "number" }
												},
												"required": [
													"agentId",
													"revision",
													"name",
													"role",
													"mode",
													"permission",
													"skills",
													"createdAt",
													"updatedAt"
												],
												"additionalProperties": true
											},
											"leadModel": { "oneOf": [{
												"type": "object",
												"properties": { "kind": {
													"type": "string",
													"const": "default"
												} },
												"required": ["kind"],
												"additionalProperties": true
											}, {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"const": "fixed"
													},
													"selection": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													}
												},
												"required": ["kind", "selection"],
												"additionalProperties": true
											}] },
											"members": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"name": { "type": "string" },
														"context": {
															"type": "string",
															"enum": ["fresh", "fork"]
														},
														"agent": {
															"type": "object",
															"properties": {
																"agentId": { "type": "string" },
																"revision": { "type": "number" },
																"name": { "type": "string" },
																"role": { "type": "string" },
																"mode": {
																	"type": "string",
																	"enum": ["dynamic", "fixed"]
																},
																"model": {
																	"type": "object",
																	"properties": {
																		"provider": { "type": "string" },
																		"model": { "type": "string" },
																		"reasoningEffort": { "type": "string" }
																	},
																	"required": ["provider", "model"],
																	"additionalProperties": true
																},
																"permission": {
																	"type": "string",
																	"enum": [
																		"read-only",
																		"workspace-write",
																		"danger-full-access"
																	]
																},
																"sourceVersionId": { "type": "string" },
																"skills": {
																	"type": "array",
																	"items": {
																		"type": "object",
																		"properties": {
																			"assetId": { "type": "string" },
																			"versionId": { "type": "string" },
																			"commit": { "type": "string" },
																			"treeDigest": { "type": "string" }
																		},
																		"required": [
																			"assetId",
																			"versionId",
																			"commit",
																			"treeDigest"
																		],
																		"additionalProperties": true
																	}
																},
																"createdAt": { "type": "number" },
																"updatedAt": { "type": "number" }
															},
															"required": [
																"agentId",
																"revision",
																"name",
																"role",
																"mode",
																"permission",
																"skills",
																"createdAt",
																"updatedAt"
															],
															"additionalProperties": true
														},
														"model": { "oneOf": [{
															"type": "object",
															"properties": { "kind": {
																"type": "string",
																"const": "default"
															} },
															"required": ["kind"],
															"additionalProperties": true
														}, {
															"type": "object",
															"properties": {
																"kind": {
																	"type": "string",
																	"const": "fixed"
																},
																"selection": {
																	"type": "object",
																	"properties": {
																		"provider": { "type": "string" },
																		"model": { "type": "string" },
																		"reasoningEffort": { "type": "string" }
																	},
																	"required": ["provider", "model"],
																	"additionalProperties": true
																}
															},
															"required": ["kind", "selection"],
															"additionalProperties": true
														}] }
													},
													"required": [
														"name",
														"context",
														"agent",
														"model"
													],
													"additionalProperties": true
												}
											},
											"createdAt": { "type": "number" },
											"updatedAt": { "type": "number" }
										},
										"required": [
											"teamId",
											"revision",
											"name",
											"description",
											"lead",
											"leadModel",
											"members",
											"createdAt",
											"updatedAt"
										],
										"additionalProperties": true
									},
									"createdAt": { "type": "number" },
									"updatedAt": { "type": "number" },
									"title": { "type": "string" },
									"cwd": { "type": "string" },
									"parentSessionId": { "type": "string" },
									"archived": { "type": "boolean" },
									"running": { "type": "boolean" },
									"runState": {
										"type": "string",
										"enum": [
											"idle",
											"failed",
											"completed",
											"cancelled",
											"running"
										]
									}
								},
								"required": [
									"sessionId",
									"team",
									"createdAt",
									"updatedAt",
									"archived",
									"running",
									"runState"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2430,
						"column": 9
					}
				},
				"quantSkillsSessions/agentTeamUpdate": {
					service: "quantSkillsSessions",
					description: "Replace one saved Agent Team through optimistic revision matching.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "replacement composition and observed Team revision.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamUpdateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"teamId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"name": { "type": "string" },
									"description": { "type": "string" },
									"leadAgentId": { "type": "string" },
									"leadAgentRevision": { "type": "number" },
									"leadModel": { "oneOf": [{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "default"
										} },
										"required": ["kind"],
										"additionalProperties": true
									}, {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "fixed"
											},
											"selection": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": true
											}
										},
										"required": ["kind", "selection"],
										"additionalProperties": true
									}] },
									"members": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"name": { "type": "string" },
												"agentId": { "type": "string" },
												"agentRevision": { "type": "number" },
												"context": {
													"type": "string",
													"enum": ["fresh", "fork"]
												},
												"model": { "oneOf": [{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "default"
													} },
													"required": ["kind"],
													"additionalProperties": true
												}, {
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "fixed"
														},
														"selection": {
															"type": "object",
															"properties": {
																"provider": { "type": "string" },
																"model": { "type": "string" },
																"reasoningEffort": { "type": "string" }
															},
															"required": ["provider", "model"],
															"additionalProperties": true
														}
													},
													"required": ["kind", "selection"],
													"additionalProperties": true
												}] }
											},
											"required": [
												"name",
												"agentId",
												"agentRevision",
												"context",
												"model"
											],
											"additionalProperties": true
										}
									}
								},
								"required": [
									"teamId",
									"expectedRevision",
									"name",
									"description",
									"leadAgentId",
									"leadAgentRevision",
									"leadModel",
									"members"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamUpdateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"teamId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"name": { "type": "string" },
									"description": { "type": "string" },
									"leadAgentId": { "type": "string" },
									"leadAgentRevision": { "type": "number" },
									"leadModel": { "oneOf": [{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "default"
										} },
										"required": ["kind"],
										"additionalProperties": false
									}, {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "fixed"
											},
											"selection": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": false
											}
										},
										"required": ["kind", "selection"],
										"additionalProperties": false
									}] },
									"members": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"name": { "type": "string" },
												"agentId": { "type": "string" },
												"agentRevision": { "type": "number" },
												"context": {
													"type": "string",
													"enum": ["fresh", "fork"]
												},
												"model": { "oneOf": [{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "default"
													} },
													"required": ["kind"],
													"additionalProperties": false
												}, {
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "fixed"
														},
														"selection": {
															"type": "object",
															"properties": {
																"provider": { "type": "string" },
																"model": { "type": "string" },
																"reasoningEffort": { "type": "string" }
															},
															"required": ["provider", "model"],
															"additionalProperties": false
														}
													},
													"required": ["kind", "selection"],
													"additionalProperties": false
												}] }
											},
											"required": [
												"name",
												"agentId",
												"agentRevision",
												"context",
												"model"
											],
											"additionalProperties": false
										}
									}
								},
								"required": [
									"teamId",
									"expectedRevision",
									"name",
									"description",
									"leadAgentId",
									"leadAgentRevision",
									"leadModel",
									"members"
								],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentTeamDefinition",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentTeamUpdate_result$schema,
						description: "the updated exact Team definition.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"teamId": { "type": "string" },
								"revision": { "type": "number" },
								"name": { "type": "string" },
								"description": { "type": "string" },
								"lead": {
									"type": "object",
									"properties": {
										"agentId": { "type": "string" },
										"revision": { "type": "number" },
										"name": { "type": "string" },
										"role": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": ["dynamic", "fixed"]
										},
										"model": {
											"type": "object",
											"properties": {
												"provider": { "type": "string" },
												"model": { "type": "string" },
												"reasoningEffort": { "type": "string" }
											},
											"required": ["provider", "model"],
											"additionalProperties": true
										},
										"permission": {
											"type": "string",
											"enum": [
												"read-only",
												"workspace-write",
												"danger-full-access"
											]
										},
										"sourceVersionId": { "type": "string" },
										"skills": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {
													"assetId": { "type": "string" },
													"versionId": { "type": "string" },
													"commit": { "type": "string" },
													"treeDigest": { "type": "string" }
												},
												"required": [
													"assetId",
													"versionId",
													"commit",
													"treeDigest"
												],
												"additionalProperties": true
											}
										},
										"createdAt": { "type": "number" },
										"updatedAt": { "type": "number" }
									},
									"required": [
										"agentId",
										"revision",
										"name",
										"role",
										"mode",
										"permission",
										"skills",
										"createdAt",
										"updatedAt"
									],
									"additionalProperties": true
								},
								"leadModel": { "oneOf": [{
									"type": "object",
									"properties": { "kind": {
										"type": "string",
										"const": "default"
									} },
									"required": ["kind"],
									"additionalProperties": true
								}, {
									"type": "object",
									"properties": {
										"kind": {
											"type": "string",
											"const": "fixed"
										},
										"selection": {
											"type": "object",
											"properties": {
												"provider": { "type": "string" },
												"model": { "type": "string" },
												"reasoningEffort": { "type": "string" }
											},
											"required": ["provider", "model"],
											"additionalProperties": true
										}
									},
									"required": ["kind", "selection"],
									"additionalProperties": true
								}] },
								"members": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": { "type": "string" },
											"context": {
												"type": "string",
												"enum": ["fresh", "fork"]
											},
											"agent": {
												"type": "object",
												"properties": {
													"agentId": { "type": "string" },
													"revision": { "type": "number" },
													"name": { "type": "string" },
													"role": { "type": "string" },
													"mode": {
														"type": "string",
														"enum": ["dynamic", "fixed"]
													},
													"model": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													},
													"permission": {
														"type": "string",
														"enum": [
															"read-only",
															"workspace-write",
															"danger-full-access"
														]
													},
													"sourceVersionId": { "type": "string" },
													"skills": {
														"type": "array",
														"items": {
															"type": "object",
															"properties": {
																"assetId": { "type": "string" },
																"versionId": { "type": "string" },
																"commit": { "type": "string" },
																"treeDigest": { "type": "string" }
															},
															"required": [
																"assetId",
																"versionId",
																"commit",
																"treeDigest"
															],
															"additionalProperties": true
														}
													},
													"createdAt": { "type": "number" },
													"updatedAt": { "type": "number" }
												},
												"required": [
													"agentId",
													"revision",
													"name",
													"role",
													"mode",
													"permission",
													"skills",
													"createdAt",
													"updatedAt"
												],
												"additionalProperties": true
											},
											"model": { "oneOf": [{
												"type": "object",
												"properties": { "kind": {
													"type": "string",
													"const": "default"
												} },
												"required": ["kind"],
												"additionalProperties": true
											}, {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"const": "fixed"
													},
													"selection": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													}
												},
												"required": ["kind", "selection"],
												"additionalProperties": true
											}] }
										},
										"required": [
											"name",
											"context",
											"agent",
											"model"
										],
										"additionalProperties": true
									}
								},
								"createdAt": { "type": "number" },
								"updatedAt": { "type": "number" }
							},
							"required": [
								"teamId",
								"revision",
								"name",
								"description",
								"lead",
								"leadModel",
								"members",
								"createdAt",
								"updatedAt"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2303,
						"column": 9
					}
				},
				"quantSkillsSessions/agentUninstall": {
					service: "quantSkillsSessions",
					description: "Uninstall an imported Agent; frozen Team definitions and session histories remain valid.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDeleteRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" }
								},
								"required": ["agentId", "expectedRevision"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDeleteRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" }
								},
								"required": ["agentId", "expectedRevision"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/agentUninstall:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUninstall_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1988,
						"column": 9
					}
				},
				"quantSkillsSessions/agentUpdate": {
					service: "quantSkillsSessions",
					description: "Replace one durable user Agent through optimistic revision matching.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "identity, expected revision, and complete editable fields.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentUpdateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"purpose": {
										"type": "string",
										"const": "authoring-helper",
										"description": "Explicitly create a hidden application helper; never inferred from its name."
									},
									"copyFrom": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"expectedRevision": { "type": "number" }
										},
										"required": ["agentId", "expectedRevision"],
										"additionalProperties": true,
										"description": "Explicit personal copy of a saved definition, checked before publication."
									},
									"name": { "type": "string" },
									"role": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": ["dynamic", "fixed"]
									},
									"model": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" },
											"reasoningEffort": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": true
									},
									"permission": {
										"type": "string",
										"enum": [
											"read-only",
											"workspace-write",
											"danger-full-access"
										]
									},
									"sourceVersionId": { "type": "string" },
									"versionIds": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"required": [
									"agentId",
									"expectedRevision",
									"name",
									"role",
									"mode",
									"versionIds"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentUpdateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"purpose": {
										"type": "string",
										"const": "authoring-helper",
										"description": "Explicitly create a hidden application helper; never inferred from its name."
									},
									"copyFrom": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"expectedRevision": { "type": "number" }
										},
										"required": ["agentId", "expectedRevision"],
										"additionalProperties": false,
										"description": "Explicit personal copy of a saved definition, checked before publication."
									},
									"name": { "type": "string" },
									"role": { "type": "string" },
									"mode": {
										"type": "string",
										"enum": ["dynamic", "fixed"]
									},
									"model": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" },
											"reasoningEffort": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": false
									},
									"permission": {
										"type": "string",
										"enum": [
											"read-only",
											"workspace-write",
											"danger-full-access"
										]
									},
									"sourceVersionId": { "type": "string" },
									"versionIds": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"required": [
									"agentId",
									"expectedRevision",
									"name",
									"role",
									"mode",
									"versionIds"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentDefinition",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_agentUpdate_result$schema,
						description: "the committed next revision.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"agentId": { "type": "string" },
								"revision": { "type": "number" },
								"name": { "type": "string" },
								"role": { "type": "string" },
								"mode": {
									"type": "string",
									"enum": ["dynamic", "fixed"]
								},
								"model": {
									"type": "object",
									"properties": {
										"provider": { "type": "string" },
										"model": { "type": "string" },
										"reasoningEffort": { "type": "string" }
									},
									"required": ["provider", "model"],
									"additionalProperties": true
								},
								"permission": {
									"type": "string",
									"enum": [
										"read-only",
										"workspace-write",
										"danger-full-access"
									]
								},
								"sourceVersionId": { "type": "string" },
								"skills": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"assetId": { "type": "string" },
											"versionId": { "type": "string" },
											"commit": { "type": "string" },
											"treeDigest": { "type": "string" }
										},
										"required": [
											"assetId",
											"versionId",
											"commit",
											"treeDigest"
										],
										"additionalProperties": true
									}
								},
								"createdAt": { "type": "number" },
								"updatedAt": { "type": "number" }
							},
							"required": [
								"agentId",
								"revision",
								"name",
								"role",
								"mode",
								"permission",
								"skills",
								"createdAt",
								"updatedAt"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1928,
						"column": 9
					}
				},
				"quantSkillsSessions/archivedConversations": {
					service: "quantSkillsSessions",
					description: "List archived conversations of all four product types, without resuming them.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/archivedConversations:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_archivedConversations_result$schema,
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"title": { "type": "string" },
									"kind": {
										"type": "string",
										"enum": [
											"skill",
											"agent",
											"plain",
											"team"
										]
									},
									"updatedAt": { "type": "number" },
									"running": { "type": "boolean" }
								},
								"required": [
									"sessionId",
									"title",
									"kind",
									"updatedAt",
									"running"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1674,
						"column": 9
					}
				},
				"quantSkillsSessions/authoringCommit": {
					service: "quantSkillsSessions",
					description: "Commit one successful logged draft after an explicit Client confirmation.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session-owned Tool call identity and observed content digest.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringCommitRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"toolCallId": { "type": "string" },
									"expectedTreeDigest": { "type": "string" }
								},
								"required": [
									"sessionId",
									"toolCallId",
									"expectedTreeDigest"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringCommitRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"toolCallId": { "type": "string" },
									"expectedTreeDigest": { "type": "string" }
								},
								"required": [
									"sessionId",
									"toolCallId",
									"expectedTreeDigest"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringCommitResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringCommit_result$schema,
						description: "the immutable local asset, Agent, or Team publication.",
						jsonSchema: { "oneOf": [
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "skill"
									},
									"version": {
										"type": "object",
										"properties": {
											"versionId": { "type": "string" },
											"assetId": { "type": "string" },
											"kind": {
												"type": "string",
												"enum": ["skill", "agent"]
											},
											"repository": { "type": "string" },
											"commit": { "type": "string" },
											"declaration": {
												"type": "string",
												"enum": ["SKILL.md", "AGENTS.md"]
											},
											"treeDigest": { "type": "string" },
											"fileCount": { "type": "number" },
											"totalBytes": { "type": "number" },
											"installedAt": { "type": "number" },
											"exposure": {
												"type": "string",
												"enum": ["skill-registry", "agent-template"]
											},
											"origin": {
												"type": "string",
												"enum": ["catalog", "local-authoring"]
											},
											"declarationTitleZh": { "type": "string" }
										},
										"required": [
											"versionId",
											"assetId",
											"kind",
											"repository",
											"commit",
											"declaration",
											"treeDigest",
											"fileCount",
											"totalBytes",
											"installedAt",
											"exposure",
											"origin"
										],
										"additionalProperties": true
									}
								},
								"required": ["kind", "version"],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "agent"
									},
									"version": {
										"type": "object",
										"properties": {
											"versionId": { "type": "string" },
											"assetId": { "type": "string" },
											"kind": {
												"type": "string",
												"enum": ["skill", "agent"]
											},
											"repository": { "type": "string" },
											"commit": { "type": "string" },
											"declaration": {
												"type": "string",
												"enum": ["SKILL.md", "AGENTS.md"]
											},
											"treeDigest": { "type": "string" },
											"fileCount": { "type": "number" },
											"totalBytes": { "type": "number" },
											"installedAt": { "type": "number" },
											"exposure": {
												"type": "string",
												"enum": ["skill-registry", "agent-template"]
											},
											"origin": {
												"type": "string",
												"enum": ["catalog", "local-authoring"]
											},
											"declarationTitleZh": { "type": "string" }
										},
										"required": [
											"versionId",
											"assetId",
											"kind",
											"repository",
											"commit",
											"declaration",
											"treeDigest",
											"fileCount",
											"totalBytes",
											"installedAt",
											"exposure",
											"origin"
										],
										"additionalProperties": true
									},
									"agent": {
										"type": "object",
										"properties": {
											"agentId": { "type": "string" },
											"revision": { "type": "number" },
											"name": { "type": "string" },
											"role": { "type": "string" },
											"mode": {
												"type": "string",
												"enum": ["dynamic", "fixed"]
											},
											"model": {
												"type": "object",
												"properties": {
													"provider": { "type": "string" },
													"model": { "type": "string" },
													"reasoningEffort": { "type": "string" }
												},
												"required": ["provider", "model"],
												"additionalProperties": true
											},
											"permission": {
												"type": "string",
												"enum": [
													"read-only",
													"workspace-write",
													"danger-full-access"
												]
											},
											"sourceVersionId": { "type": "string" },
											"skills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"assetId": { "type": "string" },
														"versionId": { "type": "string" },
														"commit": { "type": "string" },
														"treeDigest": { "type": "string" }
													},
													"required": [
														"assetId",
														"versionId",
														"commit",
														"treeDigest"
													],
													"additionalProperties": true
												}
											},
											"createdAt": { "type": "number" },
											"updatedAt": { "type": "number" }
										},
										"required": [
											"agentId",
											"revision",
											"name",
											"role",
											"mode",
											"permission",
											"skills",
											"createdAt",
											"updatedAt"
										],
										"additionalProperties": true
									}
								},
								"required": [
									"kind",
									"version",
									"agent"
								],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "agent-team"
									},
									"team": {
										"type": "object",
										"properties": {
											"teamId": { "type": "string" },
											"revision": { "type": "number" },
											"name": { "type": "string" },
											"description": { "type": "string" },
											"lead": {
												"type": "object",
												"properties": {
													"agentId": { "type": "string" },
													"revision": { "type": "number" },
													"name": { "type": "string" },
													"role": { "type": "string" },
													"mode": {
														"type": "string",
														"enum": ["dynamic", "fixed"]
													},
													"model": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													},
													"permission": {
														"type": "string",
														"enum": [
															"read-only",
															"workspace-write",
															"danger-full-access"
														]
													},
													"sourceVersionId": { "type": "string" },
													"skills": {
														"type": "array",
														"items": {
															"type": "object",
															"properties": {
																"assetId": { "type": "string" },
																"versionId": { "type": "string" },
																"commit": { "type": "string" },
																"treeDigest": { "type": "string" }
															},
															"required": [
																"assetId",
																"versionId",
																"commit",
																"treeDigest"
															],
															"additionalProperties": true
														}
													},
													"createdAt": { "type": "number" },
													"updatedAt": { "type": "number" }
												},
												"required": [
													"agentId",
													"revision",
													"name",
													"role",
													"mode",
													"permission",
													"skills",
													"createdAt",
													"updatedAt"
												],
												"additionalProperties": true
											},
											"leadModel": { "oneOf": [{
												"type": "object",
												"properties": { "kind": {
													"type": "string",
													"const": "default"
												} },
												"required": ["kind"],
												"additionalProperties": true
											}, {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"const": "fixed"
													},
													"selection": {
														"type": "object",
														"properties": {
															"provider": { "type": "string" },
															"model": { "type": "string" },
															"reasoningEffort": { "type": "string" }
														},
														"required": ["provider", "model"],
														"additionalProperties": true
													}
												},
												"required": ["kind", "selection"],
												"additionalProperties": true
											}] },
											"members": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"name": { "type": "string" },
														"context": {
															"type": "string",
															"enum": ["fresh", "fork"]
														},
														"agent": {
															"type": "object",
															"properties": {
																"agentId": { "type": "string" },
																"revision": { "type": "number" },
																"name": { "type": "string" },
																"role": { "type": "string" },
																"mode": {
																	"type": "string",
																	"enum": ["dynamic", "fixed"]
																},
																"model": {
																	"type": "object",
																	"properties": {
																		"provider": { "type": "string" },
																		"model": { "type": "string" },
																		"reasoningEffort": { "type": "string" }
																	},
																	"required": ["provider", "model"],
																	"additionalProperties": true
																},
																"permission": {
																	"type": "string",
																	"enum": [
																		"read-only",
																		"workspace-write",
																		"danger-full-access"
																	]
																},
																"sourceVersionId": { "type": "string" },
																"skills": {
																	"type": "array",
																	"items": {
																		"type": "object",
																		"properties": {
																			"assetId": { "type": "string" },
																			"versionId": { "type": "string" },
																			"commit": { "type": "string" },
																			"treeDigest": { "type": "string" }
																		},
																		"required": [
																			"assetId",
																			"versionId",
																			"commit",
																			"treeDigest"
																		],
																		"additionalProperties": true
																	}
																},
																"createdAt": { "type": "number" },
																"updatedAt": { "type": "number" }
															},
															"required": [
																"agentId",
																"revision",
																"name",
																"role",
																"mode",
																"permission",
																"skills",
																"createdAt",
																"updatedAt"
															],
															"additionalProperties": true
														},
														"model": { "oneOf": [{
															"type": "object",
															"properties": { "kind": {
																"type": "string",
																"const": "default"
															} },
															"required": ["kind"],
															"additionalProperties": true
														}, {
															"type": "object",
															"properties": {
																"kind": {
																	"type": "string",
																	"const": "fixed"
																},
																"selection": {
																	"type": "object",
																	"properties": {
																		"provider": { "type": "string" },
																		"model": { "type": "string" },
																		"reasoningEffort": { "type": "string" }
																	},
																	"required": ["provider", "model"],
																	"additionalProperties": true
																}
															},
															"required": ["kind", "selection"],
															"additionalProperties": true
														}] }
													},
													"required": [
														"name",
														"context",
														"agent",
														"model"
													],
													"additionalProperties": true
												}
											},
											"createdAt": { "type": "number" },
											"updatedAt": { "type": "number" }
										},
										"required": [
											"teamId",
											"revision",
											"name",
											"description",
											"lead",
											"leadModel",
											"members",
											"createdAt",
											"updatedAt"
										],
										"additionalProperties": true
									}
								},
								"required": ["kind", "team"],
								"additionalProperties": true
							}
						] }
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2039,
						"column": 3
					}
				},
				"quantSkillsSessions/authoringSessionCreate": {
					service: "quantSkillsSessions",
					description: "Atomically create one Agent Session whose authoring purpose is durable before its tools are exposed.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "fresh Session identity, exact Agent revision, Workspace, and authoring kind.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"enum": [
											"skill",
											"agent",
											"agent-team"
										]
									},
									"sessionId": { "type": "string" },
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": [
									"kind",
									"sessionId",
									"agentId",
									"expectedRevision"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAuthoringSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"enum": [
											"skill",
											"agent",
											"agent-team"
										]
									},
									"sessionId": { "type": "string" },
									"agentId": { "type": "string" },
									"expectedRevision": { "type": "number" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": [
									"kind",
									"sessionId",
									"agentId",
									"expectedRevision"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsAgentSessionCreateResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_authoringSessionCreate_result$schema,
						description: "the published Agent Session and exact composition.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"agent": {
									"type": "object",
									"properties": {
										"agentId": { "type": "string" },
										"revision": { "type": "number" },
										"name": { "type": "string" },
										"role": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": ["dynamic", "fixed"]
										},
										"model": {
											"type": "object",
											"properties": {
												"provider": { "type": "string" },
												"model": { "type": "string" },
												"reasoningEffort": { "type": "string" }
											},
											"required": ["provider", "model"],
											"additionalProperties": true
										},
										"permission": {
											"type": "string",
											"enum": [
												"read-only",
												"workspace-write",
												"danger-full-access"
											]
										},
										"sourceVersionId": { "type": "string" },
										"skills": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {
													"assetId": { "type": "string" },
													"versionId": { "type": "string" },
													"commit": { "type": "string" },
													"treeDigest": { "type": "string" }
												},
												"required": [
													"assetId",
													"versionId",
													"commit",
													"treeDigest"
												],
												"additionalProperties": true
											}
										},
										"createdAt": { "type": "number" },
										"updatedAt": { "type": "number" }
									},
									"required": [
										"agentId",
										"revision",
										"name",
										"role",
										"mode",
										"permission",
										"skills",
										"createdAt",
										"updatedAt"
									],
									"additionalProperties": true
								},
								"agentPreset": { "type": "string" }
							},
							"required": ["sessionId", "agent"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2025,
						"column": 9
					}
				},
				"quantSkillsSessions/contestCheckUpdate": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestCheckUpdate_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1312,
						"column": 3
					}
				},
				"quantSkillsSessions/contestConnect": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestConnect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1303,
						"column": 3
					}
				},
				"quantSkillsSessions/contestDisconnect": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDisconnect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1306,
						"column": 9
					}
				},
				"quantSkillsSessions/contestDismiss": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestDismiss:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestDismiss:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestDismiss_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1403,
						"column": 3
					}
				},
				"quantSkillsSessions/contestExecute": {
					service: "quantSkillsSessions",
					description: "Client-only execution endpoint. The model is never given an execute tool.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestExecute:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestExecute:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestPlan",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestExecute_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"sessionId": { "type": "string" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"operation": {
									"type": "string",
									"enum": ["place_order", "cancel_order"]
								},
								"createdAt": { "type": "number" },
								"expiresAt": { "type": "number" },
								"summary": { "type": "string" },
								"details": {
									"type": "object",
									"properties": {},
									"required": [],
									"additionalProperties": true
								},
								"clientRequestId": { "type": "string" },
								"status": {
									"type": "string",
									"enum": [
										"failed",
										"prepared",
										"executing",
										"completed",
										"unknown",
										"cancelled",
										"expired",
										"queued",
										"submitted",
										"partial"
									]
								},
								"operationId": { "type": "string" },
								"result": {
									"type": "object",
									"properties": {},
									"required": [],
									"additionalProperties": true
								},
								"fills": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"tradeId": { "type": "string" },
											"orderId": { "type": "string" },
											"price": { "type": "number" },
											"volume": { "type": "number" },
											"time": { "type": "string" }
										},
										"required": [
											"id",
											"tradeId",
											"orderId",
											"price",
											"volume",
											"time"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"id",
								"sessionId",
								"identity",
								"operation",
								"createdAt",
								"expiresAt",
								"summary",
								"details",
								"clientRequestId",
								"status"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1398,
						"column": 3
					}
				},
				"quantSkillsSessions/contestInspect": {
					service: "quantSkillsSessions",
					description: "Entry inspection is bound to the persisted conversation, never a caller-supplied account.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestInspect:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestInspect:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestInspection",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestInspect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"fetchedAt": { "type": "number" },
								"account": {
									"type": "object",
									"properties": {
										"data": {},
										"meta": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" }
									},
									"required": ["data", "fetchedAt"],
									"additionalProperties": true
								},
								"positions": {
									"type": "object",
									"properties": {
										"data": {},
										"meta": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" }
									},
									"required": ["data", "fetchedAt"],
									"additionalProperties": true
								},
								"openOrders": {
									"type": "object",
									"properties": {
										"data": {},
										"meta": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" }
									},
									"required": ["data", "fetchedAt"],
									"additionalProperties": true
								},
								"pendingPlans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								},
								"summary": {
									"type": "array",
									"items": { "type": "string" }
								}
							},
							"required": [
								"identity",
								"fetchedAt",
								"account",
								"positions",
								"openOrders",
								"pendingPlans",
								"summary"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1358,
						"column": 9
					}
				},
				"quantSkillsSessions/contestJevConfigure": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestJevConfigure:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"apiKey": { "type": "string" },
									"translator": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": true
									}
								},
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestJevConfigure:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"apiKey": { "type": "string" },
									"translator": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": false
									}
								},
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestJevSettings",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevConfigure_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"configured": { "type": "boolean" },
								"writable": { "type": "boolean" },
								"model": { "type": "string" },
								"testedAt": { "type": "number" },
								"latencyMs": { "type": "number" },
								"message": { "type": "string" },
								"translator": {
									"type": "object",
									"properties": {
										"provider": { "type": "string" },
										"model": { "type": "string" }
									},
									"required": ["provider", "model"],
									"additionalProperties": true
								},
								"translationModels": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"configured",
								"writable",
								"model"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1342,
						"column": 3
					}
				},
				"quantSkillsSessions/contestJevSettings": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestJevSettings",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevSettings_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"configured": { "type": "boolean" },
								"writable": { "type": "boolean" },
								"model": { "type": "string" },
								"testedAt": { "type": "number" },
								"latencyMs": { "type": "number" },
								"message": { "type": "string" },
								"translator": {
									"type": "object",
									"properties": {
										"provider": { "type": "string" },
										"model": { "type": "string" }
									},
									"required": ["provider", "model"],
									"additionalProperties": true
								},
								"translationModels": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"provider": { "type": "string" },
											"model": { "type": "string" }
										},
										"required": ["provider", "model"],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"configured",
								"writable",
								"model"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1324,
						"column": 3
					}
				},
				"quantSkillsSessions/contestJevUsage": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestJevUsage",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestJevUsage_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"since": { "type": "number" },
								"requests": { "type": "number" },
								"responsesOk": { "type": "number" },
								"unknownUsage": { "type": "number" },
								"inputTokens": { "type": "number" },
								"outputTokens": { "type": "number" },
								"records": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"purpose": {
												"type": "string",
												"enum": [
													"watch",
													"connection-test",
													"research",
													"validation"
												]
											},
											"startedAt": { "type": "number" },
											"finishedAt": { "type": "number" },
											"keyFingerprint": { "type": "string" },
											"httpStatus": { "type": "number" },
											"model": { "type": "string" },
											"usage": {
												"type": "object",
												"properties": {
													"input_tokens": { "type": "number" },
													"output_tokens": { "type": "number" }
												},
												"required": ["input_tokens", "output_tokens"],
												"additionalProperties": true
											}
										},
										"required": [
											"id",
											"purpose",
											"startedAt",
											"finishedAt",
											"keyFingerprint"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"since",
								"requests",
								"responsesOk",
								"unknownUsage",
								"inputTokens",
								"outputTokens",
								"records"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1327,
						"column": 3
					}
				},
				"quantSkillsSessions/contestMode": {
					service: "quantSkillsSessions",
					description: "Explicit application mode toggle; never changes ordinary Session composition.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestMode:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "enabled": { "type": "boolean" } },
								"required": ["enabled"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestMode:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "enabled": { "type": "boolean" } },
								"required": ["enabled"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestMode_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1297,
						"column": 9
					}
				},
				"quantSkillsSessions/contestQuery": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestQuery",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"enum": [
											"account",
											"positions",
											"open-orders",
											"orders",
											"trades",
											"ranking",
											"ranking-me",
											"settlements",
											"quote",
											"varieties"
										]
									},
									"symbol": { "type": "string" },
									"date": { "type": "string" },
									"lastId": { "type": "string" },
									"board": {
										"type": "string",
										"enum": ["live", "settled"]
									}
								},
								"required": ["kind"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestQuery",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"enum": [
											"account",
											"positions",
											"open-orders",
											"orders",
											"trades",
											"ranking",
											"ranking-me",
											"settlements",
											"quote",
											"varieties"
										]
									},
									"symbol": { "type": "string" },
									"date": { "type": "string" },
									"lastId": { "type": "string" },
									"board": {
										"type": "string",
										"enum": ["live", "settled"]
									}
								},
								"required": ["kind"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestData",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestQuery_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"data": {},
								"meta": {
									"type": "object",
									"properties": {},
									"required": [],
									"additionalProperties": true
								},
								"fetchedAt": { "type": "number" }
							},
							"required": ["data", "fetchedAt"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1354,
						"column": 3
					}
				},
				"quantSkillsSessions/contestReconcile": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestReconcile:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestReconcile:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestPlan",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestReconcile_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"sessionId": { "type": "string" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"operation": {
									"type": "string",
									"enum": ["place_order", "cancel_order"]
								},
								"createdAt": { "type": "number" },
								"expiresAt": { "type": "number" },
								"summary": { "type": "string" },
								"details": {
									"type": "object",
									"properties": {},
									"required": [],
									"additionalProperties": true
								},
								"clientRequestId": { "type": "string" },
								"status": {
									"type": "string",
									"enum": [
										"failed",
										"prepared",
										"executing",
										"completed",
										"unknown",
										"cancelled",
										"expired",
										"queued",
										"submitted",
										"partial"
									]
								},
								"operationId": { "type": "string" },
								"result": {
									"type": "object",
									"properties": {},
									"required": [],
									"additionalProperties": true
								},
								"fills": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"tradeId": { "type": "string" },
											"orderId": { "type": "string" },
											"price": { "type": "number" },
											"volume": { "type": "number" },
											"time": { "type": "string" }
										},
										"required": [
											"id",
											"tradeId",
											"orderId",
											"price",
											"volume",
											"time"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"id",
								"sessionId",
								"identity",
								"operation",
								"createdAt",
								"expiresAt",
								"summary",
								"details",
								"clientRequestId",
								"status"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1408,
						"column": 3
					}
				},
				"quantSkillsSessions/contestSessionOpen": {
					service: "quantSkillsSessions",
					description: "Serialize entry across clients so each account reuses one main conversation.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"topic": { "type": "boolean" }
								},
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"topic": { "type": "boolean" }
								},
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestSessionOpen_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"binding": {
									"type": "object",
									"properties": {
										"purpose": {
											"type": "string",
											"enum": [
												"ordinary",
												"role-helper",
												"contest",
												"factor-contest"
											]
										},
										"contest": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"factorContest": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"contestConversation": {
											"type": "string",
											"enum": ["main", "topic"]
										}
									},
									"required": ["purpose"],
									"additionalProperties": true
								},
								"created": { "type": "boolean" }
							},
							"required": [
								"sessionId",
								"binding",
								"created"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1367,
						"column": 3
					}
				},
				"quantSkillsSessions/contestStatus": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestStatus:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestStatus:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestStatus_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1293,
						"column": 3
					}
				},
				"quantSkillsSessions/contestUpdate": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestUpdate_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"retryAt": { "type": "number" },
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"operation": {
												"type": "string",
												"enum": ["place_order", "cancel_order"]
											},
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"summary": { "type": "string" },
											"details": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"clientRequestId": { "type": "string" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired",
													"queued",
													"submitted",
													"partial"
												]
											},
											"operationId": { "type": "string" },
											"result": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"fills": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"tradeId": { "type": "string" },
														"orderId": { "type": "string" },
														"price": { "type": "number" },
														"volume": { "type": "number" },
														"time": { "type": "string" }
													},
													"required": [
														"id",
														"tradeId",
														"orderId",
														"price",
														"volume",
														"time"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"operation",
											"createdAt",
											"expiresAt",
											"summary",
											"details",
											"clientRequestId",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1315,
						"column": 9
					}
				},
				"quantSkillsSessions/contestWatchDatasets": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchDatasets:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchDatasets_result$schema,
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"name": { "type": "string" },
									"columns": {
										"type": "array",
										"items": { "type": "string" }
									},
									"rows": { "type": "number" },
									"source": { "type": "string" }
								},
								"required": [
									"id",
									"name",
									"columns",
									"rows",
									"source"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1336,
						"column": 3
					}
				},
				"quantSkillsSessions/contestWatchPrepareHistory": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchPrepareHistory:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"symbol": { "type": "string" },
									"barSeconds": { "type": "number" }
								},
								"required": ["symbol", "barSeconds"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchPrepareHistory:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"symbol": { "type": "string" },
									"barSeconds": { "type": "number" }
								},
								"required": ["symbol", "barSeconds"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchPrepareHistory:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchPrepareHistory_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"datasetId": { "type": "string" },
								"barSeconds": {
									"type": "number",
									"enum": [60, 300]
								},
								"timeMeaning": {
									"type": "string",
									"enum": ["open", "close"]
								},
								"refresh": { "type": "boolean" },
								"columns": {
									"type": "object",
									"properties": {
										"time": { "type": "string" },
										"symbol": { "type": "string" },
										"open": { "type": "string" },
										"high": { "type": "string" },
										"low": { "type": "string" },
										"close": { "type": "string" }
									},
									"required": [
										"time",
										"symbol",
										"open",
										"high",
										"low",
										"close"
									],
									"additionalProperties": true
								}
							},
							"required": [
								"datasetId",
								"barSeconds",
								"timeMeaning",
								"refresh",
								"columns"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1339,
						"column": 3
					}
				},
				"quantSkillsSessions/contestWatchSaveTemplate": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestWatchTemplate",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"config": {
										"type": "object",
										"properties": {
											"executionMode": {
												"type": "string",
												"enum": ["manual", "automatic"]
											},
											"symbol": { "type": "string" },
											"contracts": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"symbol": { "type": "string" },
														"instrument": {
															"type": "object",
															"properties": {
																"product": { "type": "string" },
																"exchange": {
																	"type": "string",
																	"enum": [
																		"SHF",
																		"DCE",
																		"CZC",
																		"CFE",
																		"INE",
																		"GFE"
																	]
																},
																"tickSize": { "type": "number" }
															},
															"required": [
																"product",
																"exchange",
																"tickSize"
															],
															"additionalProperties": true
														}
													},
													"required": ["symbol", "instrument"],
													"additionalProperties": true
												},
												"description": "Selected actual contracts; omitted for older single-contract configurations."
											},
											"volume": { "type": "number" },
											"intervalSeconds": { "type": "number" },
											"decisionIntervalSeconds": { "type": "number" },
											"openingCooldownSeconds": { "type": "number" },
											"decisionMode": {
												"type": "string",
												"enum": ["jev", "strict"]
											},
											"durationMinutes": { "type": "number" },
											"minConfidence": { "type": "number" },
											"maxEquityDrop": { "type": "number" },
											"maxPlans": { "type": "number" },
											"instructions": { "type": "string" },
											"strategyName": { "type": "string" },
											"actionCriteria": {
												"type": "object",
												"properties": {
													"hold": { "type": "string" },
													"open_long": { "type": "string" },
													"open_short": { "type": "string" },
													"close_long": { "type": "string" },
													"close_short": { "type": "string" }
												},
												"required": [],
												"additionalProperties": true
											},
											"referenceMaterial": { "type": "string" },
											"allowedSide": {
												"type": "string",
												"enum": [
													"both",
													"long_only",
													"short_only"
												]
											},
											"minSamples": { "type": "number" },
											"maxSpread": { "type": "number" },
											"builtInTemplate": {
												"type": "string",
												"enum": [
													"rb-range",
													"range",
													"trend",
													"breakout"
												]
											},
											"customStrategy": {
												"type": "boolean",
												"enum": [false, true]
											},
											"instrument": {
												"type": "object",
												"properties": {
													"product": { "type": "string" },
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"tickSize": { "type": "number" }
												},
												"required": [
													"product",
													"exchange",
													"tickSize"
												],
												"additionalProperties": true
											},
											"signalRules": {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"enum": ["trend", "breakout"]
													},
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" },
													"fastBars": { "type": "number" },
													"slowBars": { "type": "number" },
													"pullbackTicks": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"bufferTicks": { "type": "number" },
													"maxChaseTicks": { "type": "number" }
												},
												"required": [
													"kind",
													"lookbackBars",
													"tickSize",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks",
													"fastBars",
													"slowBars",
													"pullbackTicks",
													"reboundTicks",
													"bufferTicks",
													"maxChaseTicks"
												],
												"additionalProperties": true
											},
											"autoHistory": {
												"type": "object",
												"properties": {
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													}
												},
												"required": ["exchange", "barSeconds"],
												"additionalProperties": true
											},
											"history": {
												"type": "object",
												"properties": {
													"datasetId": { "type": "string" },
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													},
													"timeMeaning": {
														"type": "string",
														"enum": ["open", "close"]
													},
													"refresh": { "type": "boolean" },
													"columns": {
														"type": "object",
														"properties": {
															"time": { "type": "string" },
															"symbol": { "type": "string" },
															"open": { "type": "string" },
															"high": { "type": "string" },
															"low": { "type": "string" },
															"close": { "type": "string" }
														},
														"required": [
															"time",
															"symbol",
															"open",
															"high",
															"low",
															"close"
														],
														"additionalProperties": true
													}
												},
												"required": [
													"datasetId",
													"barSeconds",
													"timeMeaning",
													"refresh",
													"columns"
												],
												"additionalProperties": true
											},
											"rangeRules": {
												"type": "object",
												"properties": {
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"minWidthTicks": { "type": "number" },
													"minTouches": { "type": "number" },
													"edgeFraction": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" }
												},
												"required": [
													"lookbackBars",
													"tickSize",
													"minWidthTicks",
													"minTouches",
													"edgeFraction",
													"reboundTicks",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks"
												],
												"additionalProperties": true
											}
										},
										"required": [
											"symbol",
											"volume",
											"intervalSeconds",
											"durationMinutes",
											"minConfidence",
											"maxEquityDrop",
											"maxPlans",
											"instructions"
										],
										"additionalProperties": true
									}
								},
								"required": ["name", "config"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestWatchTemplate",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"config": {
										"type": "object",
										"properties": {
											"executionMode": {
												"type": "string",
												"enum": ["manual", "automatic"]
											},
											"symbol": { "type": "string" },
											"contracts": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"symbol": { "type": "string" },
														"instrument": {
															"type": "object",
															"properties": {
																"product": { "type": "string" },
																"exchange": {
																	"type": "string",
																	"enum": [
																		"SHF",
																		"DCE",
																		"CZC",
																		"CFE",
																		"INE",
																		"GFE"
																	]
																},
																"tickSize": { "type": "number" }
															},
															"required": [
																"product",
																"exchange",
																"tickSize"
															],
															"additionalProperties": false
														}
													},
													"required": ["symbol", "instrument"],
													"additionalProperties": false
												},
												"description": "Selected actual contracts; omitted for older single-contract configurations."
											},
											"volume": { "type": "number" },
											"intervalSeconds": { "type": "number" },
											"decisionIntervalSeconds": { "type": "number" },
											"openingCooldownSeconds": { "type": "number" },
											"decisionMode": {
												"type": "string",
												"enum": ["jev", "strict"]
											},
											"durationMinutes": { "type": "number" },
											"minConfidence": { "type": "number" },
											"maxEquityDrop": { "type": "number" },
											"maxPlans": { "type": "number" },
											"instructions": { "type": "string" },
											"strategyName": { "type": "string" },
											"actionCriteria": {
												"type": "object",
												"properties": {
													"hold": { "type": "string" },
													"open_long": { "type": "string" },
													"open_short": { "type": "string" },
													"close_long": { "type": "string" },
													"close_short": { "type": "string" }
												},
												"required": [],
												"additionalProperties": false
											},
											"referenceMaterial": { "type": "string" },
											"allowedSide": {
												"type": "string",
												"enum": [
													"both",
													"long_only",
													"short_only"
												]
											},
											"minSamples": { "type": "number" },
											"maxSpread": { "type": "number" },
											"builtInTemplate": {
												"type": "string",
												"enum": [
													"rb-range",
													"range",
													"trend",
													"breakout"
												]
											},
											"customStrategy": {
												"type": "boolean",
												"enum": [false, true]
											},
											"instrument": {
												"type": "object",
												"properties": {
													"product": { "type": "string" },
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"tickSize": { "type": "number" }
												},
												"required": [
													"product",
													"exchange",
													"tickSize"
												],
												"additionalProperties": false
											},
											"signalRules": {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"enum": ["trend", "breakout"]
													},
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" },
													"fastBars": { "type": "number" },
													"slowBars": { "type": "number" },
													"pullbackTicks": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"bufferTicks": { "type": "number" },
													"maxChaseTicks": { "type": "number" }
												},
												"required": [
													"kind",
													"lookbackBars",
													"tickSize",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks",
													"fastBars",
													"slowBars",
													"pullbackTicks",
													"reboundTicks",
													"bufferTicks",
													"maxChaseTicks"
												],
												"additionalProperties": false
											},
											"autoHistory": {
												"type": "object",
												"properties": {
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													}
												},
												"required": ["exchange", "barSeconds"],
												"additionalProperties": false
											},
											"history": {
												"type": "object",
												"properties": {
													"datasetId": { "type": "string" },
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													},
													"timeMeaning": {
														"type": "string",
														"enum": ["open", "close"]
													},
													"refresh": { "type": "boolean" },
													"columns": {
														"type": "object",
														"properties": {
															"time": { "type": "string" },
															"symbol": { "type": "string" },
															"open": { "type": "string" },
															"high": { "type": "string" },
															"low": { "type": "string" },
															"close": { "type": "string" }
														},
														"required": [
															"time",
															"symbol",
															"open",
															"high",
															"low",
															"close"
														],
														"additionalProperties": false
													}
												},
												"required": [
													"datasetId",
													"barSeconds",
													"timeMeaning",
													"refresh",
													"columns"
												],
												"additionalProperties": false
											},
											"rangeRules": {
												"type": "object",
												"properties": {
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"minWidthTicks": { "type": "number" },
													"minTouches": { "type": "number" },
													"edgeFraction": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" }
												},
												"required": [
													"lookbackBars",
													"tickSize",
													"minWidthTicks",
													"minTouches",
													"edgeFraction",
													"reboundTicks",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks"
												],
												"additionalProperties": false
											}
										},
										"required": [
											"symbol",
											"volume",
											"intervalSeconds",
											"durationMinutes",
											"minConfidence",
											"maxEquityDrop",
											"maxPlans",
											"instructions"
										],
										"additionalProperties": false
									}
								},
								"required": ["name", "config"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchSaveTemplate:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchSaveTemplate_result$schema,
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"config": {
										"type": "object",
										"properties": {
											"executionMode": {
												"type": "string",
												"enum": ["manual", "automatic"]
											},
											"symbol": { "type": "string" },
											"contracts": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"symbol": { "type": "string" },
														"instrument": {
															"type": "object",
															"properties": {
																"product": { "type": "string" },
																"exchange": {
																	"type": "string",
																	"enum": [
																		"SHF",
																		"DCE",
																		"CZC",
																		"CFE",
																		"INE",
																		"GFE"
																	]
																},
																"tickSize": { "type": "number" }
															},
															"required": [
																"product",
																"exchange",
																"tickSize"
															],
															"additionalProperties": true
														}
													},
													"required": ["symbol", "instrument"],
													"additionalProperties": true
												},
												"description": "Selected actual contracts; omitted for older single-contract configurations."
											},
											"volume": { "type": "number" },
											"intervalSeconds": { "type": "number" },
											"decisionIntervalSeconds": { "type": "number" },
											"openingCooldownSeconds": { "type": "number" },
											"decisionMode": {
												"type": "string",
												"enum": ["jev", "strict"]
											},
											"durationMinutes": { "type": "number" },
											"minConfidence": { "type": "number" },
											"maxEquityDrop": { "type": "number" },
											"maxPlans": { "type": "number" },
											"instructions": { "type": "string" },
											"strategyName": { "type": "string" },
											"actionCriteria": {
												"type": "object",
												"properties": {
													"hold": { "type": "string" },
													"open_long": { "type": "string" },
													"open_short": { "type": "string" },
													"close_long": { "type": "string" },
													"close_short": { "type": "string" }
												},
												"required": [],
												"additionalProperties": true
											},
											"referenceMaterial": { "type": "string" },
											"allowedSide": {
												"type": "string",
												"enum": [
													"both",
													"long_only",
													"short_only"
												]
											},
											"minSamples": { "type": "number" },
											"maxSpread": { "type": "number" },
											"builtInTemplate": {
												"type": "string",
												"enum": [
													"rb-range",
													"range",
													"trend",
													"breakout"
												]
											},
											"customStrategy": {
												"type": "boolean",
												"enum": [false, true]
											},
											"instrument": {
												"type": "object",
												"properties": {
													"product": { "type": "string" },
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"tickSize": { "type": "number" }
												},
												"required": [
													"product",
													"exchange",
													"tickSize"
												],
												"additionalProperties": true
											},
											"signalRules": {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"enum": ["trend", "breakout"]
													},
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" },
													"fastBars": { "type": "number" },
													"slowBars": { "type": "number" },
													"pullbackTicks": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"bufferTicks": { "type": "number" },
													"maxChaseTicks": { "type": "number" }
												},
												"required": [
													"kind",
													"lookbackBars",
													"tickSize",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks",
													"fastBars",
													"slowBars",
													"pullbackTicks",
													"reboundTicks",
													"bufferTicks",
													"maxChaseTicks"
												],
												"additionalProperties": true
											},
											"autoHistory": {
												"type": "object",
												"properties": {
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													}
												},
												"required": ["exchange", "barSeconds"],
												"additionalProperties": true
											},
											"history": {
												"type": "object",
												"properties": {
													"datasetId": { "type": "string" },
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													},
													"timeMeaning": {
														"type": "string",
														"enum": ["open", "close"]
													},
													"refresh": { "type": "boolean" },
													"columns": {
														"type": "object",
														"properties": {
															"time": { "type": "string" },
															"symbol": { "type": "string" },
															"open": { "type": "string" },
															"high": { "type": "string" },
															"low": { "type": "string" },
															"close": { "type": "string" }
														},
														"required": [
															"time",
															"symbol",
															"open",
															"high",
															"low",
															"close"
														],
														"additionalProperties": true
													}
												},
												"required": [
													"datasetId",
													"barSeconds",
													"timeMeaning",
													"refresh",
													"columns"
												],
												"additionalProperties": true
											},
											"rangeRules": {
												"type": "object",
												"properties": {
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"minWidthTicks": { "type": "number" },
													"minTouches": { "type": "number" },
													"edgeFraction": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" }
												},
												"required": [
													"lookbackBars",
													"tickSize",
													"minWidthTicks",
													"minTouches",
													"edgeFraction",
													"reboundTicks",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks"
												],
												"additionalProperties": true
											}
										},
										"required": [
											"symbol",
											"volume",
											"intervalSeconds",
											"durationMinutes",
											"minConfidence",
											"maxEquityDrop",
											"maxPlans",
											"instructions"
										],
										"additionalProperties": true
									}
								},
								"required": ["name", "config"],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1333,
						"column": 3
					}
				},
				"quantSkillsSessions/contestWatchStart": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchStart:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"config": {
										"type": "object",
										"properties": {
											"executionMode": {
												"type": "string",
												"enum": ["manual", "automatic"]
											},
											"symbol": { "type": "string" },
											"contracts": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"symbol": { "type": "string" },
														"instrument": {
															"type": "object",
															"properties": {
																"product": { "type": "string" },
																"exchange": {
																	"type": "string",
																	"enum": [
																		"SHF",
																		"DCE",
																		"CZC",
																		"CFE",
																		"INE",
																		"GFE"
																	]
																},
																"tickSize": { "type": "number" }
															},
															"required": [
																"product",
																"exchange",
																"tickSize"
															],
															"additionalProperties": true
														}
													},
													"required": ["symbol", "instrument"],
													"additionalProperties": true
												},
												"description": "Selected actual contracts; omitted for older single-contract configurations."
											},
											"volume": { "type": "number" },
											"intervalSeconds": { "type": "number" },
											"decisionIntervalSeconds": { "type": "number" },
											"openingCooldownSeconds": { "type": "number" },
											"decisionMode": {
												"type": "string",
												"enum": ["jev", "strict"]
											},
											"durationMinutes": { "type": "number" },
											"minConfidence": { "type": "number" },
											"maxEquityDrop": { "type": "number" },
											"maxPlans": { "type": "number" },
											"instructions": { "type": "string" },
											"strategyName": { "type": "string" },
											"actionCriteria": {
												"type": "object",
												"properties": {
													"hold": { "type": "string" },
													"open_long": { "type": "string" },
													"open_short": { "type": "string" },
													"close_long": { "type": "string" },
													"close_short": { "type": "string" }
												},
												"required": [],
												"additionalProperties": true
											},
											"referenceMaterial": { "type": "string" },
											"allowedSide": {
												"type": "string",
												"enum": [
													"both",
													"long_only",
													"short_only"
												]
											},
											"minSamples": { "type": "number" },
											"maxSpread": { "type": "number" },
											"builtInTemplate": {
												"type": "string",
												"enum": [
													"rb-range",
													"range",
													"trend",
													"breakout"
												]
											},
											"customStrategy": {
												"type": "boolean",
												"enum": [false, true]
											},
											"instrument": {
												"type": "object",
												"properties": {
													"product": { "type": "string" },
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"tickSize": { "type": "number" }
												},
												"required": [
													"product",
													"exchange",
													"tickSize"
												],
												"additionalProperties": true
											},
											"signalRules": {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"enum": ["trend", "breakout"]
													},
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" },
													"fastBars": { "type": "number" },
													"slowBars": { "type": "number" },
													"pullbackTicks": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"bufferTicks": { "type": "number" },
													"maxChaseTicks": { "type": "number" }
												},
												"required": [
													"kind",
													"lookbackBars",
													"tickSize",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks",
													"fastBars",
													"slowBars",
													"pullbackTicks",
													"reboundTicks",
													"bufferTicks",
													"maxChaseTicks"
												],
												"additionalProperties": true
											},
											"autoHistory": {
												"type": "object",
												"properties": {
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													}
												},
												"required": ["exchange", "barSeconds"],
												"additionalProperties": true
											},
											"history": {
												"type": "object",
												"properties": {
													"datasetId": { "type": "string" },
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													},
													"timeMeaning": {
														"type": "string",
														"enum": ["open", "close"]
													},
													"refresh": { "type": "boolean" },
													"columns": {
														"type": "object",
														"properties": {
															"time": { "type": "string" },
															"symbol": { "type": "string" },
															"open": { "type": "string" },
															"high": { "type": "string" },
															"low": { "type": "string" },
															"close": { "type": "string" }
														},
														"required": [
															"time",
															"symbol",
															"open",
															"high",
															"low",
															"close"
														],
														"additionalProperties": true
													}
												},
												"required": [
													"datasetId",
													"barSeconds",
													"timeMeaning",
													"refresh",
													"columns"
												],
												"additionalProperties": true
											},
											"rangeRules": {
												"type": "object",
												"properties": {
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"minWidthTicks": { "type": "number" },
													"minTouches": { "type": "number" },
													"edgeFraction": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" }
												},
												"required": [
													"lookbackBars",
													"tickSize",
													"minWidthTicks",
													"minTouches",
													"edgeFraction",
													"reboundTicks",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks"
												],
												"additionalProperties": true
											}
										},
										"required": [
											"symbol",
											"volume",
											"intervalSeconds",
											"durationMinutes",
											"minConfidence",
											"maxEquityDrop",
											"maxPlans",
											"instructions"
										],
										"additionalProperties": true
									},
									"confirmed": { "type": "boolean" },
									"executionConsent": { "type": "string" }
								},
								"required": ["config", "confirmed"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchStart:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"config": {
										"type": "object",
										"properties": {
											"executionMode": {
												"type": "string",
												"enum": ["manual", "automatic"]
											},
											"symbol": { "type": "string" },
											"contracts": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"symbol": { "type": "string" },
														"instrument": {
															"type": "object",
															"properties": {
																"product": { "type": "string" },
																"exchange": {
																	"type": "string",
																	"enum": [
																		"SHF",
																		"DCE",
																		"CZC",
																		"CFE",
																		"INE",
																		"GFE"
																	]
																},
																"tickSize": { "type": "number" }
															},
															"required": [
																"product",
																"exchange",
																"tickSize"
															],
															"additionalProperties": false
														}
													},
													"required": ["symbol", "instrument"],
													"additionalProperties": false
												},
												"description": "Selected actual contracts; omitted for older single-contract configurations."
											},
											"volume": { "type": "number" },
											"intervalSeconds": { "type": "number" },
											"decisionIntervalSeconds": { "type": "number" },
											"openingCooldownSeconds": { "type": "number" },
											"decisionMode": {
												"type": "string",
												"enum": ["jev", "strict"]
											},
											"durationMinutes": { "type": "number" },
											"minConfidence": { "type": "number" },
											"maxEquityDrop": { "type": "number" },
											"maxPlans": { "type": "number" },
											"instructions": { "type": "string" },
											"strategyName": { "type": "string" },
											"actionCriteria": {
												"type": "object",
												"properties": {
													"hold": { "type": "string" },
													"open_long": { "type": "string" },
													"open_short": { "type": "string" },
													"close_long": { "type": "string" },
													"close_short": { "type": "string" }
												},
												"required": [],
												"additionalProperties": false
											},
											"referenceMaterial": { "type": "string" },
											"allowedSide": {
												"type": "string",
												"enum": [
													"both",
													"long_only",
													"short_only"
												]
											},
											"minSamples": { "type": "number" },
											"maxSpread": { "type": "number" },
											"builtInTemplate": {
												"type": "string",
												"enum": [
													"rb-range",
													"range",
													"trend",
													"breakout"
												]
											},
											"customStrategy": {
												"type": "boolean",
												"enum": [false, true]
											},
											"instrument": {
												"type": "object",
												"properties": {
													"product": { "type": "string" },
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"tickSize": { "type": "number" }
												},
												"required": [
													"product",
													"exchange",
													"tickSize"
												],
												"additionalProperties": false
											},
											"signalRules": {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"enum": ["trend", "breakout"]
													},
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" },
													"fastBars": { "type": "number" },
													"slowBars": { "type": "number" },
													"pullbackTicks": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"bufferTicks": { "type": "number" },
													"maxChaseTicks": { "type": "number" }
												},
												"required": [
													"kind",
													"lookbackBars",
													"tickSize",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks",
													"fastBars",
													"slowBars",
													"pullbackTicks",
													"reboundTicks",
													"bufferTicks",
													"maxChaseTicks"
												],
												"additionalProperties": false
											},
											"autoHistory": {
												"type": "object",
												"properties": {
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													}
												},
												"required": ["exchange", "barSeconds"],
												"additionalProperties": false
											},
											"history": {
												"type": "object",
												"properties": {
													"datasetId": { "type": "string" },
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													},
													"timeMeaning": {
														"type": "string",
														"enum": ["open", "close"]
													},
													"refresh": { "type": "boolean" },
													"columns": {
														"type": "object",
														"properties": {
															"time": { "type": "string" },
															"symbol": { "type": "string" },
															"open": { "type": "string" },
															"high": { "type": "string" },
															"low": { "type": "string" },
															"close": { "type": "string" }
														},
														"required": [
															"time",
															"symbol",
															"open",
															"high",
															"low",
															"close"
														],
														"additionalProperties": false
													}
												},
												"required": [
													"datasetId",
													"barSeconds",
													"timeMeaning",
													"refresh",
													"columns"
												],
												"additionalProperties": false
											},
											"rangeRules": {
												"type": "object",
												"properties": {
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"minWidthTicks": { "type": "number" },
													"minTouches": { "type": "number" },
													"edgeFraction": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" }
												},
												"required": [
													"lookbackBars",
													"tickSize",
													"minWidthTicks",
													"minTouches",
													"edgeFraction",
													"reboundTicks",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks"
												],
												"additionalProperties": false
											}
										},
										"required": [
											"symbol",
											"volume",
											"intervalSeconds",
											"durationMinutes",
											"minConfidence",
											"maxEquityDrop",
											"maxPlans",
											"instructions"
										],
										"additionalProperties": false
									},
									"confirmed": { "type": "boolean" },
									"executionConsent": { "type": "string" }
								},
								"required": ["config", "confirmed"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestWatchStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStart_result$schema,
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1345,
						"column": 3
					}
				},
				"quantSkillsSessions/contestWatchStatus": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestWatchStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStatus_result$schema,
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1321,
						"column": 3
					}
				},
				"quantSkillsSessions/contestWatchStop": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestWatchStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchStop_result$schema,
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1351,
						"column": 3
					}
				},
				"quantSkillsSessions/contestWatchTemplates": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/contestWatchTemplates:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_contestWatchTemplates_result$schema,
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"config": {
										"type": "object",
										"properties": {
											"executionMode": {
												"type": "string",
												"enum": ["manual", "automatic"]
											},
											"symbol": { "type": "string" },
											"contracts": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"symbol": { "type": "string" },
														"instrument": {
															"type": "object",
															"properties": {
																"product": { "type": "string" },
																"exchange": {
																	"type": "string",
																	"enum": [
																		"SHF",
																		"DCE",
																		"CZC",
																		"CFE",
																		"INE",
																		"GFE"
																	]
																},
																"tickSize": { "type": "number" }
															},
															"required": [
																"product",
																"exchange",
																"tickSize"
															],
															"additionalProperties": true
														}
													},
													"required": ["symbol", "instrument"],
													"additionalProperties": true
												},
												"description": "Selected actual contracts; omitted for older single-contract configurations."
											},
											"volume": { "type": "number" },
											"intervalSeconds": { "type": "number" },
											"decisionIntervalSeconds": { "type": "number" },
											"openingCooldownSeconds": { "type": "number" },
											"decisionMode": {
												"type": "string",
												"enum": ["jev", "strict"]
											},
											"durationMinutes": { "type": "number" },
											"minConfidence": { "type": "number" },
											"maxEquityDrop": { "type": "number" },
											"maxPlans": { "type": "number" },
											"instructions": { "type": "string" },
											"strategyName": { "type": "string" },
											"actionCriteria": {
												"type": "object",
												"properties": {
													"hold": { "type": "string" },
													"open_long": { "type": "string" },
													"open_short": { "type": "string" },
													"close_long": { "type": "string" },
													"close_short": { "type": "string" }
												},
												"required": [],
												"additionalProperties": true
											},
											"referenceMaterial": { "type": "string" },
											"allowedSide": {
												"type": "string",
												"enum": [
													"both",
													"long_only",
													"short_only"
												]
											},
											"minSamples": { "type": "number" },
											"maxSpread": { "type": "number" },
											"builtInTemplate": {
												"type": "string",
												"enum": [
													"rb-range",
													"range",
													"trend",
													"breakout"
												]
											},
											"customStrategy": {
												"type": "boolean",
												"enum": [false, true]
											},
											"instrument": {
												"type": "object",
												"properties": {
													"product": { "type": "string" },
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"tickSize": { "type": "number" }
												},
												"required": [
													"product",
													"exchange",
													"tickSize"
												],
												"additionalProperties": true
											},
											"signalRules": {
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"enum": ["trend", "breakout"]
													},
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" },
													"fastBars": { "type": "number" },
													"slowBars": { "type": "number" },
													"pullbackTicks": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"bufferTicks": { "type": "number" },
													"maxChaseTicks": { "type": "number" }
												},
												"required": [
													"kind",
													"lookbackBars",
													"tickSize",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks",
													"fastBars",
													"slowBars",
													"pullbackTicks",
													"reboundTicks",
													"bufferTicks",
													"maxChaseTicks"
												],
												"additionalProperties": true
											},
											"autoHistory": {
												"type": "object",
												"properties": {
													"exchange": {
														"type": "string",
														"enum": [
															"SHF",
															"DCE",
															"CZC",
															"CFE",
															"INE",
															"GFE"
														]
													},
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													}
												},
												"required": ["exchange", "barSeconds"],
												"additionalProperties": true
											},
											"history": {
												"type": "object",
												"properties": {
													"datasetId": { "type": "string" },
													"barSeconds": {
														"type": "number",
														"enum": [60, 300]
													},
													"timeMeaning": {
														"type": "string",
														"enum": ["open", "close"]
													},
													"refresh": { "type": "boolean" },
													"columns": {
														"type": "object",
														"properties": {
															"time": { "type": "string" },
															"symbol": { "type": "string" },
															"open": { "type": "string" },
															"high": { "type": "string" },
															"low": { "type": "string" },
															"close": { "type": "string" }
														},
														"required": [
															"time",
															"symbol",
															"open",
															"high",
															"low",
															"close"
														],
														"additionalProperties": true
													}
												},
												"required": [
													"datasetId",
													"barSeconds",
													"timeMeaning",
													"refresh",
													"columns"
												],
												"additionalProperties": true
											},
											"rangeRules": {
												"type": "object",
												"properties": {
													"lookbackBars": { "type": "number" },
													"tickSize": { "type": "number" },
													"minWidthTicks": { "type": "number" },
													"minTouches": { "type": "number" },
													"edgeFraction": { "type": "number" },
													"reboundTicks": { "type": "number" },
													"roundTripCostTicks": { "type": "number" },
													"minRewardCostRatio": { "type": "number" },
													"stopLossTicks": { "type": "number" },
													"takeProfitTicks": { "type": "number" }
												},
												"required": [
													"lookbackBars",
													"tickSize",
													"minWidthTicks",
													"minTouches",
													"edgeFraction",
													"reboundTicks",
													"roundTripCostTicks",
													"minRewardCostRatio",
													"stopLossTicks",
													"takeProfitTicks"
												],
												"additionalProperties": true
											}
										},
										"required": [
											"symbol",
											"volume",
											"intervalSeconds",
											"durationMinutes",
											"minConfidence",
											"maxEquityDrop",
											"maxPlans",
											"instructions"
										],
										"additionalProperties": true
									}
								},
								"required": ["name", "config"],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1330,
						"column": 3
					}
				},
				"quantSkillsSessions/create": {
					service: "quantSkillsSessions",
					description: "Create or idempotently adopt one session under an exact installed Skill version.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "preallocated SessionId, exact installed version, and ordinary create options.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"versionId": { "type": "string" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": ["sessionId", "versionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"versionId": { "type": "string" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": ["sessionId", "versionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionCreateResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_create_result$schema,
						description: "the published session identity and durable binding.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"binding": {
									"type": "object",
									"properties": {
										"assetId": { "type": "string" },
										"versionId": { "type": "string" },
										"commit": { "type": "string" },
										"treeDigest": { "type": "string" }
									},
									"required": [
										"assetId",
										"versionId",
										"commit",
										"treeDigest"
									],
									"additionalProperties": true
								},
								"agentPreset": { "type": "string" }
							},
							"required": ["sessionId", "binding"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1540,
						"column": 9
					}
				},
				"quantSkillsSessions/deletionPreview": {
					service: "quantSkillsSessions",
					description: "Separate reversible archive/restore from permanent conversation erasure.",
					implementation: "previewSessionDeletion",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/deletionPreview:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/deletionPreview:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#SessionDeletionPreview",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_deletionPreview_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"token": { "type": "string" },
								"files": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"path": { "type": "string" },
											"bytes": { "type": "number" }
										},
										"required": ["path", "bytes"],
										"additionalProperties": true
									}
								},
								"retained": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"path": { "type": "string" },
											"reason": { "type": "string" }
										},
										"required": ["path", "reason"],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"sessionId",
								"token",
								"files",
								"retained"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1642,
						"column": 9
					}
				},
				"quantSkillsSessions/factorCheckUpdate": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorCheckUpdate_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"inspection": {
									"type": "object",
									"properties": {
										"identity": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" },
										"balance": { "type": "number" },
										"registration": {},
										"pool": {}
									},
									"required": [
										"identity",
										"fetchedAt",
										"balance",
										"registration",
										"pool"
									],
									"additionalProperties": true
								},
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"action": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "create-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style",
														"cycle"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "update-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "add-factor"
														},
														"workflowId": { "type": "string" }
													},
													"required": ["kind", "workflowId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "replace-factor"
														},
														"factorId": { "type": "string" },
														"workflowId": { "type": "string" }
													},
													"required": [
														"kind",
														"factorId",
														"workflowId"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "remove-factor"
														},
														"factorId": { "type": "string" }
													},
													"required": ["kind", "factorId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "submit-pool"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "budget"
														},
														"batch": {
															"type": "object",
															"properties": {
																"hypothesis": { "type": "string" },
																"maxRuns": { "type": "number" },
																"creditThreshold": { "type": "number" },
																"startDate": { "type": "string" },
																"endDate": { "type": "string" },
																"cycle": { "type": "number" }
															},
															"required": [
																"hypothesis",
																"maxRuns",
																"creditThreshold",
																"startDate",
																"endDate",
																"cycle"
															],
															"additionalProperties": true
														}
													},
													"required": ["kind", "batch"],
													"additionalProperties": true
												}
											] },
											"summary": { "type": "string" },
											"snapshot": {},
											"snapshotHash": { "type": "string" },
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"action",
											"summary",
											"snapshot",
											"snapshotHash",
											"createdAt",
											"expiresAt",
											"status"
										],
										"additionalProperties": true
									}
								},
								"budgets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"runsUsed": { "type": "number" },
											"creditsUsed": { "type": "number" },
											"baseline": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"unknown",
													"active",
													"stopped",
													"exhausted"
												]
											},
											"hypothesis": { "type": "string" },
											"maxRuns": { "type": "number" },
											"creditThreshold": { "type": "number" },
											"startDate": { "type": "string" },
											"endDate": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"runsUsed",
											"creditsUsed",
											"baseline",
											"status",
											"hypothesis",
											"maxRuns",
											"creditThreshold",
											"startDate",
											"endDate",
											"cycle"
										],
										"additionalProperties": true
									}
								},
								"runs": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"budgetId": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"candidate": {
												"type": "object",
												"properties": {
													"requestId": { "type": "string" },
													"name": { "type": "string" },
													"formula": { "type": "string" },
													"code": { "type": "string" },
													"direction": {
														"type": "number",
														"enum": [0, 1]
													}
												},
												"required": [
													"requestId",
													"name",
													"direction"
												],
												"additionalProperties": true
											},
											"workflowId": { "type": "string" },
											"runId": { "type": "string" },
											"createdAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"completed",
													"unknown",
													"creating",
													"running"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"budgetId",
											"sessionId",
											"identity",
											"candidate",
											"createdAt",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans",
								"budgets",
								"runs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1232,
						"column": 3
					}
				},
				"quantSkillsSessions/factorConfirm": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConfirm:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConfirm:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorPlan",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConfirm_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"sessionId": { "type": "string" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"action": { "oneOf": [
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "create-pool"
											},
											"name": { "type": "string" },
											"style": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"kind",
											"name",
											"style",
											"cycle"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "update-pool"
											},
											"name": { "type": "string" },
											"style": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"kind",
											"name",
											"style"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "add-factor"
											},
											"workflowId": { "type": "string" }
										},
										"required": ["kind", "workflowId"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "replace-factor"
											},
											"factorId": { "type": "string" },
											"workflowId": { "type": "string" }
										},
										"required": [
											"kind",
											"factorId",
											"workflowId"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "remove-factor"
											},
											"factorId": { "type": "string" }
										},
										"required": ["kind", "factorId"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "submit-pool"
										} },
										"required": ["kind"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "budget"
											},
											"batch": {
												"type": "object",
												"properties": {
													"hypothesis": { "type": "string" },
													"maxRuns": { "type": "number" },
													"creditThreshold": { "type": "number" },
													"startDate": { "type": "string" },
													"endDate": { "type": "string" },
													"cycle": { "type": "number" }
												},
												"required": [
													"hypothesis",
													"maxRuns",
													"creditThreshold",
													"startDate",
													"endDate",
													"cycle"
												],
												"additionalProperties": true
											}
										},
										"required": ["kind", "batch"],
										"additionalProperties": true
									}
								] },
								"summary": { "type": "string" },
								"snapshot": {},
								"snapshotHash": { "type": "string" },
								"createdAt": { "type": "number" },
								"expiresAt": { "type": "number" },
								"status": {
									"type": "string",
									"enum": [
										"failed",
										"prepared",
										"executing",
										"completed",
										"unknown",
										"cancelled",
										"expired"
									]
								},
								"result": {}
							},
							"required": [
								"id",
								"sessionId",
								"identity",
								"action",
								"summary",
								"snapshot",
								"snapshotHash",
								"createdAt",
								"expiresAt",
								"status"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1260,
						"column": 3
					}
				},
				"quantSkillsSessions/factorConnect": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConnect:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "credentials": {
									"type": "object",
									"properties": {
										"phone": { "type": "string" },
										"password": { "type": "string" }
									},
									"required": ["phone", "password"],
									"additionalProperties": true
								} },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorConnect:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "credentials": {
									"type": "object",
									"properties": {
										"phone": { "type": "string" },
										"password": { "type": "string" }
									},
									"required": ["phone", "password"],
									"additionalProperties": false
								} },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorConnect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"inspection": {
									"type": "object",
									"properties": {
										"identity": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" },
										"balance": { "type": "number" },
										"registration": {},
										"pool": {}
									},
									"required": [
										"identity",
										"fetchedAt",
										"balance",
										"registration",
										"pool"
									],
									"additionalProperties": true
								},
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"action": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "create-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style",
														"cycle"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "update-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "add-factor"
														},
														"workflowId": { "type": "string" }
													},
													"required": ["kind", "workflowId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "replace-factor"
														},
														"factorId": { "type": "string" },
														"workflowId": { "type": "string" }
													},
													"required": [
														"kind",
														"factorId",
														"workflowId"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "remove-factor"
														},
														"factorId": { "type": "string" }
													},
													"required": ["kind", "factorId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "submit-pool"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "budget"
														},
														"batch": {
															"type": "object",
															"properties": {
																"hypothesis": { "type": "string" },
																"maxRuns": { "type": "number" },
																"creditThreshold": { "type": "number" },
																"startDate": { "type": "string" },
																"endDate": { "type": "string" },
																"cycle": { "type": "number" }
															},
															"required": [
																"hypothesis",
																"maxRuns",
																"creditThreshold",
																"startDate",
																"endDate",
																"cycle"
															],
															"additionalProperties": true
														}
													},
													"required": ["kind", "batch"],
													"additionalProperties": true
												}
											] },
											"summary": { "type": "string" },
											"snapshot": {},
											"snapshotHash": { "type": "string" },
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"action",
											"summary",
											"snapshot",
											"snapshotHash",
											"createdAt",
											"expiresAt",
											"status"
										],
										"additionalProperties": true
									}
								},
								"budgets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"runsUsed": { "type": "number" },
											"creditsUsed": { "type": "number" },
											"baseline": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"unknown",
													"active",
													"stopped",
													"exhausted"
												]
											},
											"hypothesis": { "type": "string" },
											"maxRuns": { "type": "number" },
											"creditThreshold": { "type": "number" },
											"startDate": { "type": "string" },
											"endDate": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"runsUsed",
											"creditsUsed",
											"baseline",
											"status",
											"hypothesis",
											"maxRuns",
											"creditThreshold",
											"startDate",
											"endDate",
											"cycle"
										],
										"additionalProperties": true
									}
								},
								"runs": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"budgetId": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"candidate": {
												"type": "object",
												"properties": {
													"requestId": { "type": "string" },
													"name": { "type": "string" },
													"formula": { "type": "string" },
													"code": { "type": "string" },
													"direction": {
														"type": "number",
														"enum": [0, 1]
													}
												},
												"required": [
													"requestId",
													"name",
													"direction"
												],
												"additionalProperties": true
											},
											"workflowId": { "type": "string" },
											"runId": { "type": "string" },
											"createdAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"completed",
													"unknown",
													"creating",
													"running"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"budgetId",
											"sessionId",
											"identity",
											"candidate",
											"createdAt",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans",
								"budgets",
								"runs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1226,
						"column": 3
					}
				},
				"quantSkillsSessions/factorDisconnect": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDisconnect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"inspection": {
									"type": "object",
									"properties": {
										"identity": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" },
										"balance": { "type": "number" },
										"registration": {},
										"pool": {}
									},
									"required": [
										"identity",
										"fetchedAt",
										"balance",
										"registration",
										"pool"
									],
									"additionalProperties": true
								},
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"action": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "create-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style",
														"cycle"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "update-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "add-factor"
														},
														"workflowId": { "type": "string" }
													},
													"required": ["kind", "workflowId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "replace-factor"
														},
														"factorId": { "type": "string" },
														"workflowId": { "type": "string" }
													},
													"required": [
														"kind",
														"factorId",
														"workflowId"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "remove-factor"
														},
														"factorId": { "type": "string" }
													},
													"required": ["kind", "factorId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "submit-pool"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "budget"
														},
														"batch": {
															"type": "object",
															"properties": {
																"hypothesis": { "type": "string" },
																"maxRuns": { "type": "number" },
																"creditThreshold": { "type": "number" },
																"startDate": { "type": "string" },
																"endDate": { "type": "string" },
																"cycle": { "type": "number" }
															},
															"required": [
																"hypothesis",
																"maxRuns",
																"creditThreshold",
																"startDate",
																"endDate",
																"cycle"
															],
															"additionalProperties": true
														}
													},
													"required": ["kind", "batch"],
													"additionalProperties": true
												}
											] },
											"summary": { "type": "string" },
											"snapshot": {},
											"snapshotHash": { "type": "string" },
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"action",
											"summary",
											"snapshot",
											"snapshotHash",
											"createdAt",
											"expiresAt",
											"status"
										],
										"additionalProperties": true
									}
								},
								"budgets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"runsUsed": { "type": "number" },
											"creditsUsed": { "type": "number" },
											"baseline": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"unknown",
													"active",
													"stopped",
													"exhausted"
												]
											},
											"hypothesis": { "type": "string" },
											"maxRuns": { "type": "number" },
											"creditThreshold": { "type": "number" },
											"startDate": { "type": "string" },
											"endDate": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"runsUsed",
											"creditsUsed",
											"baseline",
											"status",
											"hypothesis",
											"maxRuns",
											"creditThreshold",
											"startDate",
											"endDate",
											"cycle"
										],
										"additionalProperties": true
									}
								},
								"runs": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"budgetId": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"candidate": {
												"type": "object",
												"properties": {
													"requestId": { "type": "string" },
													"name": { "type": "string" },
													"formula": { "type": "string" },
													"code": { "type": "string" },
													"direction": {
														"type": "number",
														"enum": [0, 1]
													}
												},
												"required": [
													"requestId",
													"name",
													"direction"
												],
												"additionalProperties": true
											},
											"workflowId": { "type": "string" },
											"runId": { "type": "string" },
											"createdAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"completed",
													"unknown",
													"creating",
													"running"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"budgetId",
											"sessionId",
											"identity",
											"candidate",
											"createdAt",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans",
								"budgets",
								"runs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1229,
						"column": 3
					}
				},
				"quantSkillsSessions/factorDismiss": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDismiss:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDismiss:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"planId": { "type": "string" },
									"sessionId": { "type": "string" }
								},
								"required": ["planId", "sessionId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorDismiss:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorDismiss_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1263,
						"column": 3
					}
				},
				"quantSkillsSessions/factorInspect": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorInspect:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorInspect:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorInspection",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorInspect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"fetchedAt": { "type": "number" },
								"balance": { "type": "number" },
								"registration": {},
								"pool": {}
							},
							"required": [
								"identity",
								"fetchedAt",
								"balance",
								"registration",
								"pool"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1238,
						"column": 9
					}
				},
				"quantSkillsSessions/factorMode": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorMode:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "enabled": { "type": "boolean" } },
								"required": ["enabled"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorMode:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "enabled": { "type": "boolean" } },
								"required": ["enabled"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorMode_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"inspection": {
									"type": "object",
									"properties": {
										"identity": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" },
										"balance": { "type": "number" },
										"registration": {},
										"pool": {}
									},
									"required": [
										"identity",
										"fetchedAt",
										"balance",
										"registration",
										"pool"
									],
									"additionalProperties": true
								},
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"action": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "create-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style",
														"cycle"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "update-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "add-factor"
														},
														"workflowId": { "type": "string" }
													},
													"required": ["kind", "workflowId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "replace-factor"
														},
														"factorId": { "type": "string" },
														"workflowId": { "type": "string" }
													},
													"required": [
														"kind",
														"factorId",
														"workflowId"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "remove-factor"
														},
														"factorId": { "type": "string" }
													},
													"required": ["kind", "factorId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "submit-pool"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "budget"
														},
														"batch": {
															"type": "object",
															"properties": {
																"hypothesis": { "type": "string" },
																"maxRuns": { "type": "number" },
																"creditThreshold": { "type": "number" },
																"startDate": { "type": "string" },
																"endDate": { "type": "string" },
																"cycle": { "type": "number" }
															},
															"required": [
																"hypothesis",
																"maxRuns",
																"creditThreshold",
																"startDate",
																"endDate",
																"cycle"
															],
															"additionalProperties": true
														}
													},
													"required": ["kind", "batch"],
													"additionalProperties": true
												}
											] },
											"summary": { "type": "string" },
											"snapshot": {},
											"snapshotHash": { "type": "string" },
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"action",
											"summary",
											"snapshot",
											"snapshotHash",
											"createdAt",
											"expiresAt",
											"status"
										],
										"additionalProperties": true
									}
								},
								"budgets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"runsUsed": { "type": "number" },
											"creditsUsed": { "type": "number" },
											"baseline": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"unknown",
													"active",
													"stopped",
													"exhausted"
												]
											},
											"hypothesis": { "type": "string" },
											"maxRuns": { "type": "number" },
											"creditThreshold": { "type": "number" },
											"startDate": { "type": "string" },
											"endDate": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"runsUsed",
											"creditsUsed",
											"baseline",
											"status",
											"hypothesis",
											"maxRuns",
											"creditThreshold",
											"startDate",
											"endDate",
											"cycle"
										],
										"additionalProperties": true
									}
								},
								"runs": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"budgetId": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"candidate": {
												"type": "object",
												"properties": {
													"requestId": { "type": "string" },
													"name": { "type": "string" },
													"formula": { "type": "string" },
													"code": { "type": "string" },
													"direction": {
														"type": "number",
														"enum": [0, 1]
													}
												},
												"required": [
													"requestId",
													"name",
													"direction"
												],
												"additionalProperties": true
											},
											"workflowId": { "type": "string" },
											"runId": { "type": "string" },
											"createdAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"completed",
													"unknown",
													"creating",
													"running"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"budgetId",
											"sessionId",
											"identity",
											"candidate",
											"createdAt",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans",
								"budgets",
								"runs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1223,
						"column": 3
					}
				},
				"quantSkillsSessions/factorPrepare": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorPrepare:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"action": { "oneOf": [
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "create-pool"
												},
												"name": { "type": "string" },
												"style": { "type": "string" },
												"cycle": { "type": "number" }
											},
											"required": [
												"kind",
												"name",
												"style",
												"cycle"
											],
											"additionalProperties": true
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "update-pool"
												},
												"name": { "type": "string" },
												"style": { "type": "string" },
												"cycle": { "type": "number" }
											},
											"required": [
												"kind",
												"name",
												"style"
											],
											"additionalProperties": true
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "add-factor"
												},
												"workflowId": { "type": "string" }
											},
											"required": ["kind", "workflowId"],
											"additionalProperties": true
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "replace-factor"
												},
												"factorId": { "type": "string" },
												"workflowId": { "type": "string" }
											},
											"required": [
												"kind",
												"factorId",
												"workflowId"
											],
											"additionalProperties": true
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "remove-factor"
												},
												"factorId": { "type": "string" }
											},
											"required": ["kind", "factorId"],
											"additionalProperties": true
										},
										{
											"type": "object",
											"properties": { "kind": {
												"type": "string",
												"const": "submit-pool"
											} },
											"required": ["kind"],
											"additionalProperties": true
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "budget"
												},
												"batch": {
													"type": "object",
													"properties": {
														"hypothesis": { "type": "string" },
														"maxRuns": { "type": "number" },
														"creditThreshold": { "type": "number" },
														"startDate": { "type": "string" },
														"endDate": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"hypothesis",
														"maxRuns",
														"creditThreshold",
														"startDate",
														"endDate",
														"cycle"
													],
													"additionalProperties": true
												}
											},
											"required": ["kind", "batch"],
											"additionalProperties": true
										}
									] },
									"sessionId": { "type": "string" }
								},
								"required": ["action"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorPrepare:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"action": { "oneOf": [
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "create-pool"
												},
												"name": { "type": "string" },
												"style": { "type": "string" },
												"cycle": { "type": "number" }
											},
											"required": [
												"kind",
												"name",
												"style",
												"cycle"
											],
											"additionalProperties": false
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "update-pool"
												},
												"name": { "type": "string" },
												"style": { "type": "string" },
												"cycle": { "type": "number" }
											},
											"required": [
												"kind",
												"name",
												"style"
											],
											"additionalProperties": false
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "add-factor"
												},
												"workflowId": { "type": "string" }
											},
											"required": ["kind", "workflowId"],
											"additionalProperties": false
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "replace-factor"
												},
												"factorId": { "type": "string" },
												"workflowId": { "type": "string" }
											},
											"required": [
												"kind",
												"factorId",
												"workflowId"
											],
											"additionalProperties": false
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "remove-factor"
												},
												"factorId": { "type": "string" }
											},
											"required": ["kind", "factorId"],
											"additionalProperties": false
										},
										{
											"type": "object",
											"properties": { "kind": {
												"type": "string",
												"const": "submit-pool"
											} },
											"required": ["kind"],
											"additionalProperties": false
										},
										{
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"const": "budget"
												},
												"batch": {
													"type": "object",
													"properties": {
														"hypothesis": { "type": "string" },
														"maxRuns": { "type": "number" },
														"creditThreshold": { "type": "number" },
														"startDate": { "type": "string" },
														"endDate": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"hypothesis",
														"maxRuns",
														"creditThreshold",
														"startDate",
														"endDate",
														"cycle"
													],
													"additionalProperties": false
												}
											},
											"required": ["kind", "batch"],
											"additionalProperties": false
										}
									] },
									"sessionId": { "type": "string" }
								},
								"required": ["action"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorPlan",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorPrepare_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"sessionId": { "type": "string" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"action": { "oneOf": [
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "create-pool"
											},
											"name": { "type": "string" },
											"style": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"kind",
											"name",
											"style",
											"cycle"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "update-pool"
											},
											"name": { "type": "string" },
											"style": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"kind",
											"name",
											"style"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "add-factor"
											},
											"workflowId": { "type": "string" }
										},
										"required": ["kind", "workflowId"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "replace-factor"
											},
											"factorId": { "type": "string" },
											"workflowId": { "type": "string" }
										},
										"required": [
											"kind",
											"factorId",
											"workflowId"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "remove-factor"
											},
											"factorId": { "type": "string" }
										},
										"required": ["kind", "factorId"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "submit-pool"
										} },
										"required": ["kind"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "budget"
											},
											"batch": {
												"type": "object",
												"properties": {
													"hypothesis": { "type": "string" },
													"maxRuns": { "type": "number" },
													"creditThreshold": { "type": "number" },
													"startDate": { "type": "string" },
													"endDate": { "type": "string" },
													"cycle": { "type": "number" }
												},
												"required": [
													"hypothesis",
													"maxRuns",
													"creditThreshold",
													"startDate",
													"endDate",
													"cycle"
												],
												"additionalProperties": true
											}
										},
										"required": ["kind", "batch"],
										"additionalProperties": true
									}
								] },
								"summary": { "type": "string" },
								"snapshot": {},
								"snapshotHash": { "type": "string" },
								"createdAt": { "type": "number" },
								"expiresAt": { "type": "number" },
								"status": {
									"type": "string",
									"enum": [
										"failed",
										"prepared",
										"executing",
										"completed",
										"unknown",
										"cancelled",
										"expired"
									]
								},
								"result": {}
							},
							"required": [
								"id",
								"sessionId",
								"identity",
								"action",
								"summary",
								"snapshot",
								"snapshotHash",
								"createdAt",
								"expiresAt",
								"status"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1254,
						"column": 9
					}
				},
				"quantSkillsSessions/factorQuery": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorQuery",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"enum": [
											"pool",
											"workflows",
											"scores",
											"factor-info",
											"factor-result",
											"factors"
										]
									},
									"id": { "type": "string" },
									"page": { "type": "number" }
								},
								"required": ["kind"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorQuery",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"enum": [
											"pool",
											"workflows",
											"scores",
											"factor-info",
											"factor-result",
											"factors"
										]
									},
									"id": { "type": "string" },
									"page": { "type": "number" }
								},
								"required": ["kind"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-util-values#JsonValue",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorQuery_result$schema,
						jsonSchema: {}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1251,
						"column": 9
					}
				},
				"quantSkillsSessions/factorReconcilePlan": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcilePlan:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "planId": { "type": "string" } },
								"required": ["planId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcilePlan:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "planId": { "type": "string" } },
								"required": ["planId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorPlan",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcilePlan_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"sessionId": { "type": "string" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"action": { "oneOf": [
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "create-pool"
											},
											"name": { "type": "string" },
											"style": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"kind",
											"name",
											"style",
											"cycle"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "update-pool"
											},
											"name": { "type": "string" },
											"style": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"kind",
											"name",
											"style"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "add-factor"
											},
											"workflowId": { "type": "string" }
										},
										"required": ["kind", "workflowId"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "replace-factor"
											},
											"factorId": { "type": "string" },
											"workflowId": { "type": "string" }
										},
										"required": [
											"kind",
											"factorId",
											"workflowId"
										],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "remove-factor"
											},
											"factorId": { "type": "string" }
										},
										"required": ["kind", "factorId"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "submit-pool"
										} },
										"required": ["kind"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "budget"
											},
											"batch": {
												"type": "object",
												"properties": {
													"hypothesis": { "type": "string" },
													"maxRuns": { "type": "number" },
													"creditThreshold": { "type": "number" },
													"startDate": { "type": "string" },
													"endDate": { "type": "string" },
													"cycle": { "type": "number" }
												},
												"required": [
													"hypothesis",
													"maxRuns",
													"creditThreshold",
													"startDate",
													"endDate",
													"cycle"
												],
												"additionalProperties": true
											}
										},
										"required": ["kind", "batch"],
										"additionalProperties": true
									}
								] },
								"summary": { "type": "string" },
								"snapshot": {},
								"snapshotHash": { "type": "string" },
								"createdAt": { "type": "number" },
								"expiresAt": { "type": "number" },
								"status": {
									"type": "string",
									"enum": [
										"failed",
										"prepared",
										"executing",
										"completed",
										"unknown",
										"cancelled",
										"expired"
									]
								},
								"result": {}
							},
							"required": [
								"id",
								"sessionId",
								"identity",
								"action",
								"summary",
								"snapshot",
								"snapshotHash",
								"createdAt",
								"expiresAt",
								"status"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1272,
						"column": 3
					}
				},
				"quantSkillsSessions/factorReconcileRun": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcileRun:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "runId": { "type": "string" } },
								"required": ["runId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorReconcileRun:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "runId": { "type": "string" } },
								"required": ["runId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorRun",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorReconcileRun_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"budgetId": { "type": "string" },
								"sessionId": { "type": "string" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"candidate": {
									"type": "object",
									"properties": {
										"requestId": { "type": "string" },
										"name": { "type": "string" },
										"formula": { "type": "string" },
										"code": { "type": "string" },
										"direction": {
											"type": "number",
											"enum": [0, 1]
										}
									},
									"required": [
										"requestId",
										"name",
										"direction"
									],
									"additionalProperties": true
								},
								"workflowId": { "type": "string" },
								"runId": { "type": "string" },
								"createdAt": { "type": "number" },
								"status": {
									"type": "string",
									"enum": [
										"failed",
										"completed",
										"unknown",
										"creating",
										"running"
									]
								},
								"result": {}
							},
							"required": [
								"id",
								"budgetId",
								"sessionId",
								"identity",
								"candidate",
								"createdAt",
								"status"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1269,
						"column": 3
					}
				},
				"quantSkillsSessions/factorSessionOpen": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"topic": { "type": "boolean" }
								},
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"topic": { "type": "boolean" }
								},
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ContestSessionOpenResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorSessionOpen_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"binding": {
									"type": "object",
									"properties": {
										"purpose": {
											"type": "string",
											"enum": [
												"ordinary",
												"role-helper",
												"contest",
												"factor-contest"
											]
										},
										"contest": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"factorContest": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"contestConversation": {
											"type": "string",
											"enum": ["main", "topic"]
										}
									},
									"required": ["purpose"],
									"additionalProperties": true
								},
								"created": { "type": "boolean" }
							},
							"required": [
								"sessionId",
								"binding",
								"created"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1275,
						"column": 3
					}
				},
				"quantSkillsSessions/factorStatus": {
					service: "quantSkillsSessions",
					description: "Read local contest status without starting processes or opening a browser.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStatus:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStatus:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStatus_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"inspection": {
									"type": "object",
									"properties": {
										"identity": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" },
										"balance": { "type": "number" },
										"registration": {},
										"pool": {}
									},
									"required": [
										"identity",
										"fetchedAt",
										"balance",
										"registration",
										"pool"
									],
									"additionalProperties": true
								},
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"action": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "create-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style",
														"cycle"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "update-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "add-factor"
														},
														"workflowId": { "type": "string" }
													},
													"required": ["kind", "workflowId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "replace-factor"
														},
														"factorId": { "type": "string" },
														"workflowId": { "type": "string" }
													},
													"required": [
														"kind",
														"factorId",
														"workflowId"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "remove-factor"
														},
														"factorId": { "type": "string" }
													},
													"required": ["kind", "factorId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "submit-pool"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "budget"
														},
														"batch": {
															"type": "object",
															"properties": {
																"hypothesis": { "type": "string" },
																"maxRuns": { "type": "number" },
																"creditThreshold": { "type": "number" },
																"startDate": { "type": "string" },
																"endDate": { "type": "string" },
																"cycle": { "type": "number" }
															},
															"required": [
																"hypothesis",
																"maxRuns",
																"creditThreshold",
																"startDate",
																"endDate",
																"cycle"
															],
															"additionalProperties": true
														}
													},
													"required": ["kind", "batch"],
													"additionalProperties": true
												}
											] },
											"summary": { "type": "string" },
											"snapshot": {},
											"snapshotHash": { "type": "string" },
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"action",
											"summary",
											"snapshot",
											"snapshotHash",
											"createdAt",
											"expiresAt",
											"status"
										],
										"additionalProperties": true
									}
								},
								"budgets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"runsUsed": { "type": "number" },
											"creditsUsed": { "type": "number" },
											"baseline": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"unknown",
													"active",
													"stopped",
													"exhausted"
												]
											},
											"hypothesis": { "type": "string" },
											"maxRuns": { "type": "number" },
											"creditThreshold": { "type": "number" },
											"startDate": { "type": "string" },
											"endDate": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"runsUsed",
											"creditsUsed",
											"baseline",
											"status",
											"hypothesis",
											"maxRuns",
											"creditThreshold",
											"startDate",
											"endDate",
											"cycle"
										],
										"additionalProperties": true
									}
								},
								"runs": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"budgetId": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"candidate": {
												"type": "object",
												"properties": {
													"requestId": { "type": "string" },
													"name": { "type": "string" },
													"formula": { "type": "string" },
													"code": { "type": "string" },
													"direction": {
														"type": "number",
														"enum": [0, 1]
													}
												},
												"required": [
													"requestId",
													"name",
													"direction"
												],
												"additionalProperties": true
											},
											"workflowId": { "type": "string" },
											"runId": { "type": "string" },
											"createdAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"completed",
													"unknown",
													"creating",
													"running"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"budgetId",
											"sessionId",
											"identity",
											"candidate",
											"createdAt",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans",
								"budgets",
								"runs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1220,
						"column": 3
					}
				},
				"quantSkillsSessions/factorStopBudget": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStopBudget:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "budgetId": { "type": "string" } },
								"required": ["budgetId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStopBudget:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "budgetId": { "type": "string" } },
								"required": ["budgetId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/factorStopBudget:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorStopBudget_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1266,
						"column": 3
					}
				},
				"quantSkillsSessions/factorUpdate": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FactorContestStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_factorUpdate_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"enabled": { "type": "boolean" },
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"connected",
										"error",
										"installing",
										"off"
									]
								},
								"cliVersion": { "type": "string" },
								"latestVersion": { "type": "string" },
								"updateAvailable": { "type": "boolean" },
								"identity": {
									"type": "object",
									"properties": {
										"accountId": { "type": "string" },
										"contestId": { "type": "string" }
									},
									"required": ["accountId", "contestId"],
									"additionalProperties": true
								},
								"message": { "type": "string" },
								"inspection": {
									"type": "object",
									"properties": {
										"identity": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"fetchedAt": { "type": "number" },
										"balance": { "type": "number" },
										"registration": {},
										"pool": {}
									},
									"required": [
										"identity",
										"fetchedAt",
										"balance",
										"registration",
										"pool"
									],
									"additionalProperties": true
								},
								"plans": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"action": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "create-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style",
														"cycle"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "update-pool"
														},
														"name": { "type": "string" },
														"style": { "type": "string" },
														"cycle": { "type": "number" }
													},
													"required": [
														"kind",
														"name",
														"style"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "add-factor"
														},
														"workflowId": { "type": "string" }
													},
													"required": ["kind", "workflowId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "replace-factor"
														},
														"factorId": { "type": "string" },
														"workflowId": { "type": "string" }
													},
													"required": [
														"kind",
														"factorId",
														"workflowId"
													],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "remove-factor"
														},
														"factorId": { "type": "string" }
													},
													"required": ["kind", "factorId"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "submit-pool"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "budget"
														},
														"batch": {
															"type": "object",
															"properties": {
																"hypothesis": { "type": "string" },
																"maxRuns": { "type": "number" },
																"creditThreshold": { "type": "number" },
																"startDate": { "type": "string" },
																"endDate": { "type": "string" },
																"cycle": { "type": "number" }
															},
															"required": [
																"hypothesis",
																"maxRuns",
																"creditThreshold",
																"startDate",
																"endDate",
																"cycle"
															],
															"additionalProperties": true
														}
													},
													"required": ["kind", "batch"],
													"additionalProperties": true
												}
											] },
											"summary": { "type": "string" },
											"snapshot": {},
											"snapshotHash": { "type": "string" },
											"createdAt": { "type": "number" },
											"expiresAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"prepared",
													"executing",
													"completed",
													"unknown",
													"cancelled",
													"expired"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"action",
											"summary",
											"snapshot",
											"snapshotHash",
											"createdAt",
											"expiresAt",
											"status"
										],
										"additionalProperties": true
									}
								},
								"budgets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"runsUsed": { "type": "number" },
											"creditsUsed": { "type": "number" },
											"baseline": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"unknown",
													"active",
													"stopped",
													"exhausted"
												]
											},
											"hypothesis": { "type": "string" },
											"maxRuns": { "type": "number" },
											"creditThreshold": { "type": "number" },
											"startDate": { "type": "string" },
											"endDate": { "type": "string" },
											"cycle": { "type": "number" }
										},
										"required": [
											"id",
											"sessionId",
											"identity",
											"runsUsed",
											"creditsUsed",
											"baseline",
											"status",
											"hypothesis",
											"maxRuns",
											"creditThreshold",
											"startDate",
											"endDate",
											"cycle"
										],
										"additionalProperties": true
									}
								},
								"runs": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"budgetId": { "type": "string" },
											"sessionId": { "type": "string" },
											"identity": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"candidate": {
												"type": "object",
												"properties": {
													"requestId": { "type": "string" },
													"name": { "type": "string" },
													"formula": { "type": "string" },
													"code": { "type": "string" },
													"direction": {
														"type": "number",
														"enum": [0, 1]
													}
												},
												"required": [
													"requestId",
													"name",
													"direction"
												],
												"additionalProperties": true
											},
											"workflowId": { "type": "string" },
											"runId": { "type": "string" },
											"createdAt": { "type": "number" },
											"status": {
												"type": "string",
												"enum": [
													"failed",
													"completed",
													"unknown",
													"creating",
													"running"
												]
											},
											"result": {}
										},
										"required": [
											"id",
											"budgetId",
											"sessionId",
											"identity",
											"candidate",
											"createdAt",
											"status"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"enabled",
								"phase",
								"updateAvailable",
								"message",
								"plans",
								"budgets",
								"runs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1235,
						"column": 3
					}
				},
				"quantSkillsSessions/fileAttach": {
					service: "quantSkillsSessions",
					description: "Attach one immutable generic file to a live QuantSkills Session. Per-Session serialization makes the aggregate byte check authoritative even when browser uploads overlap.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session identity, canonical base64 bytes, and display metadata.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileAttachRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"data": { "type": "string" },
									"mediaType": { "type": "string" },
									"name": { "type": "string" }
								},
								"required": [
									"sessionId",
									"data",
									"mediaType",
									"name"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileAttachRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"data": { "type": "string" },
									"mediaType": { "type": "string" },
									"name": { "type": "string" }
								},
								"required": [
									"sessionId",
									"data",
									"mediaType",
									"name"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionFileAttachment",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileAttach_result$schema,
						description: "the durable ownership record appended to the Session log.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"file": {
									"type": "object",
									"properties": {
										"attachmentId": { "type": "string" },
										"mediaType": { "type": "string" },
										"bytes": { "type": "number" },
										"name": { "type": "string" }
									},
									"required": [
										"attachmentId",
										"mediaType",
										"bytes",
										"name"
									],
									"additionalProperties": true
								},
								"parsing": { "oneOf": [
									{
										"type": "object",
										"properties": {
											"status": {
												"type": "string",
												"const": "ready"
											},
											"kind": {
												"type": "string",
												"const": "utf8-text"
											}
										},
										"required": ["status", "kind"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"status": {
												"type": "string",
												"const": "ready"
											},
											"kind": {
												"type": "string",
												"enum": [
													"pdf",
													"office-document",
													"spreadsheet"
												]
											}
										},
										"required": ["status", "kind"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"status": {
												"type": "string",
												"const": "unsupported"
											},
											"reason": { "type": "string" }
										},
										"required": ["status", "reason"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"status": {
												"type": "string",
												"const": "failed"
											},
											"reason": { "type": "string" }
										},
										"required": ["status", "reason"],
										"additionalProperties": true
									}
								] },
								"attachedAt": { "type": "number" }
							},
							"required": [
								"file",
								"parsing",
								"attachedAt"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2446,
						"column": 9
					}
				},
				"quantSkillsSessions/fileList": {
					service: "quantSkillsSessions",
					description: "List immutable generic files already owned by one QuantSkills Session.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileListResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileList_result$schema,
						description: "durable file records plus Host-enforced limits.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"files": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"file": {
												"type": "object",
												"properties": {
													"attachmentId": { "type": "string" },
													"mediaType": { "type": "string" },
													"bytes": { "type": "number" },
													"name": { "type": "string" }
												},
												"required": [
													"attachmentId",
													"mediaType",
													"bytes",
													"name"
												],
												"additionalProperties": true
											},
											"parsing": { "oneOf": [
												{
													"type": "object",
													"properties": {
														"status": {
															"type": "string",
															"const": "ready"
														},
														"kind": {
															"type": "string",
															"const": "utf8-text"
														}
													},
													"required": ["status", "kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"status": {
															"type": "string",
															"const": "ready"
														},
														"kind": {
															"type": "string",
															"enum": [
																"pdf",
																"office-document",
																"spreadsheet"
															]
														}
													},
													"required": ["status", "kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"status": {
															"type": "string",
															"const": "unsupported"
														},
														"reason": { "type": "string" }
													},
													"required": ["status", "reason"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"status": {
															"type": "string",
															"const": "failed"
														},
														"reason": { "type": "string" }
													},
													"required": ["status", "reason"],
													"additionalProperties": true
												}
											] },
											"attachedAt": { "type": "number" }
										},
										"required": [
											"file",
											"parsing",
											"attachedAt"
										],
										"additionalProperties": true
									}
								},
								"limits": {
									"type": "object",
									"properties": {
										"maxFileBytes": { "type": "number" },
										"maxSessionFileBytes": { "type": "number" }
									},
									"required": ["maxFileBytes", "maxSessionFileBytes"],
									"additionalProperties": true
								}
							},
							"required": ["files", "limits"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2480,
						"column": 9
					}
				},
				"quantSkillsSessions/fileRead": {
					service: "quantSkillsSessions",
					description: "Read bounded text extracted from a supported attachment owned by a QuantSkills Session.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session identity and opaque attachment id.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileReadRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"attachmentId": { "type": "string" }
								},
								"required": ["sessionId", "attachmentId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileReadRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"attachmentId": { "type": "string" }
								},
								"required": ["sessionId", "attachmentId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFileReadResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_fileRead_result$schema,
						description: "verified metadata and decoded text.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"file": {
									"type": "object",
									"properties": {
										"attachmentId": { "type": "string" },
										"mediaType": { "type": "string" },
										"bytes": { "type": "number" },
										"name": { "type": "string" }
									},
									"required": [
										"attachmentId",
										"mediaType",
										"bytes",
										"name"
									],
									"additionalProperties": true
								},
								"text": { "type": "string" },
								"truncated": { "type": "boolean" }
							},
							"required": [
								"file",
								"text",
								"truncated"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2498,
						"column": 9
					}
				},
				"quantSkillsSessions/flyInstall": {
					service: "quantSkillsSessions",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						acceptsUndefined: true,
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/flyInstall:input",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"blenderPath": { "type": "string" },
									"neural": { "type": "boolean" }
								},
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/flyInstall:input",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"blenderPath": { "type": "string" },
									"neural": { "type": "boolean" }
								},
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FlyRuntimeStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyInstall_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"supported": { "type": "boolean" },
								"installed": { "type": "boolean" },
								"running": { "type": "boolean" },
								"installing": { "type": "boolean" },
								"message": { "type": "string" }
							},
							"required": [
								"supported",
								"installed",
								"running",
								"installing",
								"message"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1212,
						"column": 3
					}
				},
				"quantSkillsSessions/flyRequest": {
					service: "quantSkillsSessions",
					description: "Only the fixed fly controller routes are forwarded; execution stays in contestExecute.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FlyRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"path": { "type": "string" },
									"body": {}
								},
								"required": ["path"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FlyRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"path": { "type": "string" },
									"body": {}
								},
								"required": ["path"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-util-values#JsonValue",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyRequest_result$schema,
						jsonSchema: {}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1216,
						"column": 3
					}
				},
				"quantSkillsSessions/flyStatus": {
					service: "quantSkillsSessions",
					description: "Inspect the opt-in local fly controller without installing dependencies.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#FlyRuntimeStatus",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_flyStatus_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"supported": { "type": "boolean" },
								"installed": { "type": "boolean" },
								"running": { "type": "boolean" },
								"installing": { "type": "boolean" },
								"message": { "type": "string" }
							},
							"required": [
								"supported",
								"installed",
								"running",
								"installing",
								"message"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1209,
						"column": 3
					}
				},
				"quantSkillsSessions/frequent": {
					service: "quantSkillsSessions",
					description: "Aggregate frequently used Skills from real bound conversation archives.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "archive visibility and bounded result count.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFrequentRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"limit": { "type": "number" },
									"includeArchived": { "type": "boolean" }
								},
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsFrequentRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"limit": { "type": "number" },
									"includeArchived": { "type": "boolean" }
								},
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/frequent:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_frequent_result$schema,
						description: "usage rows ordered by session count and recency.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"assetId": { "type": "string" },
									"sessionCount": { "type": "number" },
									"lastUsedAt": { "type": "number" },
									"recentSessionId": { "type": "string" }
								},
								"required": [
									"assetId",
									"sessionCount",
									"lastUsedAt",
									"recentSessionId"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1695,
						"column": 9
					}
				},
				"quantSkillsSessions/legacyTeamRecovery": {
					service: "quantSkillsSessions",
					description: "Audit or explicitly continue historical messages; opening a Session never replays them.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#LegacyTeamRecoveryRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"continuePending": { "type": "boolean" }
								},
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#LegacyTeamRecoveryRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"continuePending": { "type": "boolean" }
								},
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#LegacyTeamRecoveryResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_legacyTeamRecovery_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"delivered": { "type": "number" },
								"pending": { "type": "number" },
								"uncertain": { "type": "number" },
								"unknownEvents": { "type": "number" }
							},
							"required": [
								"delivered",
								"pending",
								"uncertain",
								"unknownEvents"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1190,
						"column": 9
					}
				},
				"quantSkillsSessions/list": {
					service: "quantSkillsSessions",
					description: "List real QuantSkills conversation archives from live and persisted session truth.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "archive visibility filter.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/list:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_list_result$schema,
						description: "Skill-bound ordinary sessions ordered by most recent activity.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"binding": {
										"type": "object",
										"properties": {
											"assetId": { "type": "string" },
											"versionId": { "type": "string" },
											"commit": { "type": "string" },
											"treeDigest": { "type": "string" }
										},
										"required": [
											"assetId",
											"versionId",
											"commit",
											"treeDigest"
										],
										"additionalProperties": true
									},
									"createdAt": { "type": "number" },
									"updatedAt": { "type": "number" },
									"title": { "type": "string" },
									"cwd": { "type": "string" },
									"parentSessionId": { "type": "string" },
									"archived": { "type": "boolean" },
									"running": { "type": "boolean" },
									"runState": {
										"type": "string",
										"enum": [
											"idle",
											"failed",
											"completed",
											"cancelled",
											"running"
										]
									}
								},
								"required": [
									"sessionId",
									"binding",
									"createdAt",
									"updatedAt",
									"archived",
									"running",
									"runState"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1618,
						"column": 9
					}
				},
				"quantSkillsSessions/modelsAccess": {
					service: "quantSkillsSessions",
					description: "Manage model providers through the Host settings and credential services.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ModelAccessRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"action": {
										"type": "string",
										"enum": [
											"auto",
											"list",
											"verify",
											"save",
											"remove",
											"test"
										]
									},
									"model": { "type": "string" },
									"draft": {
										"type": "object",
										"properties": {
											"route": { "type": "string" },
											"service": { "type": "string" },
											"name": { "type": "string" },
											"baseURL": { "type": "string" },
											"api": { "type": "string" },
											"apiKey": { "type": "string" },
											"modelIds": {
												"type": "array",
												"items": { "type": "string" }
											},
											"auto": { "type": "boolean" },
											"reasoning": {
												"type": "string",
												"description": "Optional route default used by the adapter for every model on this route."
											},
											"modelsJson": {
												"type": "string",
												"description": "Optional advanced model declarations; omitted preserves existing overrides."
											}
										},
										"required": [
											"service",
											"name",
											"baseURL",
											"api",
											"modelIds",
											"auto"
										],
										"additionalProperties": true
									},
									"route": { "type": "string" },
									"enabled": { "type": "boolean" }
								},
								"required": ["action"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ModelAccessRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"action": {
										"type": "string",
										"enum": [
											"auto",
											"list",
											"verify",
											"save",
											"remove",
											"test"
										]
									},
									"model": { "type": "string" },
									"draft": {
										"type": "object",
										"properties": {
											"route": { "type": "string" },
											"service": { "type": "string" },
											"name": { "type": "string" },
											"baseURL": { "type": "string" },
											"api": { "type": "string" },
											"apiKey": { "type": "string" },
											"modelIds": {
												"type": "array",
												"items": { "type": "string" }
											},
											"auto": { "type": "boolean" },
											"reasoning": {
												"type": "string",
												"description": "Optional route default used by the adapter for every model on this route."
											},
											"modelsJson": {
												"type": "string",
												"description": "Optional advanced model declarations; omitted preserves existing overrides."
											}
										},
										"required": [
											"service",
											"name",
											"baseURL",
											"api",
											"modelIds",
											"auto"
										],
										"additionalProperties": false
									},
									"route": { "type": "string" },
									"enabled": { "type": "boolean" }
								},
								"required": ["action"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#ModelAccessResponse",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_modelsAccess_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"catalog": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"name": { "type": "string" },
											"api": { "type": "string" },
											"variants": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"id": { "type": "string" },
														"name": { "type": "string" },
														"baseURL": { "type": "string" },
														"catalogProvider": { "type": "string" }
													},
													"required": [
														"id",
														"name",
														"baseURL"
													],
													"additionalProperties": true
												}
											},
											"docs": { "type": "string" },
											"discovery": { "type": "boolean" },
											"recommendations": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"name": { "type": "string" },
														"exactId": {
															"type": "boolean",
															"description": "True only when `name` is an API-callable model id, rather than a vendor family name."
														},
														"roles": {
															"type": "array",
															"items": {
																"type": "string",
																"enum": [
																	"economy",
																	"balanced",
																	"frontier",
																	"coding",
																	"vision",
																	"long-context",
																	"low-latency"
																]
															}
														},
														"summary": { "type": "string" },
														"lifecycle": {
															"type": "string",
															"enum": [
																"stable",
																"preview",
																"experimental"
															]
														},
														"source": { "type": "string" },
														"checkedAt": { "type": "string" }
													},
													"required": [
														"name",
														"exactId",
														"roles",
														"summary",
														"source",
														"checkedAt"
													],
													"additionalProperties": true
												},
												"description": "Discoverable before connection, but never copied into a live route automatically."
											}
										},
										"required": [
											"id",
											"name",
											"api",
											"variants",
											"docs",
											"discovery"
										],
										"additionalProperties": true
									}
								},
								"connections": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"route": { "type": "string" },
											"service": { "type": "string" },
											"name": { "type": "string" },
											"baseURL": { "type": "string" },
											"api": { "type": "string" },
											"configured": { "type": "boolean" },
											"auto": { "type": "boolean" },
											"modelIds": {
												"type": "array",
												"items": { "type": "string" }
											},
											"modelsJson": { "type": "string" },
											"reasoning": { "type": "string" },
											"state": { "type": "string" },
											"message": { "type": "string" }
										},
										"required": [
											"route",
											"service",
											"name",
											"baseURL",
											"api",
											"configured",
											"auto",
											"modelIds",
											"modelsJson",
											"state",
											"message"
										],
										"additionalProperties": true
									}
								},
								"verification": {
									"type": "object",
									"properties": {
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"verified",
												"discovery-unavailable"
											]
										},
										"code": { "type": "string" },
										"message": { "type": "string" },
										"modelIds": {
											"type": "array",
											"items": { "type": "string" }
										},
										"modelProfiles": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"description": "Host-suggested safe model declarations derived from a trusted service preset."
										}
									},
									"required": [
										"state",
										"code",
										"message",
										"modelIds"
									],
									"additionalProperties": true
								}
							},
							"required": ["catalog", "connections"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 929,
						"column": 9
					}
				},
				"quantSkillsSessions/plainSessionCreate": {
					service: "quantSkillsSessions",
					description: "Create or idempotently adopt one product-owned QuantSkills Session without an asset composition.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "preallocated SessionId, explicit purpose, and ordinary create options.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPlainSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"purpose": {
										"type": "string",
										"enum": [
											"ordinary",
											"role-helper",
											"contest",
											"factor-contest"
										]
									},
									"contestConversation": {
										"type": "string",
										"enum": ["main", "topic"]
									},
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": ["sessionId", "purpose"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPlainSessionCreateRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"purpose": {
										"type": "string",
										"enum": [
											"ordinary",
											"role-helper",
											"contest",
											"factor-contest"
										]
									},
									"contestConversation": {
										"type": "string",
										"enum": ["main", "topic"]
									},
									"workspaceId": { "type": "string" },
									"cwd": { "type": "string" },
									"agentPreset": { "type": "string" }
								},
								"required": ["sessionId", "purpose"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPlainSessionCreateResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionCreate_result$schema,
						description: "the published Session identity and durable QuantSkills ownership marker.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"sessionId": { "type": "string" },
								"binding": {
									"type": "object",
									"properties": {
										"purpose": {
											"type": "string",
											"enum": [
												"ordinary",
												"role-helper",
												"contest",
												"factor-contest"
											]
										},
										"contest": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"factorContest": {
											"type": "object",
											"properties": {
												"accountId": { "type": "string" },
												"contestId": { "type": "string" }
											},
											"required": ["accountId", "contestId"],
											"additionalProperties": true
										},
										"contestConversation": {
											"type": "string",
											"enum": ["main", "topic"]
										}
									},
									"required": ["purpose"],
									"additionalProperties": true
								},
								"agentPreset": { "type": "string" }
							},
							"required": ["sessionId", "binding"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1461,
						"column": 9
					}
				},
				"quantSkillsSessions/plainSessionList": {
					service: "quantSkillsSessions",
					description: "List ordinary QuantSkills conversations that do not yet load a Skill, Agent, or Team.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "archive visibility filter.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeArchived": { "type": "boolean" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/plainSessionList:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_plainSessionList_result$schema,
						description: "ordinary product-owned Sessions ordered by most recent activity.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"binding": {
										"type": "object",
										"properties": {
											"purpose": {
												"type": "string",
												"enum": [
													"ordinary",
													"role-helper",
													"contest",
													"factor-contest"
												]
											},
											"contest": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"factorContest": {
												"type": "object",
												"properties": {
													"accountId": { "type": "string" },
													"contestId": { "type": "string" }
												},
												"required": ["accountId", "contestId"],
												"additionalProperties": true
											},
											"contestConversation": {
												"type": "string",
												"enum": ["main", "topic"]
											}
										},
										"required": ["purpose"],
										"additionalProperties": true
									},
									"createdAt": { "type": "number" },
									"updatedAt": { "type": "number" },
									"title": { "type": "string" },
									"cwd": { "type": "string" },
									"parentSessionId": { "type": "string" },
									"archived": { "type": "boolean" },
									"running": { "type": "boolean" },
									"runState": {
										"type": "string",
										"enum": [
											"idle",
											"failed",
											"completed",
											"cancelled",
											"running"
										]
									}
								},
								"required": [
									"sessionId",
									"binding",
									"createdAt",
									"updatedAt",
									"archived",
									"running",
									"runState"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1633,
						"column": 9
					}
				},
				"quantSkillsSessions/promptFormList": {
					service: "quantSkillsSessions",
					description: "List optional parameter forms reachable from the live Session composition.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "live QuantSkills Session identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormListRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormListResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormList_result$schema,
						description: "exact-version forms for resident Skills and declared Agent sources.",
						jsonSchema: {
							"type": "object",
							"properties": { "forms": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"assetId": { "type": "string" },
										"versionId": { "type": "string" },
										"source": {
											"type": "string",
											"enum": ["skill", "agent"]
										},
										"promptForm": { "oneOf": [{
											"type": "object",
											"properties": {
												"status": {
													"type": "string",
													"const": "ready"
												},
												"form": {
													"type": "object",
													"properties": {
														"version": {
															"type": "number",
															"const": 1
														},
														"task": {
															"type": "object",
															"properties": {
																"placeholder": { "type": "string" },
																"required": { "type": "boolean" }
															},
															"required": [],
															"additionalProperties": true
														},
														"fields": {
															"type": "array",
															"items": {
																"type": "object",
																"properties": {
																	"key": { "type": "string" },
																	"label": { "type": "string" },
																	"type": {
																		"type": "string",
																		"enum": [
																			"number",
																			"text",
																			"textarea",
																			"select",
																			"date"
																		]
																	},
																	"required": { "type": "boolean" },
																	"placeholder": { "type": "string" },
																	"help": { "type": "string" },
																	"default": { "oneOf": [{ "type": "string" }, { "type": "number" }] },
																	"options": {
																		"type": "array",
																		"items": {
																			"type": "object",
																			"properties": {
																				"label": { "type": "string" },
																				"value": { "type": "string" }
																			},
																			"required": ["label", "value"],
																			"additionalProperties": true
																		}
																	}
																},
																"required": [
																	"key",
																	"label",
																	"type"
																],
																"additionalProperties": true
															}
														},
														"promptTemplate": { "type": "string" }
													},
													"required": [
														"version",
														"fields",
														"promptTemplate"
													],
													"additionalProperties": true
												},
												"adaptations": {
													"type": "array",
													"items": {
														"type": "object",
														"properties": {
															"code": {
																"type": "string",
																"const": "number-default-string"
															},
															"fieldKey": { "type": "string" }
														},
														"required": ["code", "fieldKey"],
														"additionalProperties": true
													}
												}
											},
											"required": ["status", "form"],
											"additionalProperties": true
										}, {
											"type": "object",
											"properties": {
												"status": {
													"type": "string",
													"const": "invalid"
												},
												"reason": { "type": "string" }
											},
											"required": ["status", "reason"],
											"additionalProperties": true
										}] }
									},
									"required": [
										"assetId",
										"versionId",
										"source",
										"promptForm"
									],
									"additionalProperties": true
								}
							} },
							"required": ["forms"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1802,
						"column": 9
					}
				},
				"quantSkillsSessions/promptFormRender": {
					service: "quantSkillsSessions",
					description: "Render a parameter form only when its exact version belongs to the live Session.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session, exact version, task, and declared field values.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormRenderRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0$schema,
							jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormRenderRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_parameter_0_strict$schema,
							jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsPromptFormRenderResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_promptFormRender_result$schema,
						description: "plain text suitable for an ordinary logged user message.",
						jsonSchema: {
							"type": "object",
							"properties": { "text": { "type": "string" } },
							"required": ["text"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1821,
						"column": 9
					}
				},
				"quantSkillsSessions/residentSkillAttach": {
					service: "quantSkillsSessions",
					description: "Attach one exact installed Skill as resident Session context without creating a user message.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "live conversation and exact installed version; an ordinary workspace conversation is adopted on explicit attachment.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillAttachRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"versionId": { "type": "string" }
								},
								"required": ["sessionId", "versionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillAttachRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"versionId": { "type": "string" }
								},
								"required": ["sessionId", "versionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillAttach_result$schema,
						description: "the authoritative resident Skill set after the append.",
						jsonSchema: {
							"type": "object",
							"properties": { "skills": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"assetId": { "type": "string" },
										"versionId": { "type": "string" },
										"commit": { "type": "string" },
										"treeDigest": { "type": "string" }
									},
									"required": [
										"assetId",
										"versionId",
										"commit",
										"treeDigest"
									],
									"additionalProperties": true
								}
							} },
							"required": ["skills"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1730,
						"column": 9
					}
				},
				"quantSkillsSessions/residentSkillDetach": {
					service: "quantSkillsSessions",
					description: "Detach one resident Skill by stable asset identity without rewriting conversation history.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "live QuantSkills Session and resident asset identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillDetachRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"assetId": { "type": "string" }
								},
								"required": ["sessionId", "assetId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillDetachRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"assetId": { "type": "string" }
								},
								"required": ["sessionId", "assetId"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResidentSkillResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_residentSkillDetach_result$schema,
						description: "the authoritative resident Skill set after the append.",
						jsonSchema: {
							"type": "object",
							"properties": { "skills": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"assetId": { "type": "string" },
										"versionId": { "type": "string" },
										"commit": { "type": "string" },
										"treeDigest": { "type": "string" }
									},
									"required": [
										"assetId",
										"versionId",
										"commit",
										"treeDigest"
									],
									"additionalProperties": true
								}
							} },
							"required": ["skills"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1775,
						"column": 3
					}
				},
				"quantSkillsSessions/resultList": {
					service: "quantSkillsSessions",
					description: "Restore every previewable result referenced by the complete durable Session log. The returned paths pass through the same workspace and installed-version checks as candidates discovered in the currently loaded browser window.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "QuantSkills Session identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/resultList:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/resultList:request",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultList_result$schema,
						description: "newest-reference-first verified results from the full Session history.",
						jsonSchema: {
							"type": "object",
							"properties": { "results": {
								"type": "array",
								"items": { "oneOf": [{
									"type": "object",
									"properties": {
										"status": {
											"type": "string",
											"const": "ready"
										},
										"inputPath": { "type": "string" },
										"path": {
											"type": "string",
											"description": "Canonical path relative to the addressed Session workspace."
										},
										"archived": {
											"type": "boolean",
											"description": "Whether the Host copied an authorized external result into the Session workspace."
										}
									},
									"required": [
										"status",
										"inputPath",
										"path",
										"archived"
									],
									"additionalProperties": true
								}, {
									"type": "object",
									"properties": {
										"status": {
											"type": "string",
											"const": "unavailable"
										},
										"inputPath": { "type": "string" },
										"reason": { "type": "string" }
									},
									"required": [
										"status",
										"inputPath",
										"reason"
									],
									"additionalProperties": true
								}] }
							} },
							"required": ["results"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2560,
						"column": 9
					}
				},
				"quantSkillsSessions/resultPrepare": {
					service: "quantSkillsSessions",
					description: "Normalize discovered result paths to one Session workspace. Authorized legacy Skill output and successful external mutation results are copied into the Session workspace first.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session identity and bounded candidate path list.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"paths": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"required": ["sessionId", "paths"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"paths": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"required": ["sessionId", "paths"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPrepareResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPrepare_result$schema,
						description: "one ordered readiness or diagnostic result per candidate.",
						jsonSchema: {
							"type": "object",
							"properties": { "results": {
								"type": "array",
								"items": { "oneOf": [{
									"type": "object",
									"properties": {
										"status": {
											"type": "string",
											"const": "ready"
										},
										"inputPath": { "type": "string" },
										"path": {
											"type": "string",
											"description": "Canonical path relative to the addressed Session workspace."
										},
										"archived": {
											"type": "boolean",
											"description": "Whether the Host copied an authorized external result into the Session workspace."
										}
									},
									"required": [
										"status",
										"inputPath",
										"path",
										"archived"
									],
									"additionalProperties": true
								}, {
									"type": "object",
									"properties": {
										"status": {
											"type": "string",
											"const": "unavailable"
										},
										"inputPath": { "type": "string" },
										"reason": { "type": "string" }
									},
									"required": [
										"status",
										"inputPath",
										"reason"
									],
									"additionalProperties": true
								}] }
							} },
							"required": ["results"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2515,
						"column": 3
					}
				},
				"quantSkillsSessions/resultPreview": {
					service: "quantSkillsSessions",
					description: "Read a bounded preview from a path contained by the addressed QuantSkills Session workspace. Supported text is returned as UTF-8, Office documents as bounded extracted text, and verified image/PDF bytes as canonical base64.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Session identity and workspace-relative produced path.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPreviewRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"path": { "type": "string" }
								},
								"required": ["sessionId", "path"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPreviewRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"path": { "type": "string" }
								},
								"required": ["sessionId", "path"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsResultPreview",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_resultPreview_result$schema,
						description: "evidence-backed preview or an explicit unsupported result.",
						jsonSchema: { "oneOf": [
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "directory"
									},
									"path": { "type": "string" },
									"bytes": {
										"type": "number",
										"const": 0
									},
									"entries": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"name": { "type": "string" },
												"path": { "type": "string" },
												"type": {
													"type": "string",
													"enum": ["file", "directory"]
												},
												"bytes": { "type": "number" }
											},
											"required": [
												"name",
												"path",
												"type"
											],
											"additionalProperties": true
										}
									}
								},
								"required": [
									"kind",
									"path",
									"bytes",
									"entries"
								],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "text"
									},
									"path": { "type": "string" },
									"mediaType": { "type": "string" },
									"bytes": { "type": "number" },
									"text": { "type": "string" }
								},
								"required": [
									"kind",
									"path",
									"mediaType",
									"bytes",
									"text"
								],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "document"
									},
									"path": { "type": "string" },
									"mediaType": { "type": "string" },
									"bytes": { "type": "number" },
									"text": { "type": "string" },
									"truncated": { "type": "boolean" }
								},
								"required": [
									"kind",
									"path",
									"mediaType",
									"bytes",
									"text",
									"truncated"
								],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "binary"
									},
									"path": { "type": "string" },
									"mediaType": {
										"type": "string",
										"enum": [
											"application/pdf",
											"image/png",
											"image/jpeg",
											"image/gif",
											"image/webp"
										]
									},
									"bytes": { "type": "number" },
									"data": { "type": "string" },
									"url": {
										"type": "string",
										"description": "Authenticated same-Host stream used for PDFs that must not be buffered into RPC."
									}
								},
								"required": [
									"kind",
									"path",
									"mediaType",
									"bytes",
									"data"
								],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "resource"
									},
									"path": { "type": "string" },
									"mediaType": { "type": "string" },
									"bytes": { "type": "number" },
									"url": {
										"type": "string",
										"description": "Authenticated, workspace-contained URL that streams the complete local file."
									},
									"presentation": {
										"type": "string",
										"enum": [
											"text",
											"pdf",
											"image",
											"audio",
											"video",
											"external"
										]
									}
								},
								"required": [
									"kind",
									"path",
									"mediaType",
									"bytes",
									"url",
									"presentation"
								],
								"additionalProperties": true
							},
							{
								"type": "object",
								"properties": {
									"kind": {
										"type": "string",
										"const": "unsupported"
									},
									"path": { "type": "string" },
									"bytes": { "type": "number" },
									"reason": { "type": "string" }
								},
								"required": [
									"kind",
									"path",
									"bytes",
									"reason"
								],
								"additionalProperties": true
							}
						] }
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 2579,
						"column": 9
					}
				},
				"quantSkillsSessions/sessionEnsure": {
					service: "quantSkillsSessions",
					description: "Resume one persisted QuantSkills Session and restore its plugin-owned composition.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "existing QuantSkills Session identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionEnsureRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionEnsureRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "sessionId": { "type": "string" } },
								"required": ["sessionId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsSessionEnsureResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionEnsure_result$schema,
						description: "the live Session identity after setup completes.",
						jsonSchema: {
							"type": "object",
							"properties": { "sessionId": { "type": "string" } },
							"required": ["sessionId"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1419,
						"column": 9
					}
				},
				"quantSkillsSessions/sessionLifecycle": {
					service: "quantSkillsSessions",
					implementation: "changeSessionLifecycle",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#SessionLifecycleRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"action": {
										"type": "string",
										"enum": [
											"archive",
											"restore",
											"delete"
										]
									},
									"filesToken": {
										"type": "string",
										"description": "Issued by deletionPreview; scopes file erasure to the exact reviewed file versions."
									}
								},
								"required": ["sessionId", "action"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#SessionLifecycleRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"action": {
										"type": "string",
										"enum": [
											"archive",
											"restore",
											"delete"
										]
									},
									"filesToken": {
										"type": "string",
										"description": "Issued by deletionPreview; scopes file erasure to the exact reviewed file versions."
									}
								},
								"required": ["sessionId", "action"],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session#quantSkillsSessions/sessionLifecycle:result",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_sessionLifecycle_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1653,
						"column": 9
					}
				},
				"quantSkillsSessions/workspaceResolve": {
					service: "quantSkillsSessions",
					description: "Select the preferred Workspace or create and register the managed fallback.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "optional user-selected Workspace.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "preferredWorkspaceId": { "type": "string" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "preferredWorkspaceId": { "type": "string" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceResolveResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceResolve_result$schema,
						description: "the explicit Workspace target for a new Session.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"workspace": {
									"type": "object",
									"properties": {
										"workspaceId": { "type": "string" },
										"path": { "type": "string" },
										"title": { "type": "string" }
									},
									"required": [
										"workspaceId",
										"path",
										"title"
									],
									"additionalProperties": true
								},
								"source": {
									"type": "string",
									"enum": ["preferred", "managed"]
								},
								"recoveredPreferredWorkspaceId": { "type": "string" }
							},
							"required": ["workspace", "source"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1203,
						"column": 3
					}
				},
				"quantSkillsSessions/workspaceStatus": {
					service: "quantSkillsSessions",
					description: "Inspect the optional preferred and managed QuantSkills Workspace without creating it.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "optional user-selected Workspace.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "preferredWorkspaceId": { "type": "string" } },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceRequest",
							create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "preferredWorkspaceId": { "type": "string" } },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-quantskills-session/types#QuantSkillsWorkspaceStatusResult",
						create: _deepseek_ai_dsh_quantskills_session_quantSkillsSessions_workspaceStatus_result$schema,
						description: "current Workspace targets and preference health.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"managedPath": { "type": "string" },
								"managedWorkspace": {
									"type": "object",
									"properties": {
										"workspaceId": { "type": "string" },
										"path": { "type": "string" },
										"title": { "type": "string" }
									},
									"required": [
										"workspaceId",
										"path",
										"title"
									],
									"additionalProperties": true
								},
								"preferredWorkspace": {
									"type": "object",
									"properties": {
										"workspaceId": { "type": "string" },
										"path": { "type": "string" },
										"title": { "type": "string" }
									},
									"required": [
										"workspaceId",
										"path",
										"title"
									],
									"additionalProperties": true
								},
								"preferredMissing": { "type": "boolean" }
							},
							"required": ["managedPath", "preferredMissing"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/quantskills-session/src/index.ts",
						"line": 1184,
						"column": 3
					}
				}
			}
		}, zod.z);
		//#endregion
		//#region ../panda-mcp/lib/typert.remote-client.js
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_authenticate_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_authenticate_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_authenticate_result$schema$value ??= zod.z.object({
			"ok": zod.z.literal(true).readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("needs_auth"),
				zod.z.literal("error")
			]).readonly(),
			"url": zod.z.string().readonly(),
			"toolCount": zod.z.number().readonly(),
			"toolNames": zod.z.array(zod.z.string()).readonly(),
			"message": zod.z.string().readonly(),
			"authorizationUrl": zod.z.string().readonly().optional().describe("Browser handoff during interactive authorization; never contains access tokens.")
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			])
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]),
			"columns": zod.z.array(zod.z.string()),
			"rowCount": zod.z.number(),
			"fetchedAt": zod.z.string(),
			"expiresAt": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"bytes": zod.z.number(),
			"name": zod.z.string(),
			"source": zod.z.object({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0$schema$value ??= zod.z.object({
			"name": zod.z.string(),
			"source": zod.z.object({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"kind": zod.z.union([
				zod.z.literal("timeseries"),
				zod.z.literal("table"),
				zod.z.literal("auto")
			]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]).optional(),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]),
			"columns": zod.z.array(zod.z.string()),
			"rowCount": zod.z.number(),
			"fetchedAt": zod.z.string(),
			"expiresAt": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"bytes": zod.z.number(),
			"name": zod.z.string(),
			"source": zod.z.object({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0$schema$value ??= zod.z.object({
			"name": zod.z.string(),
			"format": zod.z.union([zod.z.literal("csv"), zod.z.literal("json")]),
			"content": zod.z.string(),
			"kind": zod.z.union([
				zod.z.literal("timeseries"),
				zod.z.literal("table"),
				zod.z.literal("auto")
			]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]).optional(),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]),
			"columns": zod.z.array(zod.z.string()),
			"rowCount": zod.z.number(),
			"fetchedAt": zod.z.string(),
			"expiresAt": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"bytes": zod.z.number(),
			"name": zod.z.string(),
			"source": zod.z.object({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseList_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseList_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseList_result$schema$value ??= zod.z.array(zod.z.object({
			"id": zod.z.string(),
			"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]),
			"columns": zod.z.array(zod.z.string()),
			"rowCount": zod.z.number(),
			"fetchedAt": zod.z.string(),
			"expiresAt": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"bytes": zod.z.number(),
			"name": zod.z.string(),
			"source": zod.z.object({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		}));
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0$schema$value ??= zod.z.object({ "id": zod.z.string() });
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_result$schema$value ??= zod.z.object({
			"dataset": zod.z.object({
				"id": zod.z.string(),
				"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
				"category": zod.z.union([
					zod.z.literal("market"),
					zod.z.literal("news"),
					zod.z.literal("fundamental"),
					zod.z.literal("other")
				]),
				"columns": zod.z.array(zod.z.string()),
				"rowCount": zod.z.number(),
				"fetchedAt": zod.z.string(),
				"expiresAt": zod.z.string(),
				"from": zod.z.string().optional(),
				"to": zod.z.string().optional(),
				"bytes": zod.z.number(),
				"name": zod.z.string(),
				"source": zod.z.object({
					"kind": zod.z.union([
						zod.z.literal("file"),
						zod.z.literal("http"),
						zod.z.literal("pandadata")
					]),
					"url": zod.z.string().optional(),
					"method": zod.z.string().optional(),
					"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
					"filename": zod.z.string().optional(),
					"rollingDay": zod.z.boolean().optional()
				}),
				"dateColumn": zod.z.string().optional(),
				"ttlSeconds": zod.z.number()
			}),
			"status": zod.z.union([
				zod.z.literal("hit"),
				zod.z.literal("refreshed"),
				zod.z.literal("insufficient")
			]),
			"reasons": zod.z.array(zod.z.string()),
			"rows": zod.z.array(zod.z.record(zod.z.string(), zod.z.json())),
			"total": zod.z.number(),
			"nextOffset": zod.z.number().optional()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"minRows": zod.z.number().optional(),
			"limit": zod.z.number().optional(),
			"offset": zod.z.number().optional(),
			"refresh": zod.z.boolean().optional()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_result$schema$value ??= zod.z.object({
			"dataset": zod.z.object({
				"id": zod.z.string(),
				"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
				"category": zod.z.union([
					zod.z.literal("market"),
					zod.z.literal("news"),
					zod.z.literal("fundamental"),
					zod.z.literal("other")
				]),
				"columns": zod.z.array(zod.z.string()),
				"rowCount": zod.z.number(),
				"fetchedAt": zod.z.string(),
				"expiresAt": zod.z.string(),
				"from": zod.z.string().optional(),
				"to": zod.z.string().optional(),
				"bytes": zod.z.number(),
				"name": zod.z.string(),
				"source": zod.z.object({
					"kind": zod.z.union([
						zod.z.literal("file"),
						zod.z.literal("http"),
						zod.z.literal("pandadata")
					]),
					"url": zod.z.string().optional(),
					"method": zod.z.string().optional(),
					"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
					"filename": zod.z.string().optional(),
					"rollingDay": zod.z.boolean().optional()
				}),
				"dateColumn": zod.z.string().optional(),
				"ttlSeconds": zod.z.number()
			}),
			"status": zod.z.union([
				zod.z.literal("hit"),
				zod.z.literal("refreshed"),
				zod.z.literal("insufficient")
			]),
			"reasons": zod.z.array(zod.z.string()),
			"rows": zod.z.array(zod.z.record(zod.z.string(), zod.z.json())),
			"total": zod.z.number(),
			"nextOffset": zod.z.number().optional()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0$schema$value ??= zod.z.object({ "id": zod.z.string() });
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_result$schema$value ??= zod.z.object({
			"id": zod.z.string(),
			"kind": zod.z.union([zod.z.literal("timeseries"), zod.z.literal("table")]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]),
			"columns": zod.z.array(zod.z.string()),
			"rowCount": zod.z.number(),
			"fetchedAt": zod.z.string(),
			"expiresAt": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"bytes": zod.z.number(),
			"name": zod.z.string(),
			"source": zod.z.object({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0$schema$value ??= zod.z.object({ "id": zod.z.string() });
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_result$schema$value ??= zod.z.void();
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_logout_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_logout_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_logout_result$schema$value ??= zod.z.object({
			"ok": zod.z.literal(true).readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("needs_auth"),
				zod.z.literal("error")
			]).readonly(),
			"url": zod.z.string().readonly(),
			"toolCount": zod.z.number().readonly(),
			"toolNames": zod.z.array(zod.z.string()).readonly(),
			"message": zod.z.string().readonly(),
			"authorizationUrl": zod.z.string().readonly().optional().describe("Browser handoff during interactive authorization; never contains access tokens.")
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_refresh_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_refresh_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_refresh_result$schema$value ??= zod.z.object({
			"ok": zod.z.literal(true).readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("needs_auth"),
				zod.z.literal("error")
			]).readonly(),
			"url": zod.z.string().readonly(),
			"toolCount": zod.z.number().readonly(),
			"toolNames": zod.z.array(zod.z.string()).readonly(),
			"message": zod.z.string().readonly(),
			"authorizationUrl": zod.z.string().readonly().optional().describe("Browser handoff during interactive authorization; never contains access tokens.")
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_status_result$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_status_result$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_status_result$schema$value ??= zod.z.object({
			"ok": zod.z.literal(true).readonly(),
			"phase": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("authenticating"),
				zod.z.literal("connected"),
				zod.z.literal("needs_auth"),
				zod.z.literal("error")
			]).readonly(),
			"url": zod.z.string().readonly(),
			"toolCount": zod.z.number().readonly(),
			"toolNames": zod.z.array(zod.z.string()).readonly(),
			"message": zod.z.string().readonly(),
			"authorizationUrl": zod.z.string().readonly().optional().describe("Browser handoff during interactive authorization; never contains access tokens.")
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"id": zod.z.string(),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			])
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"name": zod.z.string(),
			"source": zod.z.strictObject({
				"kind": zod.z.union([
					zod.z.literal("file"),
					zod.z.literal("http"),
					zod.z.literal("pandadata")
				]),
				"url": zod.z.string().optional(),
				"method": zod.z.string().optional(),
				"params": zod.z.record(zod.z.string(), zod.z.json()).optional(),
				"filename": zod.z.string().optional(),
				"rollingDay": zod.z.boolean().optional()
			}),
			"kind": zod.z.union([
				zod.z.literal("timeseries"),
				zod.z.literal("table"),
				zod.z.literal("auto")
			]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]).optional(),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"name": zod.z.string(),
			"format": zod.z.union([zod.z.literal("csv"), zod.z.literal("json")]),
			"content": zod.z.string(),
			"kind": zod.z.union([
				zod.z.literal("timeseries"),
				zod.z.literal("table"),
				zod.z.literal("auto")
			]),
			"category": zod.z.union([
				zod.z.literal("market"),
				zod.z.literal("news"),
				zod.z.literal("fundamental"),
				zod.z.literal("other")
			]).optional(),
			"dateColumn": zod.z.string().optional(),
			"ttlSeconds": zod.z.number()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0_strict$schema$value ??= zod.z.strictObject({ "id": zod.z.string() });
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"id": zod.z.string(),
			"from": zod.z.string().optional(),
			"to": zod.z.string().optional(),
			"minRows": zod.z.number().optional(),
			"limit": zod.z.number().optional(),
			"offset": zod.z.number().optional(),
			"refresh": zod.z.boolean().optional()
		});
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0_strict$schema$value ??= zod.z.strictObject({ "id": zod.z.string() });
		let _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0_strict$schema = () => _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0_strict$schema$value ??= zod.z.strictObject({ "id": zod.z.string() });
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "@deepseek-ai/dsh-panda-mcp",
			methods: {
				"pandaMcp/authenticate": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_authenticate_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ok": {
									"type": "boolean",
									"const": true
								},
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"needs_auth",
										"error"
									]
								},
								"url": { "type": "string" },
								"toolCount": { "type": "number" },
								"toolNames": {
									"type": "array",
									"items": { "type": "string" }
								},
								"message": { "type": "string" },
								"authorizationUrl": {
									"type": "string",
									"description": "Browser handoff during interactive authorization; never contains access tokens."
								}
							},
							"required": [
								"ok",
								"phase",
								"url",
								"toolCount",
								"toolNames",
								"message"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 275,
						"column": 3
					}
				},
				"pandaMcp/databaseCategorize": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseCategorize:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									}
								},
								"required": ["id", "category"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseCategorize:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									}
								},
								"required": ["id", "category"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseCategorize_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"kind": {
									"type": "string",
									"enum": ["timeseries", "table"]
								},
								"category": {
									"type": "string",
									"enum": [
										"market",
										"news",
										"fundamental",
										"other"
									]
								},
								"columns": {
									"type": "array",
									"items": { "type": "string" }
								},
								"rowCount": { "type": "number" },
								"fetchedAt": { "type": "string" },
								"expiresAt": { "type": "string" },
								"from": { "type": "string" },
								"to": { "type": "string" },
								"bytes": { "type": "number" },
								"name": { "type": "string" },
								"source": {
									"type": "object",
									"properties": {
										"kind": {
											"type": "string",
											"enum": [
												"file",
												"http",
												"pandadata"
											]
										},
										"url": { "type": "string" },
										"method": { "type": "string" },
										"params": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"filename": { "type": "string" },
										"rollingDay": { "type": "boolean" }
									},
									"required": ["kind"],
									"additionalProperties": true
								},
								"dateColumn": { "type": "string" },
								"ttlSeconds": { "type": "number" }
							},
							"required": [
								"id",
								"kind",
								"category",
								"columns",
								"rowCount",
								"fetchedAt",
								"expiresAt",
								"bytes",
								"name",
								"source",
								"ttlSeconds"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 248,
						"column": 3
					}
				},
				"pandaMcp/databaseFetch": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataFetch",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"source": {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"enum": [
													"file",
													"http",
													"pandadata"
												]
											},
											"url": { "type": "string" },
											"method": { "type": "string" },
											"params": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"filename": { "type": "string" },
											"rollingDay": { "type": "boolean" }
										},
										"required": ["kind"],
										"additionalProperties": true
									},
									"kind": {
										"type": "string",
										"enum": [
											"timeseries",
											"table",
											"auto"
										]
									},
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									},
									"dateColumn": { "type": "string" },
									"ttlSeconds": { "type": "number" }
								},
								"required": [
									"name",
									"source",
									"kind",
									"ttlSeconds"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataFetch",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"source": {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"enum": [
													"file",
													"http",
													"pandadata"
												]
											},
											"url": { "type": "string" },
											"method": { "type": "string" },
											"params": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"filename": { "type": "string" },
											"rollingDay": { "type": "boolean" }
										},
										"required": ["kind"],
										"additionalProperties": false
									},
									"kind": {
										"type": "string",
										"enum": [
											"timeseries",
											"table",
											"auto"
										]
									},
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									},
									"dateColumn": { "type": "string" },
									"ttlSeconds": { "type": "number" }
								},
								"required": [
									"name",
									"source",
									"kind",
									"ttlSeconds"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseFetch_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"kind": {
									"type": "string",
									"enum": ["timeseries", "table"]
								},
								"category": {
									"type": "string",
									"enum": [
										"market",
										"news",
										"fundamental",
										"other"
									]
								},
								"columns": {
									"type": "array",
									"items": { "type": "string" }
								},
								"rowCount": { "type": "number" },
								"fetchedAt": { "type": "string" },
								"expiresAt": { "type": "string" },
								"from": { "type": "string" },
								"to": { "type": "string" },
								"bytes": { "type": "number" },
								"name": { "type": "string" },
								"source": {
									"type": "object",
									"properties": {
										"kind": {
											"type": "string",
											"enum": [
												"file",
												"http",
												"pandadata"
											]
										},
										"url": { "type": "string" },
										"method": { "type": "string" },
										"params": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"filename": { "type": "string" },
										"rollingDay": { "type": "boolean" }
									},
									"required": ["kind"],
									"additionalProperties": true
								},
								"dateColumn": { "type": "string" },
								"ttlSeconds": { "type": "number" }
							},
							"required": [
								"id",
								"kind",
								"category",
								"columns",
								"rowCount",
								"fetchedAt",
								"expiresAt",
								"bytes",
								"name",
								"source",
								"ttlSeconds"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 238,
						"column": 3
					}
				},
				"pandaMcp/databaseImport": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataImport",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"format": {
										"type": "string",
										"enum": ["csv", "json"]
									},
									"content": { "type": "string" },
									"kind": {
										"type": "string",
										"enum": [
											"timeseries",
											"table",
											"auto"
										]
									},
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									},
									"dateColumn": { "type": "string" },
									"ttlSeconds": { "type": "number" }
								},
								"required": [
									"name",
									"format",
									"content",
									"kind",
									"ttlSeconds"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataImport",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"name": { "type": "string" },
									"format": {
										"type": "string",
										"enum": ["csv", "json"]
									},
									"content": { "type": "string" },
									"kind": {
										"type": "string",
										"enum": [
											"timeseries",
											"table",
											"auto"
										]
									},
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									},
									"dateColumn": { "type": "string" },
									"ttlSeconds": { "type": "number" }
								},
								"required": [
									"name",
									"format",
									"content",
									"kind",
									"ttlSeconds"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseImport_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"kind": {
									"type": "string",
									"enum": ["timeseries", "table"]
								},
								"category": {
									"type": "string",
									"enum": [
										"market",
										"news",
										"fundamental",
										"other"
									]
								},
								"columns": {
									"type": "array",
									"items": { "type": "string" }
								},
								"rowCount": { "type": "number" },
								"fetchedAt": { "type": "string" },
								"expiresAt": { "type": "string" },
								"from": { "type": "string" },
								"to": { "type": "string" },
								"bytes": { "type": "number" },
								"name": { "type": "string" },
								"source": {
									"type": "object",
									"properties": {
										"kind": {
											"type": "string",
											"enum": [
												"file",
												"http",
												"pandadata"
											]
										},
										"url": { "type": "string" },
										"method": { "type": "string" },
										"params": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"filename": { "type": "string" },
										"rollingDay": { "type": "boolean" }
									},
									"required": ["kind"],
									"additionalProperties": true
								},
								"dateColumn": { "type": "string" },
								"ttlSeconds": { "type": "number" }
							},
							"required": [
								"id",
								"kind",
								"category",
								"columns",
								"rowCount",
								"fetchedAt",
								"expiresAt",
								"bytes",
								"name",
								"source",
								"ttlSeconds"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 236,
						"column": 3
					}
				},
				"pandaMcp/databaseList": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseList:result",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseList_result$schema,
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"kind": {
										"type": "string",
										"enum": ["timeseries", "table"]
									},
									"category": {
										"type": "string",
										"enum": [
											"market",
											"news",
											"fundamental",
											"other"
										]
									},
									"columns": {
										"type": "array",
										"items": { "type": "string" }
									},
									"rowCount": { "type": "number" },
									"fetchedAt": { "type": "string" },
									"expiresAt": { "type": "string" },
									"from": { "type": "string" },
									"to": { "type": "string" },
									"bytes": { "type": "number" },
									"name": { "type": "string" },
									"source": {
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"enum": [
													"file",
													"http",
													"pandadata"
												]
											},
											"url": { "type": "string" },
											"method": { "type": "string" },
											"params": {
												"type": "object",
												"properties": {},
												"required": [],
												"additionalProperties": true
											},
											"filename": { "type": "string" },
											"rollingDay": { "type": "boolean" }
										},
										"required": ["kind"],
										"additionalProperties": true
									},
									"dateColumn": { "type": "string" },
									"ttlSeconds": { "type": "number" }
								},
								"required": [
									"id",
									"kind",
									"category",
									"columns",
									"rowCount",
									"fetchedAt",
									"expiresAt",
									"bytes",
									"name",
									"source",
									"ttlSeconds"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 234,
						"column": 3
					}
				},
				"pandaMcp/databasePreview": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databasePreview:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "id": { "type": "string" } },
								"required": ["id"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databasePreview:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "id": { "type": "string" } },
								"required": ["id"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataResult",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databasePreview_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"dataset": {
									"type": "object",
									"properties": {
										"id": { "type": "string" },
										"kind": {
											"type": "string",
											"enum": ["timeseries", "table"]
										},
										"category": {
											"type": "string",
											"enum": [
												"market",
												"news",
												"fundamental",
												"other"
											]
										},
										"columns": {
											"type": "array",
											"items": { "type": "string" }
										},
										"rowCount": { "type": "number" },
										"fetchedAt": { "type": "string" },
										"expiresAt": { "type": "string" },
										"from": { "type": "string" },
										"to": { "type": "string" },
										"bytes": { "type": "number" },
										"name": { "type": "string" },
										"source": {
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"enum": [
														"file",
														"http",
														"pandadata"
													]
												},
												"url": { "type": "string" },
												"method": { "type": "string" },
												"params": {
													"type": "object",
													"properties": {},
													"required": [],
													"additionalProperties": true
												},
												"filename": { "type": "string" },
												"rollingDay": { "type": "boolean" }
											},
											"required": ["kind"],
											"additionalProperties": true
										},
										"dateColumn": { "type": "string" },
										"ttlSeconds": { "type": "number" }
									},
									"required": [
										"id",
										"kind",
										"category",
										"columns",
										"rowCount",
										"fetchedAt",
										"expiresAt",
										"bytes",
										"name",
										"source",
										"ttlSeconds"
									],
									"additionalProperties": true
								},
								"status": {
									"type": "string",
									"enum": [
										"hit",
										"refreshed",
										"insufficient"
									]
								},
								"reasons": {
									"type": "array",
									"items": { "type": "string" }
								},
								"rows": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {},
										"required": [],
										"additionalProperties": true
									}
								},
								"total": { "type": "number" },
								"nextOffset": { "type": "number" }
							},
							"required": [
								"dataset",
								"status",
								"reasons",
								"rows",
								"total"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 242,
						"column": 3
					}
				},
				"pandaMcp/databaseQuery": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataQuery",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"from": { "type": "string" },
									"to": { "type": "string" },
									"minRows": { "type": "number" },
									"limit": { "type": "number" },
									"offset": { "type": "number" },
									"refresh": { "type": "boolean" }
								},
								"required": ["id"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataQuery",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"from": { "type": "string" },
									"to": { "type": "string" },
									"minRows": { "type": "number" },
									"limit": { "type": "number" },
									"offset": { "type": "number" },
									"refresh": { "type": "boolean" }
								},
								"required": ["id"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataResult",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseQuery_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"dataset": {
									"type": "object",
									"properties": {
										"id": { "type": "string" },
										"kind": {
											"type": "string",
											"enum": ["timeseries", "table"]
										},
										"category": {
											"type": "string",
											"enum": [
												"market",
												"news",
												"fundamental",
												"other"
											]
										},
										"columns": {
											"type": "array",
											"items": { "type": "string" }
										},
										"rowCount": { "type": "number" },
										"fetchedAt": { "type": "string" },
										"expiresAt": { "type": "string" },
										"from": { "type": "string" },
										"to": { "type": "string" },
										"bytes": { "type": "number" },
										"name": { "type": "string" },
										"source": {
											"type": "object",
											"properties": {
												"kind": {
													"type": "string",
													"enum": [
														"file",
														"http",
														"pandadata"
													]
												},
												"url": { "type": "string" },
												"method": { "type": "string" },
												"params": {
													"type": "object",
													"properties": {},
													"required": [],
													"additionalProperties": true
												},
												"filename": { "type": "string" },
												"rollingDay": { "type": "boolean" }
											},
											"required": ["kind"],
											"additionalProperties": true
										},
										"dateColumn": { "type": "string" },
										"ttlSeconds": { "type": "number" }
									},
									"required": [
										"id",
										"kind",
										"category",
										"columns",
										"rowCount",
										"fetchedAt",
										"expiresAt",
										"bytes",
										"name",
										"source",
										"ttlSeconds"
									],
									"additionalProperties": true
								},
								"status": {
									"type": "string",
									"enum": [
										"hit",
										"refreshed",
										"insufficient"
									]
								},
								"reasons": {
									"type": "array",
									"items": { "type": "string" }
								},
								"rows": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {},
										"required": [],
										"additionalProperties": true
									}
								},
								"total": { "type": "number" },
								"nextOffset": { "type": "number" }
							},
							"required": [
								"dataset",
								"status",
								"reasons",
								"rows",
								"total"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 240,
						"column": 3
					}
				},
				"pandaMcp/databaseRefresh": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRefresh:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "id": { "type": "string" } },
								"required": ["id"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRefresh:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "id": { "type": "string" } },
								"required": ["id"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#DataSummary",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRefresh_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"id": { "type": "string" },
								"kind": {
									"type": "string",
									"enum": ["timeseries", "table"]
								},
								"category": {
									"type": "string",
									"enum": [
										"market",
										"news",
										"fundamental",
										"other"
									]
								},
								"columns": {
									"type": "array",
									"items": { "type": "string" }
								},
								"rowCount": { "type": "number" },
								"fetchedAt": { "type": "string" },
								"expiresAt": { "type": "string" },
								"from": { "type": "string" },
								"to": { "type": "string" },
								"bytes": { "type": "number" },
								"name": { "type": "string" },
								"source": {
									"type": "object",
									"properties": {
										"kind": {
											"type": "string",
											"enum": [
												"file",
												"http",
												"pandadata"
											]
										},
										"url": { "type": "string" },
										"method": { "type": "string" },
										"params": {
											"type": "object",
											"properties": {},
											"required": [],
											"additionalProperties": true
										},
										"filename": { "type": "string" },
										"rollingDay": { "type": "boolean" }
									},
									"required": ["kind"],
									"additionalProperties": true
								},
								"dateColumn": { "type": "string" },
								"ttlSeconds": { "type": "number" }
							},
							"required": [
								"id",
								"kind",
								"category",
								"columns",
								"rowCount",
								"fetchedAt",
								"expiresAt",
								"bytes",
								"name",
								"source",
								"ttlSeconds"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 244,
						"column": 3
					}
				},
				"pandaMcp/databaseRemove": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRemove:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "id": { "type": "string" } },
								"required": ["id"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRemove:input",
							create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "id": { "type": "string" } },
								"required": ["id"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp#pandaMcp/databaseRemove:result",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_databaseRemove_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 246,
						"column": 3
					}
				},
				"pandaMcp/logout": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_logout_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ok": {
									"type": "boolean",
									"const": true
								},
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"needs_auth",
										"error"
									]
								},
								"url": { "type": "string" },
								"toolCount": { "type": "number" },
								"toolNames": {
									"type": "array",
									"items": { "type": "string" }
								},
								"message": { "type": "string" },
								"authorizationUrl": {
									"type": "string",
									"description": "Browser handoff during interactive authorization; never contains access tokens."
								}
							},
							"required": [
								"ok",
								"phase",
								"url",
								"toolCount",
								"toolNames",
								"message"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 302,
						"column": 9
					}
				},
				"pandaMcp/refresh": {
					service: "pandaMcp",
					description: "用已保存 token 静默重连；没有 token 时只返回当前状态，不打开浏览器。",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_refresh_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ok": {
									"type": "boolean",
									"const": true
								},
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"needs_auth",
										"error"
									]
								},
								"url": { "type": "string" },
								"toolCount": { "type": "number" },
								"toolNames": {
									"type": "array",
									"items": { "type": "string" }
								},
								"message": { "type": "string" },
								"authorizationUrl": {
									"type": "string",
									"description": "Browser handoff during interactive authorization; never contains access tokens."
								}
							},
							"required": [
								"ok",
								"phase",
								"url",
								"toolCount",
								"toolNames",
								"message"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 284,
						"column": 9
					}
				},
				"pandaMcp/status": {
					service: "pandaMcp",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-panda-mcp/types#PandaMcpStatus",
						create: _deepseek_ai_dsh_panda_mcp_pandaMcp_status_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ok": {
									"type": "boolean",
									"const": true
								},
								"phase": {
									"type": "string",
									"enum": [
										"disconnected",
										"authenticating",
										"connected",
										"needs_auth",
										"error"
									]
								},
								"url": { "type": "string" },
								"toolCount": { "type": "number" },
								"toolNames": {
									"type": "array",
									"items": { "type": "string" }
								},
								"message": { "type": "string" },
								"authorizationUrl": {
									"type": "string",
									"description": "Browser handoff during interactive authorization; never contains access tokens."
								}
							},
							"required": [
								"ok",
								"phase",
								"url",
								"toolCount",
								"toolNames",
								"message"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/panda-mcp/src/index.ts",
						"line": 269,
						"column": 3
					}
				}
			}
		}, zod.z);
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