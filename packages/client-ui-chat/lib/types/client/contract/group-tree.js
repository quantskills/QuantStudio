const DEPTH = { exchange: 0, input: 1, turn: 2, process: 3 };
/**
 * Test whether a Node stands at a group-tree position or outside it.
 * @param node - Chat Node.
 * @param position - group-tree position to compare against.
 * @returns whether the Node's position is `position` or an outer one.
 */
export function isAtOrOutside(node, position) {
    return node.groupTree !== undefined && DEPTH[node.groupTree] <= DEPTH[position];
}
//# sourceMappingURL=group-tree.js.map