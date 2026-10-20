import type { UserTextDocumentInput, UserTextNode, UserTextRule } from '../contract/user-text.ts';
/** Data-layer cache owned by one caller; initialization and refresh share one reconciliation. */
export declare class UserTextDocument {
    private text;
    private rules;
    private initial;
    private output;
    private readonly matchers;
    private complete;
    private evaluating;
    /**
     * Reconcile original text using current rule definitions and valid query records.
     * @param input - original text and readonly Facts, compared by fields actually read.
     * @param rules - unique definitions ordered by ascending order and stable ID.
     * @returns complete readonly nodes; failures retain caches but publish no partial result.
     */
    evaluate(input: UserTextDocumentInput, rules: readonly UserTextRule[]): readonly UserTextNode[];
    private prepare;
    private reconcile;
}
//# sourceMappingURL=user-text-document.d.ts.map