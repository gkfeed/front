// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFeatureComposition } from '../application/featureComposition';
import { FeatureUseCasesContext } from '../state/featureUseCasesContext';
import { ArticleReaderLink, ArticleReaderOverlay } from './ArticleReader';
import { useArticleReader } from '../hooks/useArticleReader';

afterEach(cleanup);

describe('ArticleReaderLink', () => {
  it('keeps article content hidden and unloaded until the existing link is activated', async () => {
    const getArticle = vi.fn().mockResolvedValue({
      url: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
      byline: 'Svidetel',
      excerpt: null,
      blocks: [{ type: 'paragraph', text: 'Полный текст статьи.' }],
    });
    const composition = createFeatureComposition();
    const useCases = {
      ...composition,
      preview: { ...composition.preview, getArticle },
    };

    render(
      <FeatureUseCasesContext.Provider value={useCases}>
        <ArticleReaderHarness />
      </FeatureUseCasesContext.Provider>,
    );

    expect(screen.queryByText('Полный текст статьи.')).toBeNull();
    expect(getArticle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: /Open original/i }));

    expect(await screen.findByRole('heading', { name: 'Cloudflare OS' })).toBeTruthy();
    expect(screen.getByText('Полный текст статьи.')).toBeTruthy();
    expect(getArticle).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('traps focus inside the modal and restores it to the activating link', async () => {
    const getArticle = vi.fn().mockResolvedValue({
      url: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
      byline: null,
      excerpt: null,
      blocks: [],
    });
    const composition = createFeatureComposition();
    const useCases = {
      ...composition,
      preview: { ...composition.preview, getArticle },
    };

    render(
      <FeatureUseCasesContext.Provider value={useCases}>
        <ArticleReaderHarness />
      </FeatureUseCasesContext.Provider>,
    );

    const activatingLink = screen.getByRole('link', { name: /Open original/i });
    activatingLink.focus();
    fireEvent.click(activatingLink);

    const dialog = await screen.findByRole('dialog');
    const close = dialog.querySelector<HTMLButtonElement>('.article-reader__close')!;
    const original = within(dialog).getByRole('link', { name: /^Original/i });
    expect(document.activeElement).toBe(close);

    original.focus();
    fireEvent.keyDown(original, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(original);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(activatingLink);
  });

  it('renders the article inside the native fullscreen element', async () => {
    const getArticle = vi.fn().mockResolvedValue({
      url: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
      byline: null,
      excerpt: null,
      blocks: [],
    });
    const composition = createFeatureComposition();
    const useCases = {
      ...composition,
      preview: { ...composition.preview, getArticle },
    };
    const main = document.createElement('main');
    document.body.append(main);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: main,
    });

    try {
      render(
        <FeatureUseCasesContext.Provider value={useCases}>
          <ArticleReaderHarness />
        </FeatureUseCasesContext.Provider>,
        { container: main },
      );

      fireEvent.click(screen.getByRole('link', { name: /Open original/i }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog.parentElement).toBe(main);
      expect(await screen.findByRole('heading', { name: 'Cloudflare OS' })).toBeTruthy();
    } finally {
      Reflect.deleteProperty(document, 'fullscreenElement');
      main.remove();
    }
  });
});

function ArticleReaderHarness() {
  const url = 'https://trashbox.ru/link/cloudflare-os';
  const reader = useArticleReader(url);
  return (
    <>
      <ArticleReaderLink url={url} enabled onOpen={reader.open} />
      <ArticleReaderOverlay reader={reader} originalUrl={url} />
    </>
  );
}
