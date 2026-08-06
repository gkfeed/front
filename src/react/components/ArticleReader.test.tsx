// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
