import { C as parseQuantSkillsPlainSessionBinding, S as parseQuantSkillsPandaRuntimeBinding, b as parseQuantSkillsAgentTeamSession, c as foldQuantSkillsAgentSession, d as foldQuantSkillsAuthoringCommitted, f as foldQuantSkillsAuthoringStarted, g as foldQuantSkillsSessionBinding, h as foldQuantSkillsResidentSkills, l as foldQuantSkillsAgentTeamMemberSession, m as foldQuantSkillsPlainSessionBinding, p as foldQuantSkillsPandaRuntimeBinding, u as foldQuantSkillsAgentTeamSession, v as parseQuantSkillsAgentSession, w as parseQuantSkillsSessionBinding, x as parseQuantSkillsAuthoringCommitted, y as parseQuantSkillsAgentTeamMemberSession } from "./types-BcxMMMn_.js";
//#region lib/types/invariant.js
/** Package-owned invariant companion. @module @deepseek-ai/dsh-quantskills-session/invariant */
const PACKAGE_NAME = "@deepseek-ai/dsh-quantskills-session";
/** Cordis companion plugin name. */
const name = "quantskills-session-invariant";
/** Services required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** Validate binding payloads and the once-only relationship before append publication. */
const install = Object.assign((ctx, fail) => {
	const validateSession = (session) => {
		try {
			const binding = foldQuantSkillsSessionBinding(session.events);
			const plain = foldQuantSkillsPlainSessionBinding(session.events);
			const agent = foldQuantSkillsAgentSession(session.events);
			const team = foldQuantSkillsAgentTeamSession(session.events);
			const member = foldQuantSkillsAgentTeamMemberSession(session.events);
			const authoring = foldQuantSkillsAuthoringStarted(session.events);
			foldQuantSkillsResidentSkills(session.events);
			foldQuantSkillsPandaRuntimeBinding(session.events);
			foldQuantSkillsAuthoringCommitted(session.events);
			if ([
				plain,
				binding,
				agent,
				team,
				member
			].filter((value) => value !== null).length > 1) fail("session cannot mix plain, Skill, Agent, or Agent Team QuantSkills bindings");
			if (authoring !== null && agent === null) fail("QuantSkills authoring purpose requires an Agent composition");
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	};
	for (const session of ctx.sessions.list()) validateSession(session);
	ctx.on("session/created", validateSession);
	ctx.on("internal/dispatch", (_mode, eventName, args) => {
		if (eventName !== "session/event") return;
		const [session, event] = args;
		if (event.type !== "quantskills/plain-session" && event.type !== "quantskills/session-bound" && event.type !== "quantskills/agent-session" && event.type !== "quantskills/agent-team-session" && event.type !== "quantskills/agent-team-member" && event.type !== "quantskills/resident-skill-changed" && event.type !== "panda/runtime-bound" && event.type !== "quantskills/authoring-started" && event.type !== "quantskills/authoring-committed") return;
		try {
			if (event.type === "quantskills/plain-session") {
				parseQuantSkillsPlainSessionBinding(event.data);
				if (foldQuantSkillsPlainSessionBinding(session.events) !== null) fail("session may contain only one quantskills/plain-session event");
				if (foldQuantSkillsSessionBinding(session.events) !== null || foldQuantSkillsAgentSession(session.events) !== null || foldQuantSkillsAgentTeamSession(session.events) !== null || foldQuantSkillsAgentTeamMemberSession(session.events) !== null) fail("plain QuantSkills session cannot mix with a frozen asset composition");
			} else if (event.type === "quantskills/session-bound") {
				parseQuantSkillsSessionBinding(event.data);
				if (foldQuantSkillsPlainSessionBinding(session.events) !== null || foldQuantSkillsAgentSession(session.events) !== null) fail("session cannot mix Skill and Agent QuantSkills bindings or a plain QuantSkills identity");
				if (foldQuantSkillsSessionBinding(session.events) !== null) fail("session may contain only one quantskills/session-bound event");
			} else if (event.type === "quantskills/agent-session") {
				parseQuantSkillsAgentSession(event.data);
				if (foldQuantSkillsPlainSessionBinding(session.events) !== null || foldQuantSkillsSessionBinding(session.events) !== null) fail("session cannot mix Skill and Agent QuantSkills bindings or a plain QuantSkills identity");
				if (foldQuantSkillsAgentSession(session.events) !== null) fail("session may contain only one quantskills/agent-session event");
			} else if (event.type === "quantskills/agent-team-session") {
				parseQuantSkillsAgentTeamSession(event.data);
				if (foldQuantSkillsPlainSessionBinding(session.events) !== null || foldQuantSkillsSessionBinding(session.events) !== null || foldQuantSkillsAgentSession(session.events) !== null || foldQuantSkillsAgentTeamMemberSession(session.events) !== null) fail("Agent Team Session cannot mix with another QuantSkills base identity");
				if (foldQuantSkillsAgentTeamSession(session.events) !== null) fail("session may contain only one quantskills/agent-team-session event");
			} else if (event.type === "quantskills/agent-team-member") {
				parseQuantSkillsAgentTeamMemberSession(event.data);
				if (foldQuantSkillsPlainSessionBinding(session.events) !== null || foldQuantSkillsSessionBinding(session.events) !== null || foldQuantSkillsAgentSession(session.events) !== null) fail("Agent Team member cannot mix with another QuantSkills base identity");
				if (foldQuantSkillsAgentTeamMemberSession(session.events) !== null) fail("session may contain only one quantskills/agent-team-member event");
			} else if (event.type === "panda/runtime-bound") {
				parseQuantSkillsPandaRuntimeBinding(event.data);
				if (foldQuantSkillsPandaRuntimeBinding(session.events) !== null) fail("session may contain only one panda/runtime-bound event");
			} else if (event.type === "quantskills/authoring-started") foldQuantSkillsAuthoringStarted([...session.events, event]);
			else if (event.type === "quantskills/authoring-committed") {
				parseQuantSkillsAuthoringCommitted(event.data);
				if (foldQuantSkillsAuthoringStarted(session.events) === null) fail("QuantSkills authoring commit requires an authoring purpose");
				foldQuantSkillsAuthoringCommitted([...session.events, event]);
			} else foldQuantSkillsResidentSkills([...session.events, event]);
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	}, { global: true });
}, { inject: ["sessions"] });
/**
* Register this package's invariant companion.
* @param ctx - Context carrying the invariant registry.
* @returns the registration disposer.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
