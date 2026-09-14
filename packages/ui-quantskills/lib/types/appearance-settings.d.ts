/** QuantSkills application preferences stored in the Host user-settings document. */
import z from '@deepseek-ai/schemastery';
/** Settings namespace owned by the QuantSkills application. */
export declare const QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE = "ui-quantskills";
/** Field carrying the application chrome scale. */
export declare const QUANTSKILLS_INTERFACE_SCALE_FIELD = "interfaceScale";
/** Field carrying the stock conversation text scale. */
export declare const QUANTSKILLS_CONVERSATION_SCALE_FIELD = "conversationScale";
/** Field carrying the stock conversation text brightness. */
export declare const QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD = "conversationBrightness";
/** Field carrying the opacity of the foreground surface above conversation backgrounds. */
export declare const QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD = "conversationOverlayOpacity";
/** Field carrying the QuantSkills-owned palette independent from the Host theme. */
export declare const QUANTSKILLS_COLOR_SCHEME_FIELD = "colorScheme";
/** Field carrying the selected light-palette background. */
export declare const QUANTSKILLS_LIGHT_BACKGROUND_FIELD = "lightBackground";
/** Field carrying the selected dark-palette background. */
export declare const QUANTSKILLS_DARK_BACKGROUND_FIELD = "darkBackground";
/** Field controlling background catalog checks after the required initial load. */
export declare const QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD = "autoCheckCatalog";
/** Field controlling preflight authentication checks for Panda-dependent assets. */
export declare const QUANTSKILLS_AUTO_CHECK_PANDA_FIELD = "autoCheckPanda";
/** Field controlling whether a Panda-gated action resumes after successful login. */
export declare const QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD = "resumeAfterPandaLogin";
/** Field carrying the user's durable QuantSkills favorites. */
export declare const QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD = "favoriteAssetIds";
/** Field carrying user-local catalog display-name overrides. */
export declare const QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD = "assetDisplayNameOverrides";
/** Field carrying the default provider for newly created user Agents. */
export declare const QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD = "defaultAgentProvider";
/** Field carrying the default model for newly created user Agents. */
export declare const QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD = "defaultAgentModel";
/** Field carrying the default reasoning effort for newly created user Agents. */
export declare const QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD = "defaultAgentReasoningEffort";
/** Field carrying the default permission preset for newly created user Agents. */
export declare const QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD = "defaultAgentPermission";
/** Field carrying an optional registered Host Workspace for new plugin Sessions. */
export declare const QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD = "defaultWorkspaceId";
/** Default scale for both QuantSkills surfaces. */
export declare const DEFAULT_QUANTSKILLS_SCALE = 1;
/** Default brightness for stock conversation text. */
export declare const DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 1;
/** Default opacity of the foreground surface above a conversation background. */
export declare const DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = 0.92;
/** Palette used until the user selects the other QuantSkills appearance. */
export declare const DEFAULT_QUANTSKILLS_COLOR_SCHEME: "dark";
/** Background used with the light palette until the user selects another. */
export declare const DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND: "launch";
/** Background used with the dark palette until the user selects another. */
export declare const DEFAULT_QUANTSKILLS_DARK_BACKGROUND: "motion-minimal-blue";
/** Default background catalog policy. */
export declare const DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG = true;
/** Default Panda preflight policy. */
export declare const DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA = true;
/** Default Panda task-resume policy. */
export declare const DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN = true;
/** Permission applied to newly created Agents until the user chooses another default. */
export declare const DEFAULT_QUANTSKILLS_AGENT_PERMISSION: "workspace-write";
/** Minimum scale exposed by the QuantSkills appearance controls. */
export declare const MIN_QUANTSKILLS_SCALE = 0.6;
/** Maximum scale exposed by the QuantSkills appearance controls. */
export declare const MAX_QUANTSKILLS_SCALE = 1.5;
/** Minimum brightness exposed by the QuantSkills appearance controls. */
export declare const MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 0.6;
/** Maximum brightness exposed by the QuantSkills appearance controls. */
export declare const MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS = 1;
/** Minimum foreground-surface opacity exposed by the QuantSkills appearance controls. */
export declare const MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = 0;
/** Maximum foreground-surface opacity exposed by the QuantSkills appearance controls. */
export declare const MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY = 1;
/** Permission presets available as defaults for newly created QuantSkills Agents. */
export type QuantSkillsDefaultAgentPermission = 'read-only' | 'workspace-write' | 'danger-full-access';
/** Palette applied only to QuantSkills-owned surfaces. */
export type QuantSkillsColorScheme = 'light' | 'dark';
/** Backgrounds available for the light QuantSkills palette. */
export type QuantSkillsLightBackground = 'motion-glass-blue' | 'motion-glass-ink' | 'motion-cosmos' | 'motion-ocean' | 'motion-meadow' | 'motion-jiangnan' | 'motion-cyber' | 'none' | 'launch' | 'network-sphere' | 'astronaut-visor' | 'astronaut';
/** Backgrounds available for the dark QuantSkills palette. */
export type QuantSkillsDarkBackground = 'motion-glass-rain' | 'motion-minimal-blue' | 'motion-minimal-jade' | 'motion-minimal-copper' | 'motion-cosmos' | 'motion-ocean' | 'motion-meadow' | 'motion-jiangnan' | 'motion-cyber' | 'none' | 'moon-observer' | 'moonwalker' | 'orbital-rings' | 'astronaut-visor';
/** One user-local name that never changes the stable catalog asset id. */
export interface QuantSkillsAssetDisplayNameOverride {
    assetId: string;
    displayName: string;
}
/** Durable QuantSkills preference section shared by Host and browser. */
export interface QuantSkillsSettings {
    /** Sanitized semantic colors used when generating artifacts. Synced from the rendered theme. */
    artifactPalette?: string;
    /** Optional registered Host Workspace; absent selects the plugin-managed default. */
    defaultWorkspaceId?: string;
    /** Scale applied to the application chrome. */
    interfaceScale: number;
    /** Scale applied to stock conversation content. */
    conversationScale: number;
    /** Brightness applied to stock conversation content. */
    conversationBrightness: number;
    /** Opacity of the foreground surface above stock conversation backgrounds. */
    conversationOverlayOpacity: number;
    /** Palette applied only to QuantSkills-owned surfaces. */
    colorScheme: QuantSkillsColorScheme;
    /** Background paired with the light palette. */
    lightBackground: QuantSkillsLightBackground;
    /** Background paired with the dark palette. */
    darkBackground: QuantSkillsDarkBackground;
    /** Whether the client checks the public catalog on focus and the Host interval. */
    autoCheckCatalog: boolean;
    /** Whether Panda-dependent launches inspect the connector before creating a Session. */
    autoCheckPanda: boolean;
    /** Whether a Panda-dependent launch continues after the connector reports login success. */
    resumeAfterPandaLogin: boolean;
    /** Catalog asset ids shown on the real Favorites page. */
    favoriteAssetIds: string[];
    /** User-local names applied before catalog and declaration names. */
    assetDisplayNameOverrides: QuantSkillsAssetDisplayNameOverride[];
    /** Provider id applied to newly created Agents, or empty to follow the Session default. */
    defaultAgentProvider: string;
    /** Model id paired with {@link defaultAgentProvider}. */
    defaultAgentModel: string;
    /** Optional reasoning effort paired with the default model. */
    defaultAgentReasoningEffort: string;
    /** Permission preset applied to newly created Agents. */
    defaultAgentPermission: QuantSkillsDefaultAgentPermission;
}
/** Durable QuantSkills preference schema. */
export declare const QuantSkillsSettingsSchema: z<QuantSkillsSettings>;
//# sourceMappingURL=appearance-settings.d.ts.map