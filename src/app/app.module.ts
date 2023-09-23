import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FeedsListComponent } from './components/feeds-list/feeds-list.component';
import { FeedCreatorComponent } from './components/feed-creator/feed-creator.component';

@NgModule({
  declarations: [AppComponent, FeedsListComponent, FeedCreatorComponent],
  imports: [BrowserModule, AppRoutingModule, HttpClientModule, FormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
