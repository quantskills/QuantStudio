/** Whitespace candidates use the same cursor, priority and Facts cache as reference candidates. */
import type { UserTextRule } from '../contract/user-text.ts';
/** Offer the next whitespace run whose display collapses to one space. */
export declare const collapseWhitespaceRule: UserTextRule<'text.collapse-whitespace'>;
/** Offer original document-edge whitespace, winning same-start collisions with collapse. */
export declare const trimWhitespaceRule: UserTextRule<'text.trim-whitespace'>;
//# sourceMappingURL=whitespace-rules.d.ts.map