import { Component } from '@angular/core';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  username: string = '';
  password: string = '';
  show: string | null =
    localStorage.getItem('username') + ' : ' + localStorage.getItem('password');

  onSubmit() {
    localStorage.setItem('username', this.username);
    localStorage.setItem('password', this.password);
    this.show =
      localStorage.getItem('username') +
      ' : ' +
      localStorage.getItem('password');
  }
}
