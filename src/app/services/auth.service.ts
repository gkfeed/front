import { Injectable } from '@angular/core';

export interface Credentials {
  username: string;
  password: string;
}

const USERNAME_KEY = 'username';
const PASSWORD_KEY = 'password';

@Injectable({ providedIn: 'root' })
export class AuthService {
  get credentials(): Credentials | null {
    const username = localStorage.getItem(USERNAME_KEY);
    const password = localStorage.getItem(PASSWORD_KEY);

    if (!username || !password) {
      return null;
    }

    return { username, password };
  }

  get authorizationHeader(): string | null {
    const credentials = this.credentials;
    return credentials
      ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
      : null;
  }

  save(credentials: Credentials): void {
    localStorage.setItem(USERNAME_KEY, credentials.username);
    localStorage.setItem(PASSWORD_KEY, credentials.password);
  }
}
