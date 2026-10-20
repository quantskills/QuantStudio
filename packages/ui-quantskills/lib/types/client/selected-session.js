/** The official main-view reference owns selection; catalog membership alone does not. */
export function selectedSession(state) {
    return Object.values(state.byId).find(item => (item.retainedBy.mainView ?? 0) > 0)?.id;
}
//# sourceMappingURL=selected-session.js.map