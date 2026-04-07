import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: Date;
  id: string;
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
  @ViewChild('inputRef') inputRef!: ElementRef;

  messages: Message[] = [];
  inputText = '';
  loading = false;
  error = '';
  charCount = 0;
  private shouldScroll = false;

  quickCategories = [
    {
      label: '🧾 Declaração IR',
      prompts: [
        'Quais ativos devo declarar no IR este ano?',
        'Como declarar rendimentos de FIIs no IR?',
        'Quais são os limites de isenção do IR 2026?',
        'Como declarar criptomoedas no imposto de renda?',
      ]
    },
    {
      label: '📊 Ganho de Capital',
      prompts: [
        'Calcule meu imposto sobre ganho de capital em ações',
        'Quando posso vender ações sem pagar IR?',
        'Como calcular o custo médio das minhas ações?',
        'Day trade tem tratamento diferente no IR?',
      ]
    },
    {
      label: '💡 Planejamento',
      prompts: [
        'Como otimizar meus impostos sobre investimentos?',
        'O que é o carnê-leão e quando usar?',
        'Como usar prejuízos para compensar imposto?',
        'Quais despesas posso deduzir no IR?',
      ]
    },
    {
      label: '🎰 Apostas & Prêmios',
      prompts: [
        'Como declarar apostas esportivas no IR?',
        'Preciso declarar ganhos de loteria?',
        'Qual a alíquota de IR sobre prêmios?',
        'Como declarar prêmios em criptomoedas?',
      ]
    },
  ];

  selectedCategory = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    const saved = localStorage.getItem('ir-chat-history');
    if (saved) {
      try {
        this.messages = JSON.parse(saved).map((m: any) => ({ ...m, time: new Date(m.time), id: m.id || this.uid() }));
      } catch {}
    }
    if (this.messages.length === 0) {
      this.addMessage('assistant', `Olá! 👋 Sou seu assistente financeiro especialista em IR e finanças pessoais.\n\nTenho acesso aos seus dados financeiros e posso ajudar com:\n\n• 🧾 **Declaração de Imposto de Renda**\n• 📊 **Cálculo de ganho de capital**\n• 💡 **Planejamento tributário**\n• 📈 **Análise dos seus investimentos**\n• 🎰 **Apostas e prêmios**\n\nComo posso te ajudar hoje?`);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  uid() { return Math.random().toString(36).slice(2); }

  addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({ role, content, time: new Date(), id: this.uid() });
    this.shouldScroll = true;
    this.saveHistory();
  }

  async send(text?: string) {
    const msg = text || this.inputText.trim();
    if (!msg || this.loading) return;
    this.inputText = '';
    this.charCount = 0;
    this.error = '';
    this.addMessage('user', msg);
    this.loading = true;
    this.shouldScroll = true;

    const apiMessages = this.messages.slice(-14).map(m => ({ role: m.role, content: m.content }));

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
    if (confirm('Limpar todo o histórico do chat?')) {
      this.messages = [];
      localStorage.removeItem('ir-chat-history');
      this.addMessage('assistant', 'Histórico limpo! Como posso ajudar?');
    }
  }

  saveHistory() {
    localStorage.setItem('ir-chat-history', JSON.stringify(this.messages.slice(-60)));
  }

  scrollToBottom() {
    try { this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }); } catch {}
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  onInput(e: any) { this.charCount = e.target.value.length; }

  formatMessage(content: string): string {
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n• /g, '\n<span class="bullet">•</span> ')
      .replace(/\n/g, '<br>');
  }
}
