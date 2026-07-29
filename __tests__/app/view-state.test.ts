import { describe, expect, it } from 'vitest';
import { initialViewState, stateForPresentation } from '../../src/app/models/view-state.js';

describe('shortlist view state', () => {
  it('survives a remount of the same presentation', () => {
    const persisted = {
      ...initialViewState('presentation-a', 5),
      selectedKey: 'ca:123',
      visibleCount: 7,
      expandedDescriptionKey: 'ca:123',
    };

    expect(stateForPresentation(persisted, 'presentation-a', 3)).toBe(persisted);
  });

  it('resets navigation for a new presentation', () => {
    const persisted = {
      ...initialViewState('presentation-a', 5),
      selectedKey: 'ca:123',
      visibleCount: 7,
    };

    expect(stateForPresentation(persisted, 'presentation-b', 3)).toEqual(
      initialViewState('presentation-b', 3),
    );
  });
});
