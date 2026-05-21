import { Component, OnInit } from '@angular/core';

import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feeds-list',
  templateUrl: './feeds-list.component.html',
  styleUrls: ['./feeds-list.component.scss'],
  standalone: false,
})
export class FeedsListComponent implements OnInit {
  feeds: IFeed[] = [];

  constructor(private readonly feedsService: FeedsService) {}

  ngOnInit(): void {
    this.feedsService.getAll().subscribe((feeds) => (this.feeds = feeds));
  }

  trackByFeedId(_: number, feed: IFeed): number | undefined {
    return feed.id;
  }
}
