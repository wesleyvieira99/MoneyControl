import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { catchError, of } from 'rxjs';

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  debts: DebtInstallment[];
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
  alarmSet: boolean;
}

interface ScheduledAlarm {
  debtId: number;
  description: string;
  dueDate: string;
  phone: string;
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
  currentDate = new Date();
  currentYear = this.currentDate.getFullYear();
  currentMonth = this.currentDate.getMonth();
  calendarDays: CalendarDay[] = [];
  weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Modal
  showDayModal = false;
  selectedDay: CalendarDay | null = null;

  // Alarm modal
  showAlarmModal = false;
  alarmDebt: DebtInstallment | null = null;
  alarmPhone = '5511985536310';

  // Stored alarms
  alarms: ScheduledAlarm[] = [];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() {
    this.loadAlarms();
    this.api.getDebts().pipe(catchError(() => of([]))).subscribe(d => {
      this.debts = d;
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

    // Previous month fill
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: false,
        debts: this.getDebtsForDate(date)
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = date.toDateString() === today.toDateString();
      days.push({
        date,
        day: d,
        isCurrentMonth: true,
        isToday,
        debts: this.getDebtsForDate(date)
      });
    }

    // Next month fill to complete 6 rows (42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        day: i,
        isCurrentMonth: false,
        isToday: false,
        debts: this.getDebtsForDate(date)
      });
    }

    this.calendarDays = days;
  }

  getDebtsForDate(date: Date): DebtInstallment[] {
    const installments: DebtInstallment[] = [];

    for (const debt of this.debts) {
      if (!debt.startDate || !debt.totalInstallments) continue;

      const startDate = new Date(debt.startDate + 'T00:00:00');
      const totalInst = +debt.totalInstallments;
      const paidInst = +debt.paidInstallments || 0;
      const originalAmt = +debt.originalAmount || 0;
      const installmentAmt = totalInst > 0 ? originalAmt / totalInst : 0;

      for (let i = 0; i < totalInst; i++) {
        const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());

        if (dueDate.getFullYear() === date.getFullYear() &&
            dueDate.getMonth() === date.getMonth() &&
            dueDate.getDate() === date.getDate()) {

          const isPaid = i < paidInst;
          const isOverdue = !isPaid && dueDate < new Date();
          const source = debt.creditCard ? '💳 ' + debt.creditCard.name :
                        (debt.bankAccount ? '🏦 ' + debt.bankAccount.name : '—');

          installments.push({
            debtId: debt.id,
            description: debt.description,
            installmentNumber: i + 1,
            totalInstallments: totalInst,
            installmentAmount: installmentAmt,
            remainingAmount: +debt.remainingAmount || 0,
            originalAmount: originalAmt,
            status: isPaid ? 'PAID' : (isOverdue ? 'OVERDUE' : 'PENDING'),
            source,
            notes: debt.notes || '',
            dueDate,
            alarmSet: this.isAlarmSet(debt.id, dueDate)
          });
        }
      }
    }
    return installments;
  }

  // Navigation
  prevMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.buildCalendar();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.buildCalendar();
  }

  goToday() {
    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth();
    this.buildCalendar();
  }

  // Day modal
  openDayModal(day: CalendarDay) {
    if (day.debts.length === 0) return;
    this.selectedDay = day;
    this.showDayModal = true;
  }

  closeDayModal() {
    this.showDayModal = false;
    this.selectedDay = null;
  }

  // Alarm modal
  openAlarmModal(debt: DebtInstallment, event: Event) {
    event.stopPropagation();
    this.alarmDebt = debt;
    this.showAlarmModal = true;
  }

  closeAlarmModal() {
    this.showAlarmModal = false;
    this.alarmDebt = null;
  }

  scheduleAlarm() {
    if (!this.alarmDebt) return;

    const alarm: ScheduledAlarm = {
      debtId: this.alarmDebt.debtId,
      description: this.alarmDebt.description,
      dueDate: this.alarmDebt.dueDate.toISOString().slice(0, 10),
      phone: this.alarmPhone,
    };

    this.alarms.push(alarm);
    this.saveAlarms();

    // Build WhatsApp message for 1 day before
    const dueDate = new Date(this.alarmDebt.dueDate);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    const formattedDue = dueDate.toLocaleDateString('pt-BR');
    const installmentAmt = this.fmt(this.alarmDebt.installmentAmount);
    const message = `⚠️ *MoneyControl - Lembrete de Vencimento*\n\n` +
      `📌 *${this.alarmDebt.description}*\n` +
      `💰 Parcela ${this.alarmDebt.installmentNumber}/${this.alarmDebt.totalInstallments}: *${installmentAmt}*\n` +
      `📅 Vence amanhã: *${formattedDue}*\n\n` +
      `⏰ Não esqueça de pagar!`;

    const phoneClean = this.alarmPhone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    this.alarmDebt.alarmSet = true;
    this.toast.success('Alarme agendado!', `Lembrete configurado para ${this.alarmDebt.description}`);
    this.closeAlarmModal();
    this.buildCalendar();
  }

  removeAlarm(debt: DebtInstallment, event: Event) {
    event.stopPropagation();
    const dateStr = debt.dueDate.toISOString().slice(0, 10);
    this.alarms = this.alarms.filter(a => !(a.debtId === debt.debtId && a.dueDate === dateStr));
    this.saveAlarms();
    debt.alarmSet = false;
    this.toast.info('Alarme removido', `Lembrete de ${debt.description} foi removido`);
    this.buildCalendar();
  }

  // Alarm persistence
  isAlarmSet(debtId: number, dueDate: Date): boolean {
    const dateStr = dueDate.toISOString().slice(0, 10);
    return this.alarms.some(a => a.debtId === debtId && a.dueDate === dateStr);
  }

  loadAlarms() {
    try {
      const stored = localStorage.getItem('mc-calendar-alarms');
      this.alarms = stored ? JSON.parse(stored) : [];
    } catch {
      this.alarms = [];
    }
  }

  saveAlarms() {
    localStorage.setItem('mc-calendar-alarms', JSON.stringify(this.alarms));
  }

  // Summary stats
  get totalInstallmentsThisMonth(): number {
    return this.calendarDays
      .filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.length, 0);
  }

  get totalAmountThisMonth(): number {
    return this.calendarDays
      .filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.reduce((s, debt) => s + debt.installmentAmount, 0), 0);
  }

  get pendingThisMonth(): number {
    return this.calendarDays
      .filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.filter(debt => debt.status === 'PENDING').length, 0);
  }

  get overdueThisMonth(): number {
    return this.calendarDays
      .filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.filter(debt => debt.status === 'OVERDUE').length, 0);
  }

  get alarmsThisMonth(): number {
    return this.calendarDays
      .filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.debts.filter(debt => debt.alarmSet).length, 0);
  }

  // Helpers
  fmt(v: number) { return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'; }

  selectedDayTotal(): number {
    if (!this.selectedDay) return 0;
    return this.selectedDay.debts.reduce((sum, d) => sum + d.installmentAmount, 0);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PAID': return '✅ Paga';
      case 'OVERDUE': return '🔴 Atrasada';
      default: return '⏳ Pendente';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'status-paid';
      case 'OVERDUE': return 'status-overdue';
      default: return 'status-pending';
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
}
