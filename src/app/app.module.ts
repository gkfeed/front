import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FeedCardComponent } from './components/feed-card/feed-card.component';
import { FeedCreatorComponent } from './components/feed-creator/feed-creator.component';
import { FeedsListComponent } from './components/feeds-list/feeds-list.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FeedCreatePageComponent } from './pages/feed-create-page/feed-create-page.component';
import { FeedListPageComponent } from './pages/feed-list-page/feed-list-page.component';
import { FeedPageComponent } from './pages/feed-page/feed-page.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    FeedCardComponent,
    FeedsListComponent,
    FeedCreatorComponent,
    FeedListPageComponent,
    FeedCreatePageComponent,
    FeedPageComponent,
    LoginPageComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule],
  providers: [provideHttpClient(withInterceptorsFromDi())],
  bootstrap: [AppComponent],
})
export class AppModule {}
