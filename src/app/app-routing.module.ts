import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FeedCreatePageComponent } from './pages/feed-create-page/feed-create-page.component';
import { FeedListPageComponent } from './pages/feed-list-page/feed-list-page.component';

const routes: Routes = [
  { path: '', component: FeedListPageComponent },
  { path: 'create', component: FeedCreatePageComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
