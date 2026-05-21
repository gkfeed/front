import { Component, OnInit } from '@angular/core';

import { IFeed } from 'src/app/models/feed';
import { FeedSearchService } from 'src/app/services/feed-search.service';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feeds-list',
  templateUrl: './feeds-list.component.html',
  styleUrls: ['./feeds-list.component.scss'],
  standalone: false,
})
export class FeedsListComponent implements OnInit {
  feeds: IFeed[] = [];

  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedSearchService: FeedSearchService,
  ) {}

  get filteredFeeds(): IFeed[] {
    const query = this.feedSearchService.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.feeds;
    }

    return this.feeds.filter((feed) =>
      [feed.title, feed.type, feed.url].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }

  ngOnInit(): void {
    this.feedsService.getAll().subscribe((feeds) => (this.feeds = feeds));
  }

  trackByFeedId(_: number, feed: IFeed): number | undefined {
    return feed.id;
  }
}
