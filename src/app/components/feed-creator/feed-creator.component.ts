import { Component } from '@angular/core';

import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

const EMPTY_FEED: IFeed = {
  title: '',
  type: '',
  url: '',
};

@Component({
  selector: 'app-feed-creator',
  templateUrl: './feed-creator.component.html',
  styleUrls: ['./feed-creator.component.scss'],
  standalone: false,
})
export class FeedCreatorComponent {
  feed: IFeed = { ...EMPTY_FEED };

  constructor(private readonly feedService: FeedsService) {}

  onSubmit(): void {
    this.feedService.create(this.feed).subscribe(() => this.resetForm());
  }

  private resetForm(): void {
    this.feed = { ...EMPTY_FEED };
  }
}
