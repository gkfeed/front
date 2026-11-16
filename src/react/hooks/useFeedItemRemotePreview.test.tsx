// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeatureUseCases } from '../application/featureComposition';
import { FeatureUseCasesContext } from '../state/featureUseCasesContext';
import { useFeedItemRemotePreview } from './useFeedItemRemotePreview';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';
import { getCachedRemotePreview } from '../services/remotePreview';
import { clearPreviewCache, loadQueuedPreview } from '../services/previewQueue';

afterEach(() => { cleanup(); clearPreviewCache(); });

describe('remote preview plugin scope', () => {
  it('renders prefetched metadata immediately before the visibility request resolves', () => {
    const preview = {
      liquipediaMatch: null,
      openGraphPreview: {
        url: 'https://example.com/match', title: 'Prefetched', description: null,
        image: null, video: null, siteName: null, type: null, providerData: null,
      },
    };
    const getCachedRemotePreview = vi.fn().mockReturnValue(preview);
    const loadRemotePreview = vi.fn(() => new Promise(() => {}));
    const useCases = { preview: { loadRemotePreview, getCachedRemotePreview } } as unknown as FeatureUseCases;
    const wrapper = ({ children }: { children: ReactNode }) => <FeatureUseCasesContext value={useCases}>{children}</FeatureUseCasesContext>;
    const renders: Array<{ title: string | null | undefined; status: string }> = [];
    renderHook(() => {
      const result = useFeedItemRemotePreview('https://example.com/match', {
        enabled: true, source: 'open-graph', livePreview: 'none',
      });
      renders.push({ title: result.openGraphPreview?.title, status: result.previewStatus });
      return result;
    }, { wrapper });
    expect(renders[0]).toEqual({ title: 'Prefetched', status: 'loaded' });
  });

  it('shows actual queued preview data on the first render after prefetch', async () => {
    const url = 'https://example.com/prefetched-match';
    const metadata = { url, title: 'Already loaded', description: null, image: null,
      video: null, siteName: null, type: null, providerData: null };
    await loadQueuedPreview(`open-graph:${url}`, () => Promise.resolve(metadata));
    const useCases = { preview: { getCachedRemotePreview, loadRemotePreview: vi.fn(() => new Promise(() => {})) } } as unknown as FeatureUseCases;
    const wrapper = ({ children }: { children: ReactNode }) => <FeatureUseCasesContext value={useCases}>{children}</FeatureUseCasesContext>;
    const renders: Array<string | null | undefined> = [];
    renderHook(() => {
      const result = useFeedItemRemotePreview(url, { enabled: true, source: 'open-graph', livePreview: 'none' });
      renders.push(result.openGraphPreview?.title);
      return result;
    }, { wrapper });
    expect(renders[0]).toBe('Already loaded');
  });

  it('does not read cached content when the preview is disabled', () => {
    const getCachedRemotePreview = vi.fn();
    const loadRemotePreview = vi.fn();
    const useCases = { preview: { loadRemotePreview, getCachedRemotePreview } } as unknown as FeatureUseCases;
    const wrapper = ({ children }: { children: ReactNode }) => <FeatureUseCasesContext value={useCases}>{children}</FeatureUseCasesContext>;
    const { result } = renderHook(() => useFeedItemRemotePreview('https://example.com/match', {
      enabled: false, source: 'open-graph', livePreview: 'none',
    }), { wrapper });
    expect(result.current.previewStatus).toBe('idle');
    expect(result.current.openGraphPreview).toBeNull();
    expect(getCachedRemotePreview).not.toHaveBeenCalled();
  });

  it('cancels the old scope and ignores late results even when URL and source are unchanged', async () => {
    let resolve!: (value: typeof EMPTY_REMOTE_PREVIEW) => void;
    const loadRemotePreview = vi.fn<(url: string, source: string, signal: AbortSignal) => Promise<typeof EMPTY_REMOTE_PREVIEW>>(() => new Promise((done) => { resolve = done; }));
    const useCases = { preview: { loadRemotePreview } } as unknown as FeatureUseCases;
    const wrapper = ({ children }: { children: ReactNode }) => <FeatureUseCasesContext value={useCases}>{children}</FeatureUseCasesContext>;
    const { result, rerender } = renderHook(({ scopeKey }) => useFeedItemRemotePreview('https://example.com/match', {
      enabled: true, source: 'open-graph', livePreview: 'none', scopeKey,
    }), { initialProps: { scopeKey: 'hltv' }, wrapper });
    await waitFor(() => expect(loadRemotePreview).toHaveBeenCalledOnce());
    const oldSignal = loadRemotePreview.mock.calls[0]![2] as AbortSignal;
    const oldResolve = resolve;

    rerender({ scopeKey: 'generic' });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.openGraphPreview).toBeNull();
    await act(async () => oldResolve(EMPTY_REMOTE_PREVIEW));
    expect(result.current.previewStatus).toBe('pending');
  });
});
