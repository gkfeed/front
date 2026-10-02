// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SasflixPreview } from './SasflixPreview';
import { useHlsVideo } from './useHlsVideo';

vi.mock('./useHlsVideo');
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const props = {
  href: 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
  publicationId: '630ffde7-febb-4f95-a490-6208d8770dea',
  title: 'Story',
  videoSrc: 'https://sasflix.ru/api/video/eb1ddca7-d933-4ccf-99b6-4129a4a6730e.m3u8',
  previewStatus: 'loaded' as const,
  preview: null,
  onPreviewError: vi.fn(),
};

describe('Sasflix playback recovery', () => {
  it.each(['native', 'hls'] as const)('offers a fallback and a fresh player after a %s playback error', (failure) => {
    render(<SasflixPreview {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Sasflix video Story' }));
    const firstVideo = screen.getByTitle('Sasflix video player: Story');

    if (failure === 'native') fireEvent.error(firstVideo);
    else act(() => vi.mocked(useHlsVideo).mock.calls.at(-1)?.[0].onFatalError?.());

    expect(screen.getByRole('alert').textContent).toContain('Media unavailable');
    expect(screen.getByRole('link', { name: 'Open sasflix.ru' }).getAttribute('href')).toBe(props.href);
    expect(screen.queryByTitle('Sasflix video player: Story')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBe(document.activeElement);
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByTitle('Sasflix video player: Story')).not.toBe(firstVideo);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Exit theater mode' })).toBeTruthy();
  });
});
