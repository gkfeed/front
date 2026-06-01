import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { FeedSearchService } from 'src/app/services/feed-search.service';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss'],
    standalone: false
})
export class NavbarComponent {
  constructor(
    public readonly feedSearchService: FeedSearchService,
    private readonly router: Router,
  ) {}

  get showSearch(): boolean {
    return this.router.url.split('?')[0] === '/';
  }

  onSearchInput(event: Event): void {
    this.feedSearchService.searchTerm = (event.target as HTMLInputElement).value;
  }
}
