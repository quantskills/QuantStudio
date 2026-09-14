import type { HeroBrandMarkOwnerProps, HeroIdentityOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ConversationLabelOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client';
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import { createQuantSkillsViewStore } from './store.ts';
type QuantSkillsBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps;
type ViewStore = ReturnType<typeof createQuantSkillsViewStore>;
type ViewInstance = ReturnType<ViewStore['create']>;
/** State supplied to conversation branding registered by the QuantSkills application. */
export interface QuantSkillsConversationBrandInjected {
    /** Standalone always owns its conversation; native-plugin owns it only while its conversation view is open. */
    mode: 'standalone' | 'native-plugin';
    hooks: {
        view: ViewInstance['store'];
    };
}
type QuantSkillsConversationHeroIdentityProps = HeroIdentityOwnerProps & InjectFace<QuantSkillsConversationBrandInjected>;
type QuantSkillsConversationStatusProps = ConversationLabelOwnerProps & InjectFace<QuantSkillsConversationBrandInjected>;
/**
 * Replace the stock DSH document icon and application manifest for this client lifetime.
 * @returns A disposer that restores the Host document metadata.
 */
export declare function installQuantSkillsDocumentBrand(): () => void;
/**
 * Render the compact QuantSkills mark at the size requested by its host surface.
 * @param props - Host-supplied square size and optional presentation class.
 * @returns The QuantSkills mark image.
 */
export declare function QuantSkillsBrandMark({ size, className }: QuantSkillsBrandMarkProps): import("react").JSX.Element;
/**
 * Replace the native empty-session identity only while QuantSkills owns the conversation.
 * @param props - Native fallback presentation plus QuantSkills view state.
 * @returns The native or QuantSkills identity in the host's layout.
 */
export declare function QuantSkillsConversationHeroIdentity({ mode, useView, defaultMark, defaultHeadline, size, className, renderIdentity, }: QuantSkillsConversationHeroIdentityProps): import("react").JSX.Element;
/**
 * Replace the generic live-turn label only while QuantSkills owns the conversation.
 * @param props - Native fallback label plus QuantSkills view state.
 * @returns The native or QuantSkills activity label.
 */
export declare function QuantSkillsConversationStatus({ mode, useView, defaultLabel, }: QuantSkillsConversationStatusProps): import("react").JSX.Element;
/**
 * Render the endorsed QuantSkills lockup where width permits.
 * @returns The QuantSkills lockup with its PandaAI endorsement.
 */
export declare function QuantSkillsBrandLockup(): import("react").JSX.Element;
export {};
//# sourceMappingURL=QuantSkillsBrand.d.ts.map