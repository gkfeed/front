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
  isLoading = true;
  isDeleting = false;
  loadError = '';
  deleteError = '';
  private feedId?: number;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly feedsService: FeedsService,
  ) {}

  ngOnInit(): void {
    this.feedId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(this.feedId)) {
      this.isLoading = false;
      this.loadError = 'Feed source not found.';
      return;
    }

    this.feedsService.getFeedById(this.feedId).subscribe({
      next: (feed) => {
        this.isLoading = false;

        if (!feed) {
          this.loadError = 'Feed source not found.';
          return;
        }

        this.feed = feed;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Could not load this feed source.';
      },
    });
  }

  deleteFeed(): void {
    if (!this.feedId || this.isDeleting) {
      return;
    }

    this.isDeleting = true;
    this.deleteError = '';

    this.feedsService.deleteFeedById(this.feedId).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.isDeleting = false;
        this.deleteError = 'Could not delete this feed source. Try again.';
      },
    });
  }
}
