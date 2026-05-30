import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { distinctUntilChanged, finalize, Subscription } from 'rxjs';

import { IFeed } from 'src/app/models/feed';
import { FeedSearchService } from 'src/app/services/feed-search.service';
import { FeedsService } from 'src/app/services/feeds.service';

interface SearchableFeed {
  feed: IFeed;
  text: string;
}

@Component({
  selector: 'app-feeds-list',
  templateUrl: './feeds-list.component.html',
  styleUrls: ['./feeds-list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedsListComponent implements OnDestroy, OnInit {
  feeds: IFeed[] = [];
  filteredFeeds: IFeed[] = [];
  isLoading = true;
  errorMessage = '';
  private searchableFeeds: SearchableFeed[] = [];
  private searchTerm = '';
  private readonly subscription = new Subscription();

  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedSearchService: FeedSearchService,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.errorMessage = '';

    this.subscription.add(
      this.feedSearchService.searchTerm$
        .pipe(distinctUntilChanged())
        .subscribe((searchTerm) => {
          this.searchTerm = searchTerm;
          this.updateFilteredFeeds();
          this.changeDetectorRef.markForCheck();
        }),
    );

    this.subscription.add(
      this.feedsService
        .getAll()
        .pipe(
          finalize(() => {
            this.isLoading = false;
            this.changeDetectorRef.markForCheck();
          }),
        )
        .subscribe({
          next: (feeds) => {
            this.feeds = feeds;
            this.searchableFeeds = feeds.map((feed) => ({
              feed,
              text: `${feed.title} ${feed.type} ${feed.url}`.toLowerCase(),
            }));
            this.updateFilteredFeeds();
            this.changeDetectorRef.markForCheck();
          },
          error: (error: unknown) => {
            this.errorMessage = this.getLoadErrorMessage(error);
            this.changeDetectorRef.markForCheck();
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  trackByFeedId(_: number, feed: IFeed): number | undefined {
    return feed.id;
  }

  private updateFilteredFeeds(): void {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      this.filteredFeeds = this.feeds;
      return;
    }

    this.filteredFeeds = this.searchableFeeds
      .filter((searchableFeed) => searchableFeed.text.includes(query))
      .map((searchableFeed) => searchableFeed.feed);
  }

  private getLoadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Unable to load feeds. Log in and try again.';
    }

    return 'Unable to load feeds. Check your connection and try again.';
  }
}
