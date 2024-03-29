import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { delay, Observable, retry, tap } from 'rxjs';
import { IFeed } from '../models/feed';
import { environment } from 'src/enviroments/enviroment';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FeedsService {
  constructor(private http: HttpClient) {}

  feeds: IFeed[] = [];

  getAll(): Observable<IFeed[]> {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');

    const headers = new HttpHeaders({
      Authorization: 'Basic ' + btoa(username + ':' + password),
      // other headers
    });

    return this.http
      .get<IFeed[]>(environment.api_root + 'list', { headers })
      .pipe(
        delay(200),
        retry(2),
        tap((feeds) => (this.feeds = feeds)),
      );
  }

  getFeedById(id: number): Observable<IFeed | undefined> {
    return this.getAll().pipe(
      map((feeds) => feeds.find((feed) => feed.id === id)),
    );
  }

  deleteFeedById(id: number): Observable<IFeed | undefined> {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');

    const headers = new HttpHeaders({
      Authorization: 'Basic ' + btoa(username + ':' + password),
      // other headers
    });
    const params = new HttpParams().set('id', id);
    return this.http
      .get<IFeed>(environment.api_root + 'delete', { params, headers })
      .pipe();
  }

  create(feed: IFeed): Observable<IFeed> {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');

    const headers = new HttpHeaders({
      Authorization: 'Basic ' + btoa(username + ':' + password),
      // other headers
    });
    console.log('creating');
    return this.http
      .post<IFeed>(environment.api_root + 'add', feed, { headers })
      .pipe();
  }
}
