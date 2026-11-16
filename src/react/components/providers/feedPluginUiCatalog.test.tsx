// @vitest-environment jsdom
import { Suspense, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { definePluginUi } from './feedPluginUiCatalog';
import type { FeedItemCardProviderRendererProps } from './providerRenderers/common';

const props = { facts: { provider: 'vk', isPreviewPending: false } } as unknown as FeedItemCardProviderRendererProps;
afterEach(cleanup);

describe('provider UI prefetch', () => {
  it('renders the already loaded provider without a suspense placeholder', async () => {
    const load = vi.fn().mockResolvedValue({ renderCard: () => ({ preview: <span>Ready card</span> }) });
    const plugin = definePluginUi('vk', load);
    await plugin.loadUi();
    await plugin.loadUi();

    render(<Suspense fallback={<span>Loading card</span>}><plugin.Card {...props} /></Suspense>);
    expect(screen.getByText('Ready card')).toBeTruthy();
    expect(screen.queryByText('Loading card')).toBeNull();
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps mounted provider state when a lazy import finishes and the parent rerenders', async () => {
    let complete!: (value: { renderCard: () => { preview: React.ReactNode } }) => void;
    function StatefulPreview() {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
    }
    const plugin = definePluginUi('vk', () => new Promise((resolve) => { complete = resolve; }));
    const view = render(<Suspense fallback={<span>Loading card</span>}><plugin.Card {...props} /></Suspense>);
    await act(async () => complete({ renderCard: () => ({ preview: <StatefulPreview /> }) }));
    fireEvent.click(screen.getByText('Count 0'));
    view.rerender(<Suspense fallback={<span>Loading card</span>}><plugin.Card {...props} displayHostname="changed" /></Suspense>);
    expect(screen.getByText('Count 1')).toBeTruthy();
  });

  it('keeps the placeholder until a provider that was not prefetched loads', async () => {
    let complete!: (value: { renderCard: () => { preview: React.ReactNode } }) => void;
    const plugin = definePluginUi('vk', () => new Promise((resolve) => { complete = resolve; }));
    render(<Suspense fallback={<span>Loading card</span>}><plugin.Card {...props} /></Suspense>);
    expect(screen.getByText('Loading card')).toBeTruthy();
    await act(async () => complete({ renderCard: () => ({ preview: <span>Ready card</span> }) }));
    expect(screen.getByText('Ready card')).toBeTruthy();
  });
});
