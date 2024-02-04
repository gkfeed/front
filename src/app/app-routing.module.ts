import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FeedCreatePageComponent } from './pages/feed-create-page/feed-create-page.component';
import { FeedListPageComponent } from './pages/feed-list-page/feed-list-page.component';
import { FeedPageComponent } from './pages/feed-page/feed-page.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';

const routes: Routes = [
  { path: '', component: FeedListPageComponent },
  { path: 'create', component: FeedCreatePageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'feed/:id', component: FeedPageComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
