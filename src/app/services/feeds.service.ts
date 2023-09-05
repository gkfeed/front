import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { delay, Observable, retry, tap } from 'rxjs';
import { IFeed } from '../models/feed';
import { environment } from 'src/enviroments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class FeedsService {
  constructor(private http: HttpClient) {}

  feeds: IFeed[] = [];

  getAll(): Observable<IFeed[]> {
    return this.http.get<IFeed[]>(environment.api_root + 'list').pipe(
      delay(200),
      retry(2),
      tap((feeds) => (this.feeds = feeds))
    );
  }
}
