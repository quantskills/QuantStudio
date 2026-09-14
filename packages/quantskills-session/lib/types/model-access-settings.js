export const MODEL_ACCESS_NS = 'quantskills-model-services';
/** Auto admission is explicit: an exact route must be verified and user-approved. */
export function modelAllowedForAuto(ctx, provider, model) {
    // The product profile intentionally persists blank placeholders before a
    // person chooses a default. They are not legacy provider routes.
    if (provider.trim().length === 0 || (model !== undefined && model.trim().length === 0))
        return false;
    const policy = ctx.get('settings')?.get(MODEL_ACCESS_NS)?.connections?.[provider];
    return policy !== undefined && policy.auto && policy.state === 'verified'
        && (model === undefined || policy.verifiedModels.includes(model));
}
//# sourceMappingURL=model-access-settings.js.map