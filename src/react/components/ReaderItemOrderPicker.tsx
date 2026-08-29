import { useTranslation } from 'react-i18next';

import type { ReaderItemOrder } from '../state/readerItemOrder';

export function ReaderItemOrderPicker({
  itemOrder,
  onItemOrderChange,
}: {
  itemOrder: ReaderItemOrder;
  onItemOrderChange: (order: ReaderItemOrder) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="settings-menu__section">
      <span className="settings-menu__section-title">{t('settings.itemOrder')}</span>
      <div className="settings-menu__reader-options">
        {(['desc', 'asc'] as const).map((order) => {
          const selected = order === itemOrder;
          return (
            <button
              className="settings-menu__reader-option"
              data-selected={selected || undefined}
              key={order}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onItemOrderChange(order)}
            >
              <span aria-hidden="true">{order === 'desc' ? '↓' : '↑'}</span>
              {order === 'desc' ? t('settings.newestFirst') : t('settings.oldestFirst')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
