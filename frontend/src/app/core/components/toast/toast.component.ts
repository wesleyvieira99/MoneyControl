import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let toast of toastSvc.toasts(); trackBy: trackById"
        class="toast"
        [class]="'toast--' + toast.type"
        [class.toast--removing]="toast.removing"
        (click)="toastSvc.remove(toast.id)"
      >
        <div class="toast-icon">{{ icons[toast.type] }}</div>
        <div class="toast-body">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-msg" *ngIf="toast.message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" (click)="$event.stopPropagation(); toastSvc.remove(toast.id)">✕</button>
        <div class="toast-progress">
          <div class="toast-progress-bar" [style.width.%]="toast.progress"></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent {
  toastSvc = inject(ToastService);

  icons: Record<string, string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  };

  trackById(_: number, t: Toast) { return t.id; }
}
