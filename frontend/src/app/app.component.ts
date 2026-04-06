import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

interface NavItem { path: string; label: string; icon: string; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  sidebarOpen = true;

  navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/transactions', label: 'Transações', icon: '💳' },
    { path: '/cards', label: 'Cartões', icon: '💳' },
    { path: '/accounts', label: 'Contas', icon: '🏦' },
    { path: '/investments', label: 'Investimentos', icon: '📈' },
    { path: '/debts', label: 'Dívidas', icon: '🔴' },
    { path: '/distribution', label: 'Distribuição', icon: '⚖️' },
    { path: '/forecast', label: 'Previsões ML', icon: '🤖' },
    { path: '/ir-chat', label: 'IR / Chat IA', icon: '🧑‍⚖️' },
    { path: '/settings', label: 'Configurações', icon: '⚙️' },
  ];

  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
}
