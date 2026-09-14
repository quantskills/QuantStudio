/** Minimal React selector binding for package-local component tests. */
import { useSyncExternalStore } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'

/** Bind an observable snapshot to the selector-hook interface used by DSH slots. */
export function bindSnapshotSelector<T>(source: ObservableSnapshot<T>): SnapshotSelectorHook<T> {
  return function useSelector<Selected>(selector: (snapshot: T) => Selected): Selected {
    return selector(useSyncExternalStore(
      listener => source.subscribe(listener),
      () => source.getSnapshot(),
    ))
  }
}
