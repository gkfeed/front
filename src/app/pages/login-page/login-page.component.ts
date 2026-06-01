import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';

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

  savedUsername = this.authService.savedUsername;

  constructor(private readonly authService: AuthService) {}

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

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
