import { useEffect, useRef, useState } from 'react';
import {
  useDisplayMode,
  useLayout,
  useOpenExternal,
  useToolInfo,
  useViewState,
} from 'skybridge/web';
import GrantResults, {
  GrantResultsLoading,
  GrantResultsMessage,
  itemKey,
} from '../../../components/grant-results.js';
import {
  initialViewState,
  stateForPresentation,
  type ShortlistViewState,
} from '../../../models/view-state.js';
import type {
  PresentShortlistInput,
  PresentShortlistOutput,
} from '../../../tools/present-shortlist.js';
import { visualTheme } from '../theme-config.js';

type JsonObject<T> = T & Record<string, unknown>;

export default function GrantResultsContainer() {
  const { theme, maxHeight, safeArea } = useLayout();
  const [hostDisplayMode, setHostDisplayMode] = useDisplayMode();
  const [displayModePending, setDisplayModePending] = useState(false);
  const [displayModeError, setDisplayModeError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const displayModeRequestRef = useRef(0);
  const openExternal = useOpenExternal();
  const tool = useToolInfo<{
    input: JsonObject<PresentShortlistInput>;
    output: JsonObject<PresentShortlistOutput>;
  }>();
  const initialVisibleCount = maxHeight && maxHeight < 650 ? 3 : 5;
  const [persistedState, setPersistedState] = useViewState<ShortlistViewState>(
    initialViewState('', initialVisibleCount),
  );
  const colorScheme = theme === 'dark' ? 'dark' : 'light';
  const insets = safeArea.insets;
  const displayMode =
    hostDisplayMode === 'inline' || hostDisplayMode === 'fullscreen' ? hostDisplayMode : null;

  const output = tool.isSuccess ? tool.output : null;
  const state = output
    ? stateForPresentation(persistedState, output.presentationId, initialVisibleCount)
    : persistedState;

  useEffect(() => {
    if (!output || persistedState.presentationId === output.presentationId) return;
    setPersistedState(initialViewState(output.presentationId, initialVisibleCount));
  }, [initialVisibleCount, output, persistedState.presentationId, setPersistedState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    displayModeRequestRef.current += 1;
    setDisplayModePending(false);
    setDisplayModeError(null);
  }, [displayMode]);

  if (tool.isPending) {
    return (
      <GrantResultsLoading colorScheme={colorScheme} visualTheme={visualTheme} insets={insets} />
    );
  }

  if (!output) {
    return (
      <GrantResultsMessage
        colorScheme={colorScheme}
        visualTheme={visualTheme}
        insets={insets}
        message="The grant shortlist could not be displayed."
      />
    );
  }

  const selected = output.items.find((item) => itemKey(item) === state.selectedKey);
  const llmContext =
    selected?.status === 'success' && selected.opportunity
      ? `Viewing grant opportunity: ${selected.opportunity.title}; source: ${selected.source.label}; source-scoped ID: ${selected.id}`
      : `Viewing a ranked shortlist of ${output.items.length} grant opportunities`;

  return (
    <div data-llm={llmContext}>
      <GrantResults
        output={output}
        selectedKey={state.selectedKey}
        visibleCount={state.visibleCount}
        expandedDescriptionKey={state.expandedDescriptionKey}
        colorScheme={colorScheme}
        visualTheme={visualTheme}
        insets={insets}
        displayMode={displayMode}
        displayModePending={displayModePending}
        displayModeError={displayModeError}
        onSelect={(selectedKey) =>
          setPersistedState((current) => ({
            ...stateForPresentation(current, output.presentationId, initialVisibleCount),
            selectedKey,
            expandedDescriptionKey: null,
          }))
        }
        onBack={() =>
          setPersistedState((current) => ({
            ...stateForPresentation(current, output.presentationId, initialVisibleCount),
            selectedKey: null,
            expandedDescriptionKey: null,
          }))
        }
        onShowMore={() =>
          setPersistedState((current) => {
            const active = stateForPresentation(
              current,
              output.presentationId,
              initialVisibleCount,
            );
            return {
              ...active,
              visibleCount: Math.min(output.items.length, active.visibleCount + 2),
            };
          })
        }
        onToggleDescription={(key) =>
          setPersistedState((current) => {
            const active = stateForPresentation(
              current,
              output.presentationId,
              initialVisibleCount,
            );
            return {
              ...active,
              expandedDescriptionKey: active.expandedDescriptionKey === key ? null : key,
            };
          })
        }
        onOpenExternal={openExternal}
        onToggleDisplayMode={() => {
          if (!displayMode || displayModePending) return;
          const requestId = ++displayModeRequestRef.current;
          setDisplayModePending(true);
          setDisplayModeError(null);
          void setHostDisplayMode('fullscreen')
            .then(({ mode }) => {
              if (
                mountedRef.current &&
                displayModeRequestRef.current === requestId &&
                mode !== 'fullscreen'
              ) {
                setDisplayModeError('Full screen is not available in this host.');
              }
            })
            .catch(() => {
              if (mountedRef.current && displayModeRequestRef.current === requestId) {
                setDisplayModeError('Full screen is not available in this host.');
              }
            })
            .finally(() => {
              if (mountedRef.current && displayModeRequestRef.current === requestId) {
                setDisplayModePending(false);
              }
            });
        }}
      />
    </div>
  );
}
