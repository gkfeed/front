import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, of, retry, tap } from 'rxjs';

import { environment } from 'src/enviroments/enviroment';
import { IFeed } from '../models/feed';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class FeedsService {
  private readonly apiRoot = environment.api_root;

  feeds: IFeed[] = [];

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  getAll(): Observable<IFeed[]> {
    return this.http.get<IFeed[]>(this.endpoint('list'), this.httpOptions()).pipe(
      retry(2),
      tap((feeds) => (this.feeds = feeds)),
    );
  }

  getFeedById(id: number): Observable<IFeed | undefined> {
    const feed = this.feeds.find((cachedFeed) => cachedFeed.id === id);

    if (feed) {
      return of(feed);
    }

    return this.getAll().pipe(
      map((feeds) => feeds.find((feed) => feed.id === id)),
    );
  }

  deleteFeedById(id: number): Observable<IFeed> {
    const params = new HttpParams().set('id', id);
    return this.http.get<IFeed>(this.endpoint('delete'), {
      ...this.httpOptions(),
      params,
    });
  }

  create(feed: IFeed): Observable<IFeed> {
    return this.http.post<IFeed>(this.endpoint('add'), feed, this.httpOptions());
  }

  private endpoint(path: string): string {
    return `${this.apiRoot}${path}`;
  }

  private httpOptions(): { headers?: HttpHeaders } {
    const authorization = this.authService.authorizationHeader;

    return authorization
      ? { headers: new HttpHeaders({ Authorization: authorization }) }
      : {};
  }
}
