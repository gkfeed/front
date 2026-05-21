import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feed-page',
  templateUrl: './feed-page.component.html',
  styleUrls: ['./feed-page.component.scss'],
  standalone: false,
})
export class FeedPageComponent implements OnInit {
  feed?: IFeed;
  private feedId?: number;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly feedsService: FeedsService,
  ) {}

  ngOnInit(): void {
    this.feedId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(this.feedId)) {
      this.router.navigate(['/']);
      return;
    }

    this.feedsService.getFeedById(this.feedId).subscribe((feed) => {
      if (!feed) {
        this.router.navigate(['/']);
        return;
      }

      this.feed = feed;
    });
  }

  deleteFeed(): void {
    if (!this.feedId) {
      return;
    }

    this.feedsService
      .deleteFeedById(this.feedId)
      .subscribe(() => this.router.navigate(['/']));
  }
}
