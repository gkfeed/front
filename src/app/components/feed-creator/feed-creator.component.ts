import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { finalize } from 'rxjs';

import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

const EMPTY_FEED: IFeed = {
  title: '',
  type: 'rss',
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
  isSaving = false;

  constructor(private readonly feedService: FeedsService) {}

  onSubmit(form: NgForm): void {
    if (form.invalid || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.feedService
      .create(this.feed)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe(() => this.resetForm(form));
  }

  private resetForm(form: NgForm): void {
    this.feed = { ...EMPTY_FEED };
    form.resetForm(this.feed);
  }
}
