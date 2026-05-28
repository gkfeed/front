import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DoCheck, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { IFeed } from 'src/app/models/feed';
import { FeedSearchService } from 'src/app/services/feed-search.service';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feeds-list',
  templateUrl: './feeds-list.component.html',
  styleUrls: ['./feeds-list.component.scss'],
  standalone: false,
})
export class FeedsListComponent implements DoCheck, OnInit {
  feeds: IFeed[] = [];
  filteredFeeds: IFeed[] = [];
  isLoading = true;
  errorMessage = '';
  private searchTerm = '';

  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedSearchService: FeedSearchService,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.errorMessage = '';

    this.feedsService
      .getAll()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (feeds) => {
          this.feeds = feeds;
          this.searchTerm = this.feedSearchService.searchTerm;
          this.updateFilteredFeeds();
        },
        error: (error: unknown) => {
          this.errorMessage = this.getLoadErrorMessage(error);
        },
      });
  }

  ngDoCheck(): void {
    const searchTerm = this.feedSearchService.searchTerm;

    if (searchTerm !== this.searchTerm) {
      this.searchTerm = searchTerm;
      this.updateFilteredFeeds();
    }
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

    this.filteredFeeds = this.feeds.filter((feed) =>
      [feed.title, feed.type, feed.url].some((value) =>
        (value ?? '').toLowerCase().includes(query),
      ),
    );
  }

  private getLoadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Unable to load feeds. Log in and try again.';
    }

    return 'Unable to load feeds. Check your connection and try again.';
  }
}
