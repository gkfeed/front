import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';

type TheaterPlayerShellProps = {
  children: ReactNode;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
  title: string;
  toolbar?: ReactNode;
  aside?: ReactNode;
};

export function TheaterPlayerShell({
  children,
  isTheaterOpen,
  onToggleTheater,
  shellRef,
  title,
  toolbar,
  aside,
}: TheaterPlayerShellProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={shellRef}
      className={[
        'reader-card__player-shell',
        isTheaterOpen ? 'reader-card__player-shell--theater' : '',
      ].filter(Boolean).join(' ')}
      role={isTheaterOpen ? 'dialog' : undefined}
      aria-modal={isTheaterOpen ? 'true' : undefined}
      aria-label={isTheaterOpen ? title : undefined}
    >
      <div className="reader-card__player-stage">
        <div className="reader-card__player-toolbar">
          {toolbar}
          <button
            type="button"
            className="reader-card__theater-toggle"
            aria-label={isTheaterOpen ? t('preview.exitTheater') : t('preview.enterTheater')}
            aria-pressed={isTheaterOpen}
            onClick={onToggleTheater}
          >
            <span aria-hidden="true">{isTheaterOpen ? '↙' : '↗'}</span>
            {isTheaterOpen ? t('preview.exitTheaterShort') : t('preview.theater')}
          </button>
        </div>
        <div className={aside ? 'reader-card__player-content reader-card__player-content--with-aside' : 'reader-card__player-content'}>
          <div className="reader-card__preview reader-card__preview--player">
            {children}
          </div>
          {aside}
        </div>
      </div>
    </div>
  );
}
