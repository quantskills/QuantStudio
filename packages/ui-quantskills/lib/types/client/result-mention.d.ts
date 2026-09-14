/** Capture clickable Assistant file mentions before the generic workspace opener. */
/** Callback used to hand a resolved result mention to the owning application. */
export type QuantSkillsResultMentionOpen = (path: string, trigger: HTMLButtonElement) => boolean;
/**
 * Route inline-code file mentions into the QuantSkills result workbench.
 *
 * The shared Markdown renderer owns the button and normally opens the file in
 * the Host. QuantSkills handles only mentions accepted by `open`; rejected
 * paths keep the shared behavior.
 * @param document - Browser document containing the conversation transcript.
 * @param open - Result-workbench opener; return true when the click is owned.
 * @returns disposer for the capture listener.
 */
export declare function bindQuantSkillsResultMentionClicks(document: Document, open: QuantSkillsResultMentionOpen): () => void;
//# sourceMappingURL=result-mention.d.ts.map