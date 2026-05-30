import { Component } from '@angular/core';

import { AuthService, Credentials } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  standalone: false,
})
export class LoginPageComponent {
  credentials: Credentials = {
    username: '',
    password: '',
  };

  savedUsername = this.authService.credentials?.username ?? '';

  constructor(private readonly authService: AuthService) {}

  onSubmit(): void {
    this.authService.save(this.credentials);
    this.savedUsername = this.credentials.username;
    this.credentials = { username: '', password: '' };
  }

  onLogout(): void {
    this.authService.clear();
    this.savedUsername = '';
    this.credentials = { username: '', password: '' };
  }
}
