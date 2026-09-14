/** QuantSkills application preferences stored in the Host user-settings document. */
import z from '@deepseek-ai/schemastery';
/** Settings namespace owned by the QuantSkills application. */
export const QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE = 'ui-quantskills';
/** Field carrying the application chrome scale. */
export const QUANTSKILLS_INTERFACE_SCALE_FIELD = 'interfaceScale';
/** Field carrying the stock conversation text scale. */
export const QUANTSKILLS_CONVERSATION_SCALE_FIELD = 'conversationScale';
/** Field carrying the stock conversation text brightness. */
export const QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD = 'conversationBrightness';
/** Field carrying the opacity of the foreground surface above conversation backgrounds. */
export const QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD = 'conversationOverlayOpacity';
/** Field carrying the QuantSkills-owned palette independent from the Host theme. */
export const QUANTSKILLS_COLOR_SCHEME_FIELD = 'colorScheme';
/** Field carrying the selected light-palette background. */
export const QUANTSKILLS_LIGHT_BACKGROUND_FIELD = 'lightBackground';
/** Field carrying the selected dark-palette background. */
export const QUANTSKILLS_DARK_BACKGROUND_FIELD = 'darkBackground';
/** Field controlling background catalog checks after the required initial load. */
export const QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD = 'autoCheckCatalog';
/** Field controlling preflight authentication checks for Panda-dependent assets. */
export const QUANTSKILLS_AUTO_CHECK_PANDA_FIELD = 'autoCheckPanda';
/** Field controlling whether a Panda-gated action resumes after successful login. */
export const QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD = 'resumeAfterPandaLogin';
/** Field carrying the user's durable QuantSkills favorites. */
export const QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD = 'favoriteAssetIds';
/** Field carrying user-local catalog display-name overrides. */
export const QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD = 'assetDisplayNameOverrides';
/** Field carrying the default provider for newly created user Agents. */
export const QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD = 'defaultAgentProvider';
/** Field carrying the default model for newly created user Agents. */
export const QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD = 'defaultAgentModel';
/** Field carrying the default reasoning effort for newly created user Agents. */
export const QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD = 'defaultAgentReasoningEffort';
/** Field carrying the default permission preset for newly created user Agents. */
export const QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD = 'defaultAgentPermission';
/** Field carrying an optional registered Host Workspace for new plugin Sessions. */
export const QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD = 'defaultWorkspaceId';
/** Default scale for both QuantSkills surfaces. */
export const DEFAULT_QUANTSKILLS_SCALE = 1;
/** Default brightness for stock conversation text. */
export const DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 1;
/** Default opacity of the foreground surface above a conversation background. */
export const DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = 0.92;
/** Palette used until the user selects the other QuantSkills appearance. */
export const DEFAULT_QUANTSKILLS_COLOR_SCHEME = 'dark';
/** Background used with the light palette until the user selects another. */
export const DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND = 'launch';
/** Background used with the dark palette until the user selects another. */
export const DEFAULT_QUANTSKILLS_DARK_BACKGROUND = 'motion-minimal-blue';
/** Default background catalog policy. */
export const DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG = true;
/** Default Panda preflight policy. */
export const DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA = true;
/** Default Panda task-resume policy. */
export const DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN = true;
/** Permission applied to newly created Agents until the user chooses another default. */
export const DEFAULT_QUANTSKILLS_AGENT_PERMISSION = 'workspace-write';
/** Minimum scale exposed by the QuantSkills appearance controls. */
export const MIN_QUANTSKILLS_SCALE = 0.6;
/** Maximum scale exposed by the QuantSkills appearance controls. */
export const MAX_QUANTSKILLS_SCALE = 1.5;
/** Minimum brightness exposed by the QuantSkills appearance controls. */
export const MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 0.6;
/** Maximum brightness exposed by the QuantSkills appearance controls. */
export const MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 1;
/** Minimum foreground-surface opacity exposed by the QuantSkills appearance controls. */
export const MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = 0;
/** Maximum foreground-surface opacity exposed by the QuantSkills appearance controls. */
export const MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = 1;
/** Durable QuantSkills preference schema. */
export const QuantSkillsSettingsSchema = z.object({
    artifactPalette: z.string().max(2000).required(false),
    [QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD]: z.string().min(1).required(false),
    [QUANTSKILLS_INTERFACE_SCALE_FIELD]: z.number()
        .min(MIN_QUANTSKILLS_SCALE)
        .max(MAX_QUANTSKILLS_SCALE)
        .default(DEFAULT_QUANTSKILLS_SCALE),
    [QUANTSKILLS_CONVERSATION_SCALE_FIELD]: z.number()
        .min(MIN_QUANTSKILLS_SCALE)
        .max(MAX_QUANTSKILLS_SCALE)
        .default(DEFAULT_QUANTSKILLS_SCALE),
    [QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD]: z.number()
        .min(MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS)
        .max(MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS)
        .default(DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS),
    [QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD]: z.number()
        .min(MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY)
        .max(MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY)
        .default(DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY),
    [QUANTSKILLS_COLOR_SCHEME_FIELD]: z.union(['light', 'dark']).default(DEFAULT_QUANTSKILLS_COLOR_SCHEME),
    [QUANTSKILLS_LIGHT_BACKGROUND_FIELD]: z.union([
        'motion-glass-blue', 'motion-glass-ink',
        'motion-cosmos', 'motion-ocean', 'motion-meadow', 'motion-jiangnan', 'motion-cyber',
        'none', 'launch', 'network-sphere', 'astronaut-visor', 'astronaut',
    ]).default(DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND),
    [QUANTSKILLS_DARK_BACKGROUND_FIELD]: z.union([
        'motion-glass-rain',
        'motion-minimal-blue', 'motion-minimal-jade', 'motion-minimal-copper',
        'motion-cosmos', 'motion-ocean', 'motion-meadow', 'motion-jiangnan', 'motion-cyber',
        'none', 'moon-observer', 'moonwalker', 'orbital-rings', 'astronaut-visor',
    ]).default(DEFAULT_QUANTSKILLS_DARK_BACKGROUND),
    [QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD]: z.boolean().default(DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG),
    [QUANTSKILLS_AUTO_CHECK_PANDA_FIELD]: z.boolean().default(DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA),
    [QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD]: z.boolean().default(DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN),
    [QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD]: z.array(z.string().min(1).max(200)).max(500).default([]),
    [QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD]: z.array(z.object({
        assetId: z.string().min(1).max(200),
        displayName: z.string().min(1).max(80),
    })).max(500).default([]),
    [QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD]: z.string().max(200).default(''),
    [QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD]: z.string().max(400).default(''),
    [QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD]: z.string().max(100).default(''),
    [QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD]: z.union([
        'read-only', 'workspace-write', 'danger-full-access',
    ]).default(DEFAULT_QUANTSKILLS_AGENT_PERMISSION),
});
//# sourceMappingURL=appearance-settings.js.map