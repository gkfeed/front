import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feed-page',
  templateUrl: './feed-page.component.html',
  styleUrls: ['./feed-page.component.scss'],
})
export class FeedPageComponent {
  constructor(
    public route: ActivatedRoute,
    public router: Router,
    public feedsService: FeedsService,
  ) {}
  id!: number;
  feed!: IFeed;

  onClick() {
    this.feedsService.deleteFeedById(this.id).subscribe();
    this.router.navigate(['/']);
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.id = parseInt(params['id']);
    });

    this.feedsService.getFeedById(this.id).subscribe((feed) => {
      if (feed) {
        this.feed = feed;
      }
      // TODO: errorService can't find feed by this id
    });
  }
}
