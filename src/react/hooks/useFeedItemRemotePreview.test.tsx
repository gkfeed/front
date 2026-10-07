// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeatureUseCases } from '../application/featureComposition';
import { FeatureUseCasesContext } from '../state/featureUseCasesContext';
import { useFeedItemRemotePreview } from './useFeedItemRemotePreview';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';

afterEach(cleanup);

describe('remote preview plugin scope', () => {
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
