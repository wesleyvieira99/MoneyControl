import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { DataSyncService, SyncEvent } from '../../core/services/data-sync.service';
import { catchError, of, finalize, Subscription, firstValueFrom } from 'rxjs';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit, OnDestroy {
  debts: any[] = [];
  cards: any[] = [];
  accounts: any[] = [];
  showModal = false;
  editMode = false;
  form: any = this.emptyForm();
  debtProgressChart: EChartsOption = {};
  debtBreakdownChart: EChartsOption = {};
  syncing = false;
  syncMsg = '';

  showPaidModal = false;

  // Filter state
  filterStatus: 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID' = 'ALL';
  filterLink:   'ALL' | 'CARD' | 'ACCOUNT' | 'NONE'    = 'ALL';
  filterSearch  = '';
  filterSort:   'DEFAULT' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'PROGRESS_DESC' | 'NEXT_DUE' = 'DEFAULT';

  // Installment modal
  showInstallModal  = false;
  installModalDebt: any = null;
  installments:     any[] = [];
  installLoading    = false;
  installSaving     = false;
  installSaveError  = '';
  installFilter:    'ALL' | 'PAID' | 'PENDING' | 'OVERDUE' = 'ALL';
  installBatchBusy  = false;

  get filteredInstallments(): any[] {
    if (this.installFilter === 'ALL') return this.installments;
    return this.installments.filter(i => i.status === this.installFilter);
  }

  private _sub?: Subscription;

  constructor(private api: ApiService, private sync: DataSyncService) {}

  ngOnInit() {
    this.api.recomputeDebtStatus().pipe(catchError(() => of(null))).subscribe(() => this.loadAll());
    this.api.getCards().pipe(catchError(() => of([]))).subscribe(c => this.cards = c);
    this.api.getAccounts().pipe(catchError(() => of([]))).subscribe(a => this.accounts = a);
    // React to external changes (e.g. from cards page)
    this._sub = this.sync.events$.subscribe((ev: SyncEvent) => {
      if (ev.type === 'DEBT_UPDATED') {
        const d = this.debts.find(x => x.id === ev.payload.debtId);
        if (d) {
          d.paidInstallments = ev.payload.paidInstallments;
          d.remainingAmount  = ev.payload.remainingAmount;
          d.status           = ev.payload.debtStatus;
          this.buildCharts();
        }
      } else if (ev.type === 'DEBTS_RELOADED') {
        this.loadAll();
      }
    });
  }

  ngOnDestroy() { this._sub?.unsubscribe(); }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showInstallModal)  { this.closeInstallModal(); return; }
    if (this.showPaidModal)     { this.showPaidModal = false; return; }
    if (this.showModal)         { this.closeModal(); }
  }

  loadAll() {
    this.api.getDebts().pipe(catchError(() => of([]))).subscribe(d => { this.debts = d; this.buildCharts(); });
  }

  // Filters
  get filteredDebts(): any[] {
    let list = this.debts.filter(d => {
      const statusOk = this.filterStatus === 'ALL' || d.status === this.filterStatus;
      let linkOk = true;
      if      (this.filterLink === 'CARD')    linkOk = !!d.creditCard;
      else if (this.filterLink === 'ACCOUNT') linkOk = !!d.bankAccount;
      else if (this.filterLink === 'NONE')    linkOk = !d.creditCard && !d.bankAccount;
      const q = this.filterSearch.trim().toLowerCase();
      const searchOk = !q ||
        (d.description        || '').toLowerCase().includes(q) ||
        (d.creditCard?.name   || '').toLowerCase().includes(q) ||
        (d.bankAccount?.name  || '').toLowerCase().includes(q) ||
        (d.notes              || '').toLowerCase().includes(q);
      return statusOk && linkOk && searchOk;
    });
    switch (this.filterSort) {
      case 'AMOUNT_DESC':   list = [...list].sort((a,b)=>b.remainingAmount-a.remainingAmount); break;
      case 'AMOUNT_ASC':    list = [...list].sort((a,b)=>a.remainingAmount-b.remainingAmount); break;
      case 'PROGRESS_DESC': list = [...list].sort((a,b)=>this.progress(b)-this.progress(a));  break;
      case 'NEXT_DUE':      list = [...list].sort((a,b)=>{
        const da=this.nextDueDateRaw(a), db=this.nextDueDateRaw(b);
        if (!da&&!db) return 0; if (!da) return 1; if (!db) return -1;
        return da.getTime()-db.getTime();
      }); break;
    }
    return list;
  }

  // Show all filteredDebts in the grid; only hide PAID when no PAID filter is active
  get activeDebts(): any[] {
    if (this.filterStatus === 'PAID') return this.filteredDebts;
    return this.filteredDebts.filter(d => d.status !== 'PAID');
  }
  get paidDebts():       any[] { return this.debts.filter(d => d.status === 'PAID'); }
  get allVisibleDebts(): any[] { return this.filteredDebts; }

  setFilterStatus(s: typeof this.filterStatus) { this.filterStatus = s; }
  setFilterLink(l: typeof this.filterLink)     { this.filterLink = l; }
  setFilterSort(s: typeof this.filterSort)     { this.filterSort = s; }
  clearFilters() {
    this.filterStatus='ALL'; this.filterLink='ALL'; this.filterSearch=''; this.filterSort='DEFAULT';
  }
  get hasActiveFilter(): boolean {
    return this.filterStatus!=='ALL'||this.filterLink!=='ALL'||!!this.filterSearch.trim()||this.filterSort!=='DEFAULT';
  }

  // Per-debt helpers
  overdueCount(d: any): number {
    if (d.perennial || !d.startDate || !d.totalInstallments) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const paid = d.paidInstallments || 0;
    const start = new Date(d.startDate + 'T00:00:00');
    let count = 0;
    for (let i = paid; i < d.totalInstallments; i++) {
      const due = new Date(start.getFullYear(), start.getMonth()+i, start.getDate());
      if (due < today) count++;
    }
    return count;
  }

  nextDueDateRaw(d: any): Date | null {
    if (d.perennial || !d.startDate || !d.totalInstallments) return null;
    const paid = d.paidInstallments || 0;
    if (paid >= d.totalInstallments) return null;
    const start = new Date(d.startDate + 'T00:00:00');
    return new Date(start.getFullYear(), start.getMonth()+paid, start.getDate());
  }

  nextDueDate(d: any): string | null {
    const date = this.nextDueDateRaw(d);
    return date ? date.toLocaleDateString('pt-BR') : null;
  }

  isDueSoon(d: any): boolean {
    const date = this.nextDueDateRaw(d);
    if (!date) return false;
    const diff = (date.getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 7;
  }

  installmentValue(d: any): number {
    if (!d.totalInstallments || d.totalInstallments === 0) return d.originalAmount;
    return d.originalAmount / d.totalInstallments;
  }

  // Installment modal
  openInstallments(d: any) {
    if (d.perennial) return;
    this.installModalDebt = d;
    this.showInstallModal = true;
    this.installments = [];
    this.installSaveError = '';
    this.installFilter = 'ALL';
    this.installBatchBusy = false;
    this.refreshInstallments(d.id);
  }

  refreshInstallments(debtId: number) {
    this.installLoading = true;
    this.api.getDebtInstallments(debtId)
      .pipe(catchError(() => of([])))
      .subscribe(list => { this.installments = list; this.installLoading = false; });
  }

  toggleInstallment(installment: any) {
    if (this.installSaving) return;
    const debtId = this.installModalDebt?.id;
    if (!debtId) return;

    const newStatus = installment.status === 'PAID' ? 'PENDING' : 'PAID';
    const prev      = installment.status;
    this.installSaving    = true;
    this.installSaveError = '';
    installment.status    = newStatus; // optimistic update

    this.api.patchDebtInstallment(debtId, installment.installmentNumber, newStatus)
      .pipe(
        finalize(() => { this.installSaving = false; }),
        catchError(err => {
          installment.status    = prev;          // rollback optimistic
          this.installSaveError = 'Erro ao salvar. Verifique sua conexão.';
          return of(null);
        })
      )
      .subscribe(res => {
        if (!res) return; // error already handled in catchError
        // Update in-memory debt list
        const debt = this.debts.find(d => d.id === debtId);
        if (debt) {
          debt.paidInstallments = res.paidInstallments;
          debt.remainingAmount  = res.remainingAmount;
          debt.status           = res.debtStatus;
        }
        // Update modal header strip live
        if (this.installModalDebt?.id === debtId) {
          this.installModalDebt = {
            ...this.installModalDebt,
            paidInstallments: res.paidInstallments,
            remainingAmount:  res.remainingAmount,
            status:           res.debtStatus
          };
        }
        // Broadcast to other tabs (cards, accounts, transactions)
        this.sync.emit({
          type: 'DEBT_UPDATED',
          payload: {
            debtId,
            paidInstallments: res.paidInstallments,
            remainingAmount:  res.remainingAmount,
            debtStatus:       res.debtStatus
          }
        });
        // Re-fetch installments to reflect real DB state
        this.refreshInstallments(debtId);
        this.buildCharts();
      });
  }

  closeInstallModal() {
    this.showInstallModal = false; this.installModalDebt = null; this.installments = [];
  }

  /** Batch-toggle all visible (filtered) installments to the given status sequentially */
  async markAllInstallments(targetStatus: 'PAID' | 'PENDING') {
    if (this.installBatchBusy || this.installSaving) return;
    const debtId = this.installModalDebt?.id;
    if (!debtId) return;
    const toToggle = this.filteredInstallments.filter(i => i.status !== targetStatus);
    if (!toToggle.length) return;
    this.installBatchBusy = true;
    this.installSaveError = '';
    // Optimistic update on all visible
    for (const inst of toToggle) { inst.status = targetStatus; }
    let lastRes: any = null;
    try {
      for (const inst of toToggle) {
        lastRes = await firstValueFrom(
          this.api.patchDebtInstallment(debtId, inst.installmentNumber, targetStatus)
        );
      }
    } catch {
      this.installSaveError = 'Erro ao salvar algumas parcelas.';
    } finally {
      this.installBatchBusy = false;
      // Sync debt card & header with last server response
      if (lastRes) {
        const debt = this.debts.find(d => d.id === debtId);
        if (debt) {
          debt.paidInstallments = lastRes.paidInstallments;
          debt.remainingAmount  = lastRes.remainingAmount;
          debt.status           = lastRes.debtStatus;
        }
        if (this.installModalDebt?.id === debtId) {
          this.installModalDebt = {
            ...this.installModalDebt,
            paidInstallments: lastRes.paidInstallments,
            remainingAmount:  lastRes.remainingAmount,
            status:           lastRes.debtStatus
          };
        }
        this.sync.emit({
          type: 'DEBT_UPDATED',
          payload: { debtId, paidInstallments: lastRes.paidInstallments, remainingAmount: lastRes.remainingAmount, debtStatus: lastRes.debtStatus }
        });
        this.buildCharts();
      }
      this.refreshInstallments(debtId);
    }
  }

  get installPaidCount()    { return this.installments.filter(i => i.status === 'PAID').length; }
  get installOverdueCount() { return this.installments.filter(i => i.status === 'OVERDUE').length; }
  get installPendingCount() { return this.installments.filter(i => i.status === 'PENDING').length; }
  get installProgress() {
    return this.installments.length
      ? Math.round((this.installPaidCount / this.installments.length) * 100) : 0;
  }

  // Charts
  buildCharts() {
    if (!this.debts.length) return;
    const top5   = [...this.debts].sort((a,b)=>b.originalAmount-a.originalAmount).slice(0,5);
    const sorted = [...this.debts].sort((a,b)=>b.remainingAmount-a.remainingAmount).slice(0,8);
    const PALETTE = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444'];

    this.debtProgressChart = {
      backgroundColor: 'transparent',
      animation: true, animationDuration: 1200, animationEasing: 'cubicOut' as any,
      tooltip: {
        trigger: 'item', backgroundColor:'rgba(8,12,28,0.96)', borderColor:'rgba(139,92,246,0.35)',
        borderWidth:1, padding:[12,16], textStyle:{color:'#f1f5f9',fontSize:12}
      },
      series: top5.map((d,i)=>{
        const pct=d.totalInstallments>0?Math.round((d.paidInstallments/d.totalInstallments)*100):0;
        const col=PALETTE[i%PALETTE.length]; const w=100/5;
        return {
          type:'gauge', center:[`${w*i+w/2}%`,'55%'], radius:'42%',
          startAngle:200, endAngle:-20, min:0, max:100,
          progress:{show:true,width:8,roundCap:true,itemStyle:{color:col}},
          axisLine:{lineStyle:{width:8,color:[[1,'rgba(255,255,255,0.06)']]}},
          axisTick:{show:false}, splitLine:{show:false}, axisLabel:{show:false},
          pointer:{show:false}, anchor:{show:false},
          title:{offsetCenter:[0,'68%'],fontSize:9,color:'#64748b',fontFamily:'Inter'},
          detail:{valueAnimation:true,fontSize:13,fontWeight:800,color:col,
                  offsetCenter:[0,'18%'],formatter:'{value}%',fontFamily:'Inter'},
          data:[{value:pct,name:d.description?.slice(0,10)||'Dívida'}]
        };
      }) as any
    } as EChartsOption;

    this.debtBreakdownChart = {
      backgroundColor:'transparent',
      animation:true, animationDuration:1000, animationEasing:'cubicOut' as any,
      tooltip:{
        trigger:'axis', backgroundColor:'rgba(8,12,28,0.96)', borderColor:'rgba(139,92,246,0.35)',
        borderWidth:1, padding:[12,16], textStyle:{color:'#f1f5f9',fontSize:13},
        formatter:(p:any)=>`<b style="color:#e2e8f0">${p[0]?.name}</b><br/><span style="color:#94a3b8">Restante: </span><b style="color:#ef4444">R$ ${Number(p[0]?.value).toLocaleString('pt-BR',{minimumFractionDigits:2})}</b>`
      },
      grid:{left:8,right:24,top:8,bottom:8,containLabel:true},
      xAxis:{type:'value',axisLabel:{show:false},splitLine:{lineStyle:{color:'rgba(255,255,255,0.04)',type:'dashed'}},axisLine:{show:false}},
      yAxis:{type:'category',data:sorted.map(d=>d.description?.slice(0,16)||'—'),axisLabel:{color:'#94a3b8',fontSize:11},axisLine:{show:false},axisTick:{show:false}},
      series:[{
        type:'bar', barMaxWidth:22,
        data:sorted.map(d=>{
          const pct=d.totalInstallments>0?d.paidInstallments/d.totalInstallments:0;
          const col=pct>0.7?'#10b981':pct>0.4?'#f59e0b':'#ef4444';
          return{value:+d.remainingAmount,itemStyle:{color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:col},{offset:1,color:col+'aa'}]},borderRadius:[0,8,8,0],shadowBlur:6,shadowColor:col+'55'}};
        }),
        label:{show:true,position:'right',color:'#64748b',fontSize:10,formatter:(p:any)=>'R$'+(Math.abs(p.value)>=1000?(p.value/1000).toFixed(1)+'k':p.value.toFixed(0))},
        emphasis:{itemStyle:{shadowBlur:16}}
      }]
    } as EChartsOption;
  }

  openNew()  { this.editMode=false; this.form=this.emptyForm(); this.showModal=true; }
  openEdit(d: any) {
    this.editMode=true;
    this.form={...d,creditCardId:d.creditCard?.id,bankAccountId:d.bankAccount?.id};
    this.showModal=true;
  }
  closeModal()  { this.showModal=false; }
  reloadDebts() { this.loadAll(); }

  save() {
    const payload={
      ...this.form,
      creditCard:  this.form.creditCardId  ? {id:+this.form.creditCardId}  : null,
      bankAccount: this.form.bankAccountId ? {id:+this.form.bankAccountId} : null,
      perennial: !!this.form.perennial,
    };
    const obs=this.editMode?this.api.updateDebt(this.form.id,payload):this.api.createDebt(payload);
    obs.subscribe({next:()=>{this.closeModal();this.loadAll();},error:()=>this.closeModal()});
  }

  delete(id: number) {
    if (confirm('Excluir dívida?'))
      this.api.deleteDebt(id).subscribe({next:()=>this.loadAll(),error:()=>{}});
  }

  progress(d: any) { return d.totalInstallments>0?(d.paidInstallments/d.totalInstallments)*100:0; }
  fmt(v: number)   { return v?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})??''; }
  totalDebt()      { return this.debts.reduce((s,d)=>s+ +d.remainingAmount,0); }
  countByStatus(status: string) { return this.debts.filter(d=>d.status===status).length; }

  syncTransactions() {
    this.syncing=true; this.syncMsg='';
    this.api.syncDebtTransactions().subscribe({
      next:(res:any)=>{
        this.syncing=false;
        this.syncMsg=typeof res==='string'?res:(res?.message||'Sincronizado!');
        setTimeout(()=>this.syncMsg='',6000);
        this.loadAll();
      },
      error:()=>{this.syncing=false;this.syncMsg='Erro ao sincronizar.';}
    });
  }

  emptyForm() {
    return {
      description:'', originalAmount:0, remainingAmount:0,
      totalInstallments:12, paidInstallments:0,
      startDate: new Date().toISOString().slice(0,10),
      status:'PENDING', notes:'', creditCardId:null, bankAccountId:null,
      perennial:false, dueDayOfMonth:1,
      perennialStartDate: new Date().toISOString().slice(0,10)
    };
  }
}
