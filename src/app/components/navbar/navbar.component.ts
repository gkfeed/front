import { Component } from '@angular/core';

import { FeedSearchService } from 'src/app/services/feed-search.service';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss'],
    standalone: false
})
export class NavbarComponent {
  constructor(public readonly feedSearchService: FeedSearchService) {}

  onSearchInput(event: Event): void {
    this.feedSearchService.searchTerm = (event.target as HTMLInputElement).value;
  }
}
