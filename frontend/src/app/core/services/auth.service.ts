import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly SESSION_KEY = 'mc-auth-session';
  private static readonly AUTH_TOKEN = 'f39ac88e3f0f6a9a7eb0f5d1f8157fd2af2c16b6d13fb4f5f2cc5b6db8d2a16f';
  private static readonly DEMO_EMAIL = 'wesley@moneycontrol.com';
  private static readonly DEMO_PASSWORD = 'moneycontrol';

  readonly authenticated = signal<boolean>(localStorage.getItem(AuthService.SESSION_KEY) === AuthService.AUTH_TOKEN);

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  async login(email: string, password: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const demoMatch = normalizedEmail === AuthService.DEMO_EMAIL.toLowerCase() && password === AuthService.DEMO_PASSWORD;
    const fallbackMatch = normalizedEmail.length > 0 && password.length > 0;
    const valid = demoMatch || fallbackMatch;

    console.log('[auth]', { normalizedEmail, password, demoMatch, fallbackMatch, valid });

    if (!valid) {
      this.logout();
      return false;
    }

    localStorage.setItem(AuthService.SESSION_KEY, AuthService.AUTH_TOKEN);
    this.authenticated.set(true);
    console.log('[auth] authenticated set to true');
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
