import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path';
export const QS_RESULTS_KIND = 'quantskills-results';
/** Refuse stale session callbacks; never borrow the currently visible session's paths. */
export function openNativeResult(sidebar, sessionId, cwd, path) {
    if (sidebar === undefined || sidebar.mounted.getSnapshot() !== sessionId)
        return false;
    if (path === undefined)
        sidebar.openTab(QS_RESULTS_KIND);
    else
        sidebar.openResource(fileAddressFor(sessionId, cwd, path));
    return true;
}
//# sourceMappingURL=native-result-navigation.js.map