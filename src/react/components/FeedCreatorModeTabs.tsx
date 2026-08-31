import type { FeedCreatorMode } from '../domain/feedCreator';

export function FeedCreatorModeTabs({
  mode,
  disabled,
  onSelect,
  labels,
}: {
  mode: FeedCreatorMode;
  disabled: boolean;
  onSelect: (mode: FeedCreatorMode) => void;
  labels: { lazy: string; extended: string; ariaLabel: string };
}) {
  return (
    <div className="creator__tabs" role="tablist" aria-label={labels.ariaLabel}>
      <ModeTab mode="lazy" currentMode={mode} disabled={disabled} onSelect={onSelect}>
        {labels.lazy}
      </ModeTab>
      <ModeTab mode="extended" currentMode={mode} disabled={disabled} onSelect={onSelect}>
        {labels.extended}
      </ModeTab>
    </div>
  );
}

function ModeTab({
  children,
  mode,
  currentMode,
  disabled,
  onSelect,
}: {
  children: string;
  mode: FeedCreatorMode;
  currentMode: FeedCreatorMode;
  disabled: boolean;
  onSelect: (mode: FeedCreatorMode) => void;
}) {
  const selected = mode === currentMode;

  return (
    <button
      className="ui-primary-button"
      id={`feed-create-${mode}-tab`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`feed-create-${mode}-panel`}
      disabled={disabled}
      onClick={() => onSelect(mode)}
    >
      {children}
    </button>
  );
}
