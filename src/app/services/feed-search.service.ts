import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FeedSearchService {
  private readonly searchTermSubject = new BehaviorSubject<string>('');
  readonly searchTerm$ = this.searchTermSubject.asObservable();

  get searchTerm(): string {
    return this.searchTermSubject.value;
  }

  set searchTerm(value: string) {
    if (value !== this.searchTermSubject.value) {
      this.searchTermSubject.next(value);
    }
  }
}
