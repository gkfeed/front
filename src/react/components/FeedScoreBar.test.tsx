// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { FeedScoreBar } from './FeedScoreBar';

afterEach(cleanup);
it('describes the three probabilities and represents them in the reference order', () => {
  const score = { subjectId: 'reader', feedId: 5, itemCount: 10, category: null,
    counts: { keep_for_later: 3, delete_immediately: 3, delete_after_viewing: 4 },
    probabilities: { keep_for_later: .3, delete_immediately: .3, delete_after_viewing: .4 } };
  render(<FeedScoreBar title="Current feed" score={score} />);
  const bar = screen.getByRole('img', { name: 'Current feed: keep for later 30%, delete immediately 30%, after viewing 40%' });
  expect([...bar.children].map((segment) => segment.getAttribute('data-category')))
    .toEqual(['keep_for_later', 'delete_immediately', 'delete_after_viewing']);
});

it('shows an empty track instead of inventing probabilities for an unreviewed feed', () => {
  render(<FeedScoreBar title="New feed" />);
  expect(screen.getByRole('img', { name: 'New feed: no observations yet' }).children).toHaveLength(0);
});
