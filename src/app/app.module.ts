import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FeedsListComponent } from './components/feeds-list/feeds-list.component';
import { FeedCreatorComponent } from './components/feed-creator/feed-creator.component';
import { FeedListPageComponent } from './pages/feed-list-page/feed-list-page.component';
import { FeedCreatePageComponent } from './pages/feed-create-page/feed-create-page.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FeedCardComponent } from './components/feed-card/feed-card.component';
import { FeedPageComponent } from './pages/feed-page/feed-page.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

@NgModule({
  declarations: [
    AppComponent,
    FeedsListComponent,
    FeedCreatorComponent,
    FeedListPageComponent,
    FeedCreatePageComponent,
    NavbarComponent,
    FeedCardComponent,
    FeedPageComponent,
    LoginPageComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
  ],
  providers: [
    provideAnimationsAsync()
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
