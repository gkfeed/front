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
  saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';

  constructor(private readonly feedService: FeedsService) {}

  onSubmit(form: NgForm): void {
    if (form.invalid || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'saving';
    this.feedService
      .create(this.feed)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => {
          this.resetForm(form);
          this.saveStatus = 'success';
        },
        error: () => {
          this.saveStatus = 'error';
        },
      });
  }

  get statusMessage(): string {
    if (this.saveStatus === 'saving') {
      return 'Saving source...';
    }

    if (this.saveStatus === 'success') {
      return 'Feed source saved.';
    }

    if (this.saveStatus === 'error') {
      return 'Could not save feed source. Try again.';
    }

    return this.feed.title && this.feed.type && this.feed.url
      ? 'Ready to save'
      : 'Complete all fields';
  }

  private resetForm(form: NgForm): void {
    this.feed = { ...EMPTY_FEED };
    form.resetForm(this.feed);
  }
}
