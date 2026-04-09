import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  error = '';
  loading = false;
  leaving = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  async submit(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = '';

    try {
      const ok = await this.auth.login(this.email, this.password);
      if (!ok) {
        this.error = 'Credenciais inválidas.';
        return;
      }

      this.leaving = true;
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
      setTimeout(() => this.router.navigateByUrl(returnUrl), 420);
    } finally {
      this.loading = false;
    }
  }
}
