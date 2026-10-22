import dsh_experimental_agent_team_default, { TeamError, TeamId, TeamMessageId, TeamService, TeamTaskId } from "@deepseek-ai/dsh-experimental-agent-team";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
//#region packages/agent-team/lib/types/legacy-mailbox.js
const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function classifyLegacyMessages(events, receivers) {
	const queued = /* @__PURE__ */ new Map(), receipts = /* @__PURE__ */ new Map();
	const unknown = [], receiptRecords = [];
	for (const event of events) {
		const data = event.data;
		if (!record(data) || ![1, 2].includes(data.version) || typeof data.teamId !== "string") {
			unknown.push(event);
			continue;
		}
		if (event.type === "team/message/queued" && record(data.message)) {
			const message = data.message;
			if (![
				"id",
				"senderId",
				"targetId"
			].every((key) => typeof message[key] === "string" && message[key])) {
				unknown.push(event);
				continue;
			}
			const key = `${data.teamId}\0${message.id}`;
			if (queued.has(key)) {
				queued.get(key).status = "needs-confirmation";
				unknown.push(event);
				continue;
			}
			queued.set(key, {
				teamId: data.teamId,
				messageId: message.id,
				senderId: message.senderId,
				targetId: message.targetId,
				status: "pending-recovery",
				original: data.message
			});
		} else if (event.type === "team/message/delivered" && typeof data.messageId === "string" && typeof data.targetId === "string") {
			const key = `${data.teamId}\0${data.messageId}`, targets = receipts.get(key) ?? /* @__PURE__ */ new Set();
			targets.add(data.targetId);
			receipts.set(key, targets);
			receiptRecords.push(event);
		} else unknown.push(event);
	}
	for (const [key, item] of queued) {
		const receipt = receipts.get(key), receiver = receivers.get(item.targetId);
		const matches = [...receivers].flatMap(([target, evidence]) => evidence.accepted.filter((value) => value.teamId === item.teamId && value.messageId === item.messageId).map((value) => ({
			target,
			sender: value.senderId
		})));
		const accepted = matches.some((value) => value.target === item.targetId && value.sender === item.senderId);
		const contradictory = matches.some((value) => value.target !== item.targetId || value.sender !== item.senderId);
		if (item.status === "needs-confirmation" || contradictory || receipt && (receipt.size !== 1 || !receipt.has(item.targetId))) item.status = "needs-confirmation";
		else if (receipt?.has(item.targetId) || accepted) item.status = "delivered";
		else if (receiver?.complete !== true) item.status = "needs-confirmation";
	}
	for (const event of receiptRecords) {
		const data = event.data;
		if (!queued.has(`${data.teamId}\0${data.messageId}`)) unknown.push(event);
	}
	return {
		messages: [...queued.values()],
		unknown
	};
}
//#endregion
//#region packages/agent-team/lib/types/legacy-recovery.js
/** Explicit, durable recovery coordinator; no startup hook and no second Team service. */
const digest = (value) => createHash("sha256").update(value).digest("hex");
var LegacyTeamRecovery = class {
	directory;
	constructor(directory) {
		this.directory = directory;
	}
	/** Read-only inspection also honors a previously interrupted acceptance attempt. */
	async audit(teamId, events, receivers) {
		const classified = classifyLegacyMessages(events, receivers);
		const path = join(this.directory, `${digest(teamId)}.json`);
		try {
			if ((await lstat(this.directory)).isSymbolicLink()) throw new Error("Linked recovery journal directory refused.");
			if ((await lstat(path)).isSymbolicLink()) throw new Error("Linked recovery journal refused.");
			const journal = JSON.parse(await readFile(path, "utf8"));
			if (journal.version !== 1 || journal.teamId !== teamId || journal.inputHash !== digest(JSON.stringify(events)) || JSON.stringify(journal.unknown) !== JSON.stringify(classified.unknown) || !Array.isArray(journal.messages) || journal.messages.length !== classified.messages.length) throw new Error("Recovery journal differs from preserved history.");
			for (const item of classified.messages) {
				const previous = journal.messages.find((value) => value.messageId === item.messageId && value.teamId === item.teamId);
				if (!previous || previous.correlation !== digest(`${teamId}\0${item.messageId}\0${item.targetId}`) || previous.senderId !== item.senderId || previous.targetId !== item.targetId || ![
					"delivered",
					"pending-recovery",
					"needs-confirmation"
				].includes(previous.status) || previous.attempt !== void 0 && !["started", "verified"].includes(previous.attempt) || JSON.stringify(previous.original) !== JSON.stringify(item.original)) throw new Error("Invalid recovery journal entry.");
				if (item.status === "pending-recovery" && (previous.attempt !== void 0 || previous.status !== "pending-recovery")) item.status = "needs-confirmation";
			}
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		return classified;
	}
	/** Called only by an explicit user continuation, never by Agent construction or replay. */
	async continue(teamId, events, port, authorization) {
		if (authorization?.userContinued !== true) throw new Error("Legacy message recovery requires explicit user continuation.");
		await mkdir(this.directory, {
			recursive: true,
			mode: 448
		});
		if ((await lstat(this.directory)).isSymbolicLink()) throw new Error("Linked recovery journal directory refused.");
		const key = digest(teamId), path = join(this.directory, `${key}.json`), lockPath = `${path}.lock`;
		const lock = await open(lockPath, "wx", 384);
		try {
			await lock.writeFile(JSON.stringify({
				pid: process.pid,
				teamId
			}));
			await lock.sync();
			const inputHash = digest(JSON.stringify(events));
			const receiverIds = /* @__PURE__ */ new Set();
			for (const event of events) {
				const value = event.data;
				if (typeof value?.message?.targetId === "string") receiverIds.add(value.message.targetId);
			}
			const readReceivers = async () => new Map(await Promise.all([...receiverIds].map(async (id) => [id, await port.evidence(id)])));
			const classified = classifyLegacyMessages(events, await readReceivers());
			let journal;
			try {
				if ((await lstat(path)).isSymbolicLink()) throw new Error("Linked recovery journal refused.");
				journal = JSON.parse(await readFile(path, "utf8"));
				if (journal.version !== 1 || journal.teamId !== teamId || journal.inputHash !== inputHash || JSON.stringify(journal.unknown) !== JSON.stringify(classified.unknown) || !Array.isArray(journal.messages) || journal.messages.length !== classified.messages.length) throw new Error("Recovery journal differs from preserved history.");
				for (const item of journal.messages) {
					const original = classified.messages.find((message) => message.messageId === item.messageId && message.teamId === item.teamId);
					if (!original || item.correlation !== digest(`${teamId}\0${item.messageId}\0${item.targetId}`) || original.senderId !== item.senderId || original.targetId !== item.targetId || JSON.stringify(original.original) !== JSON.stringify(item.original) || ![
						"delivered",
						"pending-recovery",
						"needs-confirmation"
					].includes(item.status) || item.attempt !== void 0 && !["started", "verified"].includes(item.attempt)) throw new Error("Invalid recovery journal entry.");
				}
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
				journal = {
					version: 1,
					teamId,
					inputHash,
					unknown: classified.unknown,
					messages: classified.messages.map((item) => ({
						...item,
						correlation: digest(`${teamId}\0${item.messageId}\0${item.targetId}`)
					}))
				};
			}
			const save = async () => {
				const temporary = `${path}.${randomUUID()}.tmp`;
				const file = await open(temporary, "wx", 384);
				try {
					await file.writeFile(JSON.stringify(journal, null, 2));
					await file.sync();
				} finally {
					await file.close();
				}
				await rename(temporary, path);
			};
			await save();
			for (const item of journal.messages) {
				const fresh = classifyLegacyMessages(events, await readReceivers()).messages.find((value) => value.teamId === item.teamId && value.messageId === item.messageId);
				if (fresh.status === "needs-confirmation") {
					item.status = fresh.status;
					await save();
					continue;
				}
				if (fresh.status === "delivered") {
					item.status = "delivered";
					item.attempt = "verified";
					await save();
					continue;
				}
				if (item.status === "delivered" || item.status === "needs-confirmation") continue;
				if (item.attempt === "started") {
					item.status = "needs-confirmation";
					await save();
					continue;
				}
				item.attempt = "started";
				await save();
				try {
					await port.deliver(item, item.correlation);
				} catch {}
				item.status = classifyLegacyMessages(events, await readReceivers()).messages.find((value) => value.teamId === item.teamId && value.messageId === item.messageId).status === "delivered" ? "delivered" : "needs-confirmation";
				if (item.status === "delivered") item.attempt = "verified";
				await save();
			}
			return structuredClone(journal);
		} finally {
			await lock.close();
			await rm(lockPath);
		}
	}
};
//#endregion
export { LegacyTeamRecovery, TeamError, TeamId, TeamMessageId, TeamService, TeamTaskId, classifyLegacyMessages, dsh_experimental_agent_team_default as default };
