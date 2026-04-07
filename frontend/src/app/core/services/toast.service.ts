import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  progress: number; // 0-100
  removing: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(type: ToastType, title: string, message?: string, duration = 4000) {
    const id = this.nextId++;
    const toast: Toast = { id, type, title, message, duration, progress: 100, removing: false };
    this.toasts.update(list => [...list, toast]);

    // Progress countdown
    const interval = 50;
    const steps = duration / interval;
    const decrement = 100 / steps;
    let current = 100;

    const timer = setInterval(() => {
      current -= decrement;
      if (current <= 0) {
        clearInterval(timer);
        this.remove(id);
      } else {
        this.toasts.update(list =>
          list.map(t => t.id === id ? { ...t, progress: Math.max(0, current) } : t)
        );
      }
    }, interval);
  }

  success(title: string, message?: string, duration = 4000) { this.show('success', title, message, duration); }
  error(title: string, message?: string, duration = 6000)   { this.show('error',   title, message, duration); }
  warning(title: string, message?: string, duration = 5000) { this.show('warning', title, message, duration); }
  info(title: string, message?: string, duration = 4000)    { this.show('info',    title, message, duration); }

  remove(id: number) {
    // First mark as removing (triggers exit animation)
    this.toasts.update(list => list.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      this.toasts.update(list => list.filter(t => t.id !== id));
    }, 350);
  }
}
