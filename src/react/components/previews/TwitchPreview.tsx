import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { TheaterPlayerShell } from './TheaterPlayerShell';
import { useTheaterDialog } from './useTheaterDialog';

type TwitchPreviewProps = {
  channel: string;
  onPreviewError: () => void;
  preview: LocalizedFeedItemPreview | null;
  isLive?: boolean;
  onPlayerOpenChange?: (isOpen: boolean) => void;
};

export function TwitchPreview({
  channel,
  onPreviewError,
  preview,
  isLive = true,
  onPlayerOpenChange,
}: TwitchPreviewProps) {
  const { t } = useTranslation();
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPlayerOpen(false);
    setIsTheaterOpen(false);
  }, [channel]);

  useEffect(() => {
    onPlayerOpenChange?.(isPlayerOpen && isTheaterOpen);
  }, [isPlayerOpen, isTheaterOpen, onPlayerOpenChange]);

  useTheaterDialog({
    initialFocusSelector: 'button, iframe',
    isOpen: isTheaterOpen,
    onOpenChange: setIsTheaterOpen,
    playerRef,
    triggerRef,
  });

  if (isPlayerOpen) {
    return (
      <TwitchPlayer
        channel={channel}
        isLive={isLive}
        isTheaterOpen={isTheaterOpen}
        shellRef={playerRef}
        onToggleTheater={() => setIsTheaterOpen((isOpen) => !isOpen)}
      />
    );
  }

  return (
    <>
      <div className="reader-card__preview-trigger-wrap">
        <button
          type="button"
          ref={triggerRef}
          className="reader-card__preview-trigger"
          aria-label={t('preview.playTwitch', { channel })}
          onClick={() => {
            setIsPlayerOpen(true);
            setIsTheaterOpen(true);
          }}
        />
        {preview ? (
          <div className="reader-card__preview">
            <img
              src={preview.src}
              alt={preview.alt}
              referrerPolicy="no-referrer"
              onError={onPreviewError}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

type TwitchPlayerProps = {
  channel: string;
  isLive: boolean;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function TwitchPlayer({ channel, isLive, isTheaterOpen, onToggleTheater, shellRef }: TwitchPlayerProps) {
  const { t } = useTranslation();
  const parameters = new URLSearchParams({
    channel,
    parent: window.location.hostname || 'localhost',
    autoplay: 'true',
  });
  const playerTitle = t('preview.twitchPlayer', { channel });

  return (
    <TheaterPlayerShell
      title={playerTitle}
      isTheaterOpen={isTheaterOpen}
      onToggleTheater={onToggleTheater}
      shellRef={shellRef}
    >
      {isLive ? (
        <iframe
          src={`https://player.twitch.tv/?${parameters}`}
          title={playerTitle}
          allow="autoplay; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="reader-card__player-ended" role="status">{t('live.streamEnded')}</div>
      )}
    </TheaterPlayerShell>
  );
}
