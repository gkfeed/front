import { Component } from '@angular/core';

import { IFeed } from 'src/app/models/feed';
import { FeedsService } from 'src/app/services/feeds.service';

@Component({
  selector: 'app-feeds-list',
  templateUrl: './feeds-list.component.html',
  styleUrls: ['./feeds-list.component.scss'],
})
export class FeedsListComponent {
  constructor(public feedsService: FeedsService) {}
  feeds?: IFeed[];

  ngOnInit(): void {
    this.feedsService.getAll().subscribe((feeds) => (this.feeds = feeds));
  }
}
