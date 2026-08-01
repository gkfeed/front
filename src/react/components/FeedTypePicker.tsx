import { useState } from 'react';

import { getFeedTypeIcon } from './feedIcons';
import { FEED_TYPE_OPTIONS, type FeedTypeOption } from '../domain/feedTypes';

interface FeedTypePickerProps {
  value: string;
  invalid: boolean;
  disabled: boolean;
  errorId: string;
  onChange: (value: string) => void;
}

export function FeedTypePicker({ value, invalid, disabled, errorId, onChange }: FeedTypePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = FEED_TYPE_OPTIONS.find((option) => option.value === value) ?? FEED_TYPE_OPTIONS[0];

  function selectType(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="type-picker" onKeyDown={(event) => event.key === 'Escape' && setIsOpen(false)}>
      <button
        className="type-picker__trigger"
        type="button"
        aria-labelledby="type-label type-picker-selected"
        aria-describedby={invalid ? errorId : undefined}
        aria-expanded={isOpen}
        aria-invalid={invalid ? 'true' : undefined}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <FeedTypeMark option={selectedOption} selected />
        <span id="type-picker-selected" className="type-picker__selected">{selectedOption.label}</span>
        <span className="type-picker__chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen ? (
        <div
          className="type-picker__panel"
          role="radiogroup"
          aria-labelledby="type-label"
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid ? 'true' : undefined}
        >
          {FEED_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className="type-picker__option" htmlFor={typeOptionId(option.value)}>
              <input
                id={typeOptionId(option.value)}
                className="type-picker__input"
                type="radio"
                name="type"
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                required
                onChange={(event) => selectType(event.target.value)}
              />
              <FeedTypeMark option={option} />
              <span className="type-picker__label">{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeedTypeMark({ option, selected = false }: { option: FeedTypeOption; selected?: boolean }) {
  const className = `type-picker__mark${selected ? ' type-picker__mark--selected' : ''}`;

  return (
    <span className={className} aria-hidden="true">
      {option.display === 'icon' ? (
        <svg viewBox="0 0 48 48" focusable="false">
          <path d={getFeedTypeIcon(option.value).path} fill="currentColor" />
        </svg>
      ) : (
        <span className="type-picker__initials">{getTypeInitials(option.label)}</span>
      )}
    </span>
  );
}

function typeOptionId(value: string) {
  return `type-${value.replace(/[^a-z0-9]+/gi, '-')}`;
}

function getTypeInitials(label: string) {
  const words = label.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}
