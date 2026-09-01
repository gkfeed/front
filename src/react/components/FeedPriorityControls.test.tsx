// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FeedPriorityContext } from '../state/feedPriorityContext';
import { FeedPriorityControls } from './FeedPriorityControls';

describe('FeedPriorityControls', () => {
  it('changes the priority assigned to the current item feed id', () => {
    const changePriority = vi.fn();
    render(
      <FeedPriorityContext value={{ priorities: { 7: -1 }, changePriority }}>
        <FeedPriorityControls feedId={7} />
      </FeedPriorityContext>,
    );

    expect(screen.getByText('Feed priority')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Decrease priority for feed #7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase priority for feed #7' }));

    expect(screen.queryByLabelText(/Priority:/)).toBeNull();
    expect(changePriority).toHaveBeenNthCalledWith(1, 7, -1);
    expect(changePriority).toHaveBeenNthCalledWith(2, 7, 1);
  });
});
