import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { catchError, forkJoin, of } from 'rxjs';

interface CalEvent {
  id?: number;
  label: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'DEBT' | 'RECURRING';
  status: string;
  source: string;
  icon: string;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  debts: DebtInstallment[];
  events: CalEvent[];
}

interface DebtInstallment {
  debtId: number;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  installmentAmount: number;
  remainingAmount: number;
  originalAmount: number;
  status: string;
  source: string;
  notes: string;
  dueDate: Date;
  alarmSet?: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  debts: any[] = [];
  transactions: any[] = [];
  currentDate = new Date();
  currentYear = this.currentDate.getFullYear();
  currentMonth = this.currentDate.getMonth();
  calendarDays: CalendarDay[] = [];
  weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  showDayModal = false;
  selectedDay: CalendarDay | null = null;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() {
    forkJoin([
      this.api.getDebts().pipe(catchError(() => of([]))),
      this.api.getTransactions({ start: this.currentYear - 1 + '-01-01', end: this.currentYear + 2 + '-12-31' })
        .pipe(catchError(() => of([])))
    ]).subscribe(([debts, txs]: any[]) => {
      this.debts = debts || [];
      this.transactions = txs || [];
      this.buildCalendar();
    });
  }

  reloadTx() {
    this.api.getTransactions({ start: this.currentYear - 1 + '-01-01', end: this.currentYear + 2 + '-12-31' })
      .pipe(catchError(() => of([])))
      .subscribe((txs: any[]) => {
        this.transactions = txs || [];
        this.buildCalendar();
      });
  }

  buildCalendar() {
    const year = this.currentYear;
    const month = this.currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = new Date();
    const days: CalendarDay[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const debts = this.getDebtsForDate(date);
      days.push({ date, day: prevMonthLastDay - i, isCurrentMonth: false, isToday: false,
        debts, events: this.getEventsForDate(date, debts) });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = date.toDateString() === today.toDateString();
      const debts = this.getDebtsForDate(date);
      days.push({ date, day: d, isCurrentMonth: true, isToday,
        debts, events: this.getEventsForDate(date, debts) });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const debts = this.getDebtsForDate(date);
      days.push({ date, day: i, isCurrentMonth: false, isToday: false,
        debts, events: this.getEventsForDate(date, debts) });
    }

    this.calendarDays = days;
  }

  getEventsForDate(date: Date, debtInstallments: DebtInstallment[] = []): CalEvent[] {
    const dateStr = date.toISOString().slice(0, 10);
    const events: CalEvent[] = [];

    for (const tx of this.transactions) {
      const txDate = (tx.date || '').slice(0, 10);
      if (txDate !== dateStr) continue;

      const isDebt    = tx.description?.startsWith('📋');
      const isResgate = tx.description?.startsWith('💎');
      const sameDebtInstallment = isDebt && debtInstallments.some(d =>
        tx.description?.includes(d.description || '') &&
        tx.description?.includes(`Parcela ${d.installmentNumber}/${d.totalInstallments}`)
      );
      if (sameDebtInstallment) continue;
      const icon = isDebt ? '📋' : isResgate ? '💎' : tx.isRecurring ? '↻' : tx.type === 'INCOME' ? '📈' : '📉';
      const evType: CalEvent['type'] = isDebt ? 'DEBT' : tx.isRecurring ? 'RECURRING' : tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

      events.push({
        id: tx.id,
        label: tx.description,
        amount: +tx.amount,
        type: evType,
        status: tx.status,
        source: tx.bankAccount?.name || tx.creditCard?.name || '—',
        icon,
      });
    }
    return events;
  }

  getDebtsForDate(date: Date): DebtInstallment[] {
    const installments: DebtInstallment[] = [];

    for (const debt of this.debts) {
      if (!debt.startDate || !debt.totalInstallments) continue;

      const startDate = new Date(debt.startDate);
      startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
      const totalInst   = +debt.totalInstallments;
      const paidInst    = +debt.paidInstallments || 0;
      const originalAmt = +debt.originalAmount || 0;
      const installmentAmt = totalInst > 0 ? originalAmt / totalInst : 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);

      for (let i = 0; i < totalInst; i++) {
        const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate.getFullYear() === date.getFullYear() &&
            dueDate.getMonth()    === date.getMonth()    &&
            dueDate.getDate()     === date.getDate()) {

          const isPaid    = i < paidInst;
          const isOverdue = !isPaid && dueDate.getTime() < today.getTime();
          const source    = debt.creditCard  ? '💳 ' + debt.creditCard.name
                          : debt.bankAccount ? '🏦 ' + debt.bankAccount.name : '—';

          installments.push({
            debtId: debt.id,
            description: debt.description,
            installmentNumber: i + 1,
            totalInstallments: totalInst,
            installmentAmount: installmentAmt,
            remainingAmount: +debt.remainingAmount || 0,
            originalAmount: originalAmt,
            status: isPaid ? 'PAID' : (isOverdue ? 'OVERDUE' : 'PENDING'),
            source, notes: debt.notes || '',
            dueDate
          });
        }
      }
    }
    return installments;
  }

  prevMonth() {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else { this.currentMonth--; }
    this.buildCalendar();
  }

  nextMonth() {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else { this.currentMonth++; }
    this.buildCalendar();
  }

  goToday() {
    const today = new Date();
    this.currentYear  = today.getFullYear();
    this.currentMonth = today.getMonth();
    this.buildCalendar();
  }

  openDayModal(day: CalendarDay) {
    if (day.debts.length === 0 && day.events.length === 0) return;
    this.selectedDay = day;
    this.showDayModal = true;
  }

  closeDayModal() {
    this.showDayModal = false;
    this.selectedDay = null;
  }

  get totalInstallmentsThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.length, 0);
  }

  get totalAmountThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.reduce((s, debt) => s + debt.installmentAmount, 0), 0);
  }

  get pendingThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.filter(debt => debt.status === 'PENDING').length, 0);
  }

  get overdueThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.filter(debt => debt.status === 'OVERDUE').length, 0);
  }

  get incomeThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.events.filter(e => e.type === 'INCOME')
        .reduce((s, e) => s + e.amount, 0), 0);
  }

  get expenseThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.events.filter(e => e.type === 'EXPENSE' || e.type === 'RECURRING')
        .reduce((s, e) => s + e.amount, 0), 0);
  }

  get totalEventsThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.events.length, 0);
  }

  get alarmsThisMonth(): number {
    return this.calendarDays.filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.filter(debt => debt.alarmSet).length, 0);
  }

  fmt(v: number) {
    return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00';
  }

  selectedDayTotal(): number {
    if (!this.selectedDay) return 0;
    return this.selectedDay.debts.reduce((sum, d) => sum + d.installmentAmount, 0);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PAID':    return '✅ Paga';
      case 'OVERDUE': return '🔴 Atrasada';
      default:        return '⏳ Pendente';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PAID':    return 'status-paid';
      case 'OVERDUE': return 'status-overdue';
      default:        return 'status-pending';
    }
  }

  eventTypeClass(type: CalEvent['type']): string {
    switch (type) {
      case 'INCOME':    return 'ev-income';
      case 'EXPENSE':   return 'ev-expense';
      case 'DEBT':      return 'ev-debt';
      case 'RECURRING': return 'ev-recurring';
      default:          return '';
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }
}
