export interface ShortlistViewState {
  [key: string]: unknown;
  presentationId: string;
  selectedKey: string | null;
  visibleCount: number;
  expandedDescriptionKey: string | null;
}

export function initialViewState(presentationId: string, visibleCount: number): ShortlistViewState {
  return {
    presentationId,
    selectedKey: null,
    visibleCount,
    expandedDescriptionKey: null,
  };
}

export function stateForPresentation(
  persisted: ShortlistViewState,
  presentationId: string,
  visibleCount: number,
): ShortlistViewState {
  return persisted.presentationId === presentationId
    ? persisted
    : initialViewState(presentationId, visibleCount);
}
