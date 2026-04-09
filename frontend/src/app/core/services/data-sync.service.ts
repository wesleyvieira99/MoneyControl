import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface DebtUpdatedPayload {
  debtId: number;
  paidInstallments: number;
  remainingAmount: number;
  debtStatus: string;
}

export interface SyncEventDebtUpdated   { type: 'DEBT_UPDATED';        payload: DebtUpdatedPayload; }
export interface SyncEventDebtsReloaded { type: 'DEBTS_RELOADED'; }
export interface SyncEventTxChanged     { type: 'TRANSACTIONS_CHANGED'; }
export interface SyncEventAcctChanged   { type: 'ACCOUNTS_CHANGED'; }

export type SyncEvent =
  | SyncEventDebtUpdated
  | SyncEventDebtsReloaded
  | SyncEventTxChanged
  | SyncEventAcctChanged;

@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private readonly _bus$ = new Subject<SyncEvent>();

  /** Subscribe in any component to react to cross-tab changes */
  readonly events$ = this._bus$.asObservable();

  emit(event: SyncEvent): void {
    this._bus$.next(event);
  }
}
