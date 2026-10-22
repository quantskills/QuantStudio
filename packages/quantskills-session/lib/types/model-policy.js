import s from '@deepseek-ai/schemastery';
export const name = 'quantskills-model-services';
export const Config = s.object({ connections: s.dict(s.object({
        service: s.string(), auto: s.boolean().default(false), state: s.string(), message: s.string(), verifiedModels: s.array(s.string()),
    })).default({}) }).volatile();
export function apply(_ctx) { }
//# sourceMappingURL=model-policy.js.map