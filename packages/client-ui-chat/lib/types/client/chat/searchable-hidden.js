import { useEffect, useLayoutEffect, useRef } from 'react';
/**
 * Apply searchable hidden state without unmounting a stable subtree.
 * @param hidden - whether the subtree is currently hidden.
 * @param reveal - callback for browser find's beforematch reveal.
 * @param transition - optional caller-owned visibility operation; otherwise apply synchronously.
 * @returns ref for the stable subtree root.
 */
export function useSearchableHidden(hidden, reveal, transition) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (element === null)
            return;
        if (hidden && element.contains(element.ownerDocument.activeElement)) {
            reveal();
            return;
        }
        const commit = () => {
            if (hidden)
                element.setAttribute('hidden', 'until-found');
            else
                element.removeAttribute('hidden');
        };
        if (transition === undefined)
            commit();
        else
            transition(element, hidden, commit);
    }, [hidden, reveal, transition]);
    useEffect(() => {
        const element = ref.current;
        if (element === null)
            return;
        element.addEventListener('beforematch', reveal);
        return () => { element.removeEventListener('beforematch', reveal); };
    }, [reveal]);
    return ref;
}
//# sourceMappingURL=searchable-hidden.js.map