import { useTranslation } from 'react-i18next';

import { useYoutubeTimecodes } from '../../hooks/useYoutubeTimecodes';
import { formatYoutubeTimecode } from '../../services/youtubeTimecodes';

type YoutubeTimecodesProps = {
  currentTime: number;
  onSeek: (seconds: number) => void;
  videoId: string;
};

export function YoutubeTimecodes({ currentTime, onSeek, videoId }: YoutubeTimecodesProps) {
  const { t } = useTranslation();
  const { status, timecodes, retry } = useYoutubeTimecodes(videoId, true);
  const currentIndex = timecodes?.reduce(
    (foundIndex, timecode, index) => timecode.seconds <= currentTime ? index : foundIndex,
    -1,
  ) ?? -1;

  return (
    <aside
      id={`youtube-timecodes-${videoId}`}
      className="youtube-timecodes"
      aria-label={t('youtubeTimecodes.title')}
    >
      {status === 'loading' ? (
        <p className="youtube-timecodes__state" role="status">{t('youtubeTimecodes.loading')}</p>
      ) : null}
      {status === 'error' ? (
        <div className="youtube-timecodes__state" role="alert">
          <p>{t('youtubeTimecodes.loadError')}</p>
          <button type="button" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : null}
      {timecodes?.length === 0 ? (
        <p className="youtube-timecodes__state">{t('youtubeTimecodes.empty')}</p>
      ) : null}
      {timecodes && timecodes.length > 0 ? (
        <ol className="youtube-timecodes__list">
          {timecodes.map((timecode, index) => {
            const isPast = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
            <li
              key={`${timecode.seconds}-${timecode.title}`}
              data-current={isCurrent || undefined}
              data-past={isPast || undefined}
            >
              <button
                type="button"
                className="youtube-timecodes__seek"
                aria-label={t('youtubeTimecodes.seek', {
                  label: timecode.title,
                  time: formatYoutubeTimecode(timecode.seconds),
                })}
                aria-current={isCurrent ? 'true' : undefined}
                disabled={isPast}
                onClick={() => onSeek(timecode.seconds)}
              >
                <img
                  src={timecode.thumbnailUrl || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <span className="youtube-timecodes__copy">
                  <span>{timecode.title}</span>
                  <time>{formatYoutubeTimecode(timecode.seconds)}</time>
                </span>
              </button>
            </li>
            );
          })}
        </ol>
      ) : null}
    </aside>
  );
}
