import z from "@deepseek-ai/schemastery";
//#region lib/types/appearance-settings.js
/** QuantSkills application preferences stored in the Host user-settings document. */
/** Settings namespace owned by the QuantSkills application. */
const QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE = "ui-quantskills";
/** Field carrying the application chrome scale. */
const QUANTSKILLS_INTERFACE_SCALE_FIELD = "interfaceScale";
/** Field carrying the stock conversation text scale. */
const QUANTSKILLS_CONVERSATION_SCALE_FIELD = "conversationScale";
/** Field carrying the stock conversation text brightness. */
const QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD = "conversationBrightness";
/** Field carrying the opacity of the foreground surface above conversation backgrounds. */
const QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD = "conversationOverlayOpacity";
/** Field carrying the QuantSkills-owned palette independent from the Host theme. */
const QUANTSKILLS_COLOR_SCHEME_FIELD = "colorScheme";
/** Field carrying the selected light-palette background. */
const QUANTSKILLS_LIGHT_BACKGROUND_FIELD = "lightBackground";
/** Field carrying the selected dark-palette background. */
const QUANTSKILLS_DARK_BACKGROUND_FIELD = "darkBackground";
/** Field controlling background catalog checks after the required initial load. */
const QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD = "autoCheckCatalog";
/** Field controlling preflight authentication checks for Panda-dependent assets. */
const QUANTSKILLS_AUTO_CHECK_PANDA_FIELD = "autoCheckPanda";
/** Field controlling whether a Panda-gated action resumes after successful login. */
const QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD = "resumeAfterPandaLogin";
/** Field carrying the user's durable QuantSkills favorites. */
const QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD = "favoriteAssetIds";
/** Field carrying user-local catalog display-name overrides. */
const QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD = "assetDisplayNameOverrides";
/** Field carrying the default provider for newly created user Agents. */
const QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD = "defaultAgentProvider";
/** Field carrying the default model for newly created user Agents. */
const QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD = "defaultAgentModel";
/** Field carrying the default reasoning effort for newly created user Agents. */
const QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD = "defaultAgentReasoningEffort";
/** Field carrying the default permission preset for newly created user Agents. */
const QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD = "defaultAgentPermission";
/** Field carrying an optional registered Host Workspace for new plugin Sessions. */
const QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD = "defaultWorkspaceId";
/** Default scale for both QuantSkills surfaces. */
const DEFAULT_QUANTSKILLS_SCALE = 1;
/** Default brightness for stock conversation text. */
const DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 1;
/** Default opacity of the foreground surface above a conversation background. */
const DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = .92;
/** Palette used until the user selects the other QuantSkills appearance. */
const DEFAULT_QUANTSKILLS_COLOR_SCHEME = "dark";
/** Background used with the light palette until the user selects another. */
const DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND = "launch";
/** Background used with the dark palette until the user selects another. */
const DEFAULT_QUANTSKILLS_DARK_BACKGROUND = "motion-minimal-blue";
/** Default background catalog policy. */
const DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG = true;
/** Default Panda preflight policy. */
const DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA = true;
/** Default Panda task-resume policy. */
const DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN = true;
/** Permission applied to newly created Agents until the user chooses another default. */
const DEFAULT_QUANTSKILLS_AGENT_PERMISSION = "workspace-write";
/** Minimum scale exposed by the QuantSkills appearance controls. */
const MIN_QUANTSKILLS_SCALE = .6;
/** Maximum scale exposed by the QuantSkills appearance controls. */
const MAX_QUANTSKILLS_SCALE = 1.5;
/** Minimum brightness exposed by the QuantSkills appearance controls. */
const MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS = .6;
/** Maximum brightness exposed by the QuantSkills appearance controls. */
const MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 1;
/** Durable QuantSkills preference schema. */
const QuantSkillsSettingsSchema = z.object({
	artifactPalette: z.string().max(2e3).required(false),
	[QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD]: z.string().min(1).required(false),
	[QUANTSKILLS_INTERFACE_SCALE_FIELD]: z.number().min(MIN_QUANTSKILLS_SCALE).max(MAX_QUANTSKILLS_SCALE).default(1),
	[QUANTSKILLS_CONVERSATION_SCALE_FIELD]: z.number().min(MIN_QUANTSKILLS_SCALE).max(MAX_QUANTSKILLS_SCALE).default(1),
	[QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD]: z.number().min(MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS).max(1).default(1),
	[QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD]: z.number().min(0).max(1).default(DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY),
	[QUANTSKILLS_COLOR_SCHEME_FIELD]: z.union(["light", "dark"]).default(DEFAULT_QUANTSKILLS_COLOR_SCHEME),
	[QUANTSKILLS_LIGHT_BACKGROUND_FIELD]: z.union([
		"motion-glass-blue",
		"motion-glass-ink",
		"motion-cosmos",
		"motion-ocean",
		"motion-meadow",
		"motion-jiangnan",
		"motion-cyber",
		"none",
		"launch",
		"network-sphere",
		"astronaut-visor",
		"astronaut"
	]).default(DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND),
	[QUANTSKILLS_DARK_BACKGROUND_FIELD]: z.union([
		"motion-glass-rain",
		"motion-minimal-blue",
		"motion-minimal-jade",
		"motion-minimal-copper",
		"motion-cosmos",
		"motion-ocean",
		"motion-meadow",
		"motion-jiangnan",
		"motion-cyber",
		"none",
		"moon-observer",
		"moonwalker",
		"orbital-rings",
		"astronaut-visor"
	]).default(DEFAULT_QUANTSKILLS_DARK_BACKGROUND),
	[QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD]: z.boolean().default(true),
	[QUANTSKILLS_AUTO_CHECK_PANDA_FIELD]: z.boolean().default(true),
	[QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD]: z.boolean().default(true),
	[QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD]: z.array(z.string().min(1).max(200)).max(500).default([]),
	[QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD]: z.array(z.object({
		assetId: z.string().min(1).max(200),
		displayName: z.string().min(1).max(80)
	})).max(500).default([]),
	[QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD]: z.string().max(200).default(""),
	[QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD]: z.string().max(400).default(""),
	[QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD]: z.string().max(100).default(""),
	[QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD]: z.union([
		"read-only",
		"workspace-write",
		"danger-full-access"
	]).default(DEFAULT_QUANTSKILLS_AGENT_PERMISSION)
});
//#endregion
//#region lib/types/index.js
/** Host registration for QuantSkills application preferences. */
/** Register the durable QuantSkills appearance section when settings are composed. */
function apply(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.register(QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE, QuantSkillsSettingsSchema);
	});
}
//#endregion
export { DEFAULT_QUANTSKILLS_AGENT_PERMISSION, DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG, DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA, DEFAULT_QUANTSKILLS_COLOR_SCHEME, DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS, DEFAULT_QUANTSKILLS_DARK_BACKGROUND, DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND, DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN, DEFAULT_QUANTSKILLS_SCALE, MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS, MAX_QUANTSKILLS_SCALE, MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS, MIN_QUANTSKILLS_SCALE, QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE, QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD, QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD, QUANTSKILLS_AUTO_CHECK_PANDA_FIELD, QUANTSKILLS_COLOR_SCHEME_FIELD, QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD, QUANTSKILLS_CONVERSATION_SCALE_FIELD, QUANTSKILLS_DARK_BACKGROUND_FIELD, QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD, QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD, QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD, QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD, QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD, QUANTSKILLS_INTERFACE_SCALE_FIELD, QUANTSKILLS_LIGHT_BACKGROUND_FIELD, QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD, apply };
