import { Component, DoCheck, OnInit } from '@angular/core';

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
  private searchTerm = '';

  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedSearchService: FeedSearchService,
  ) {}

  ngOnInit(): void {
    this.feedsService.getAll().subscribe((feeds) => {
      this.feeds = feeds;
      this.searchTerm = this.feedSearchService.searchTerm;
      this.updateFilteredFeeds();
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
        value.toLowerCase().includes(query),
      ),
    );
  }
}
