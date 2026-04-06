import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: Date;
}

@Component({
  selector: 'app-ir-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ir-chat.component.html',
  styleUrls: ['./ir-chat.component.scss']
})
export class IrChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  messages: Message[] = [];
  inputText = '';
  loading = false;
  error = '';

  quickPrompts = [
    '💰 Quais ativos devo declarar no IR?',
    '📊 Calcule meu imposto sobre ganho de capital',
    '📅 Quais os prazos para declaração?',
    '💡 Como otimizar meus impostos sobre investimentos?',
    '🎰 Como declarar apostas esportivas no IR?',
    '📋 O que é o carnê-leão e quando usar?',
  ];

  constructor(private api: ApiService) {}

  ngOnInit() {
    const saved = localStorage.getItem('ir-chat-history');
    if (saved) {
      try {
        this.messages = JSON.parse(saved).map((m: any) => ({ ...m, time: new Date(m.time) }));
      } catch {}
    }
    if (this.messages.length === 0) {
      this.addMessage('assistant', 'Olá! 👋 Sou seu assistente financeiro especialista em IR. Tenho acesso aos seus dados financeiros e posso ajudar com dúvidas sobre imposto de renda, declarações, ganho de capital, e muito mais. Como posso ajudar?');
    }
  }

  ngAfterViewChecked() { this.scrollToBottom(); }

  addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({ role, content, time: new Date() });
    this.saveHistory();
  }

  async send(text?: string) {
    const msg = text || this.inputText.trim();
    if (!msg || this.loading) return;
    this.inputText = '';
    this.error = '';
    this.addMessage('user', msg);
    this.loading = true;

    const apiMessages = this.messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    this.api.aiChat(apiMessages).subscribe({
      next: (res: any) => {
        const content = res?.choices?.[0]?.message?.content || 'Desculpe, não consegui obter uma resposta.';
        this.addMessage('assistant', content);
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.error || 'Erro ao conectar com a IA. Verifique a chave API nas configurações.';
        this.loading = false;
      }
    });
  }

  clearHistory() {
    if (confirm('Limpar histórico do chat?')) {
      this.messages = [];
      localStorage.removeItem('ir-chat-history');
      this.addMessage('assistant', 'Histórico limpo! Como posso ajudar?');
    }
  }

  saveHistory() {
    localStorage.setItem('ir-chat-history', JSON.stringify(this.messages.slice(-50)));
  }

  scrollToBottom() {
    try { this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }); } catch {}
  }

  onKeyDown(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } }
}
