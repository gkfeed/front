import { describe, expect, it } from 'vitest';

import type { RecommendationEvent } from '../../../shared/recommendationEvents';
import { createReviewObservation } from './reviewObservation';

function setup() {
  let clock = 0;
  const events: RecommendationEvent[] = [];
  const observer = createReviewObservation({
    item: { id: 7, feedId: 2, title: 'Video', text: 'Description', link: 'https://example.com/video' },
    subjectId: 'anonymous-user', emit: (event) => events.push(event), now: () => clock,
  });
  return { observer, events, advance: (ms: number) => { clock += ms; } };
}

describe('review decision timing', () => {
  it('distinguishes quick deletion from viewing and deletion', () => {
    const quick = setup();
    quick.observer.setVisible(true);
    quick.advance(100);
    quick.observer.decide('delete');
    const watched = setup();
    watched.observer.setVisible(true);
    watched.advance(60_000);
    watched.observer.decide('delete');
    expect(quick.events[0]).toMatchObject({ action: 'delete', activeMs: 100 });
    expect(watched.events[0]).toMatchObject({ action: 'delete', activeMs: 60_000 });
  });

  it('excludes hidden-tab time', () => {
    const { observer, advance, events } = setup();
    observer.setVisible(true);
    advance(1200);
    observer.setVisible(false);
    advance(90_000);
    observer.setVisible(true);
    advance(800);
    observer.decide('keep');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'keep', activeMs: 2000 });
  });

  it('logs only decisions for shown cards and ignores double activation', () => {
    const { observer, events } = setup();
    expect(observer.decide('delete')).toBeNull();
    expect(events).toEqual([]);
    observer.setVisible(true);
    expect(events).toEqual([]);
    observer.decide('keep');
    expect(observer.decide('delete')).toBeNull();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('keep');
    const repeated = setup();
    repeated.observer.setVisible(true);
    repeated.observer.decide('keep');
    expect(repeated.events[0].eventId).toBe(events[0].eventId);
  });
});
