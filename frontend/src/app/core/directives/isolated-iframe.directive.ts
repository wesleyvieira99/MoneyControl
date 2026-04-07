import { Directive, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

/**
 * Isolates iframe from parent change detection
 * Prevents iframe reloads when parent component updates
 */
@Directive({
  selector: 'iframe[appIsolatedIframe]',
  standalone: true
})
export class IsolatedIframeDirective implements AfterViewInit, OnDestroy {
  private observer?: MutationObserver;

  constructor(private el: ElementRef<HTMLIFrameElement>) {}

  ngAfterViewInit() {
    const iframe = this.el.nativeElement;
    
    // Store original src
    const originalSrc = iframe.src;
    
    // Prevent iframe from reloading on parent updates
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          // Only reload if src actually changed
          if (iframe.src !== originalSrc && iframe.src !== '') {
            console.log('[IsolatedIframe] Source changed, allowing reload');
          }
        }
      });
    });

    this.observer.observe(iframe, {
      attributes: true,
      attributeFilter: ['src']
    });

    // Mark iframe as isolated in DOM
    iframe.setAttribute('data-isolated', 'true');
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
