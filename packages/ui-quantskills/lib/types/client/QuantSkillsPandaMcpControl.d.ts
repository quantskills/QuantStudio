/** Compact PandaData MCP status and connection control for QuantSkills conversation surfaces. */
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { HeroAccessoryOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { PandaMcpStatus } from './plugin-types.ts';
import type { QuantSkillsConversationBrandInjected } from './QuantSkillsBrand.tsx';
/** Host and QuantSkills state required by the composer PandaData control. */
export interface QuantSkillsPandaMcpControlInjected extends QuantSkillsConversationBrandInjected {
    status: () => Promise<PandaMcpStatus>;
    authenticate: () => Promise<PandaMcpStatus>;
    refresh: () => Promise<PandaMcpStatus>;
    logout: () => Promise<PandaMcpStatus>;
}
/** Complete props for the composer PandaData integration control. */
export type QuantSkillsPandaMcpControlProps = PropsRuntime<'conversation.input.left'> & InjectFace<QuantSkillsPandaMcpControlInjected>;
/** Complete props for the blank-session Hero PandaData integration control. */
export type QuantSkillsPandaMcpHeroControlProps = HeroAccessoryOwnerProps & InjectFace<QuantSkillsPandaMcpControlInjected>;
/** Render PandaData beside the blank-session preset selector. */
export declare function QuantSkillsPandaMcpHeroControl({ mode, useView, status, authenticate, refresh, logout, }: QuantSkillsPandaMcpHeroControlProps): import("react").JSX.Element;
/** Render PandaData in the composer after conversation activity begins. */
export declare function QuantSkillsPandaMcpControl({ mode, useView, useConversation, session, status, authenticate, refresh, logout, }: QuantSkillsPandaMcpControlProps): import("react").JSX.Element;
//# sourceMappingURL=QuantSkillsPandaMcpControl.d.ts.map