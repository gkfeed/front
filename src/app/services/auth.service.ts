import { Injectable } from '@angular/core';

export interface Credentials {
  username: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private savedCredentials: Credentials | null = null;

  get savedUsername(): string {
    return this.savedCredentials?.username ?? '';
  }

  get credentials(): Credentials | null {
    return this.savedCredentials;
  }

  get authorizationHeader(): string | null {
    const credentials = this.credentials;
    return credentials
      ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
      : null;
  }

  save(credentials: Credentials): void {
    this.savedCredentials = { ...credentials };
  }

  clear(): void {
    this.savedCredentials = null;
  }
}
