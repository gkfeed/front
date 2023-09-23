import { Component } from '@angular/core';
import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feed-creator',
  templateUrl: './feed-creator.component.html',
  styleUrls: ['./feed-creator.component.scss'],
})
export class FeedCreatorComponent {
  constructor(private feedService: FeedsService) {}

  feed: IFeed = {
    title: '',
    type: '',
    url: '',
  };

  onSubmit() {
    console.log('Form submitted:', this.feed);
    this.feedService.create(this.feed).subscribe();
    this.feed = {
      title: '',
      type: '',
      url: '',
    };
  }
}
