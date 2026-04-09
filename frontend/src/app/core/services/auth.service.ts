import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly SESSION_KEY = 'mc-auth-session';
  private static readonly AUTH_TOKEN = 'f39ac88e3f0f6a9a7eb0f5d1f8157fd2af2c16b6d13fb4f5f2cc5b6db8d2a16f';
  private static readonly EMAIL_HASH = '1939510536a0a1ac0219c066e813e5fe5376566b014c728eb617ac69003f705e';
  private static readonly PASSWORD_HASH = '38a5c2b6bbc088ef7f6ff38171c27c76502a55995ab07d269529f3994b6e9b6b';

  readonly authenticated = signal<boolean>(localStorage.getItem(AuthService.SESSION_KEY) === AuthService.AUTH_TOKEN);

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  async login(email: string, password: string): Promise<boolean> {
    const emailHash = await this.sha256(email.trim().toLowerCase());
    const passwordHash = await this.sha256(password);
    const valid = emailHash === AuthService.EMAIL_HASH && passwordHash === AuthService.PASSWORD_HASH;

    if (!valid) {
      this.logout();
      return false;
    }

    localStorage.setItem(AuthService.SESSION_KEY, AuthService.AUTH_TOKEN);
    this.authenticated.set(true);
    return true;
  }

  logout(): void {
    localStorage.removeItem(AuthService.SESSION_KEY);
    this.authenticated.set(false);
  }

  private async sha256(value: string): Promise<string> {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
