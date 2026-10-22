import s from "@deepseek-ai/schemastery";
//#region packages/quantskills-session/lib/types/model-policy.js
const name = "quantskills-model-services";
const Config = s.object({ connections: s.dict(s.object({
	service: s.string(),
	auto: s.boolean().default(false),
	state: s.string(),
	message: s.string(),
	verifiedModels: s.array(s.string())
})).default({}) }).volatile();
function apply(_ctx) {}
//#endregion
export { Config, apply, name };
