import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should allow login with the demo credentials', async () => {
    const ok = await service.login('wesley@moneycontrol.com', 'moneycontrol');

    expect(ok).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('should reject empty credentials', async () => {
    const ok = await service.login('', '');

    expect(ok).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
  });
});
