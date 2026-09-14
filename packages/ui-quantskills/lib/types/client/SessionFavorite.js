import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StarIcon } from '@phosphor-icons/react';
import css from './QuantSkillsApp.module.css';
/** Favorite the owning capability, so every future session can reuse it. */
export function SessionFavorite({ useSessions, useView, useAgents, useSkills, toggle }) {
    const current = useSessions(state => state.current);
    const agent = useAgents(state => state.archives.find(item => item.sessionId === current)?.agent);
    const team = useAgents(state => state.teamArchives.find(item => item.sessionId === current)?.team);
    const skill = useSkills(state => state.archives.find(item => item.sessionId === current)?.binding);
    const favorites = useView(state => state.favoriteAssetIds);
    const writable = useView(state => state.settingsWritable);
    const internal = useAgents(state => state.librarySources?.some(item => item.id === agent?.agentId && item.source === 'internal'));
    const id = team ? `team:${team.teamId}` : agent && !internal ? `agent:${agent.agentId}` : skill?.assetId;
    if (!id)
        return null;
    const active = favorites.includes(id);
    return _jsxs("button", { type: "button", className: css.reviewTrigger, "aria-label": active ? '取消收藏当前能力' : '收藏当前能力', "aria-pressed": active, disabled: !writable, title: "\u6536\u85CF\u540E\uFF0C\u53EF\u5728\u6536\u85CF\u680F\u7EE7\u7EED\u5BF9\u8BDD\u6216\u5F00\u59CB\u65B0\u4EFB\u52A1", onClick: () => toggle(active ? favorites.filter(item => item !== id) : [...favorites, id]), children: [_jsx(StarIcon, { weight: active ? 'fill' : 'regular' }), active ? '已收藏' : '收藏'] });
}
//# sourceMappingURL=SessionFavorite.js.map