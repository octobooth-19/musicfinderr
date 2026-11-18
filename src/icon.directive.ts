import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import {
  AudioLines, ArrowUpRight, ArrowRight, ChevronRight, Plus, Minus, Search, Bookmark,
  Clock3, CircleHelp, Settings2, Link2, Upload, Play, Pause, SkipBack, Volume2, VolumeX,
  Repeat2, Check, X, Music2, Headphones, Sparkles, Download, ExternalLink, LoaderCircle,
  Disc3, Command, Menu, Guitar, Piano, CheckCircle2, Info, SlidersHorizontal,
} from 'lucide';

const icons = {
  AudioLines, ArrowUpRight, ArrowRight, ChevronRight, Plus, Minus, Search, Bookmark,
  Clock3, CircleHelp, Settings2, Link2, Upload, Play, Pause, SkipBack, Volume2, VolumeX,
  Repeat2, Check, X, Music2, Headphones, Sparkles, Download, ExternalLink, LoaderCircle,
  Disc3, Command, Menu, Guitar, Piano, CheckCircle2, Info, SlidersHorizontal,
};

const providerPaths = {
  YouTube: 'M23 7a3 3 0 0 0-2.1-2.1C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7a31 31 0 0 0-.5 5A31 31 0 0 0 1 17a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 17a31 31 0 0 0 .5-5A31 31 0 0 0 23 7ZM9.7 15.3V8.7l5.8 3.3Z',
  Spotify: 'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.8.8 0 0 1-1.1.3c-3-1.8-6.7-1.4-9.2-.8a.8.8 0 1 1-.4-1.5c2.8-.7 6.9-1.1 10.4.9.4.2.5.7.3 1.1Zm1.5-3.1a1 1 0 0 1-1.3.3c-3.3-2-8.1-2.3-11.9-1.2a1 1 0 0 1-.6-1.8c4.3-1.3 9.6-.9 13.5 1.4.4.3.6.9.3 1.3Zm.1-3.2C15.2 8.7 8.8 8.5 5.1 9.6a1.1 1.1 0 0 1-.7-2.1c4.3-1.3 11.4-1.1 15.8 1.5a1.1 1.1 0 1 1-1.1 2Z',
};

@Directive({
  selector: 'svg[appIcon]',
  standalone: true,
  host: {
    'viewBox': '0 0 24 24',
    '[attr.width]': 'size()',
    '[attr.height]': 'size()',
    '[attr.fill]': 'filled() ? "currentColor" : "none"',
    '[attr.stroke]': 'filled() ? "none" : "currentColor"',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    'focusable': 'false',
  },
})
export class IconDirective {
  readonly appIcon = input.required<keyof typeof icons | keyof typeof providerPaths>();
  readonly size = input(17);
  private readonly element = inject<ElementRef<SVGElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  readonly filled = () => this.appIcon() === 'YouTube' || this.appIcon() === 'Spotify';

  constructor() {
    effect(() => {
      const name = this.appIcon();
      const host = this.element.nativeElement;
      while (host.firstChild) this.renderer.removeChild(host, host.firstChild);
      if (name === 'YouTube' || name === 'Spotify') {
        const path = this.renderer.createElement('path', 'svg');
        this.renderer.setAttribute(path, 'd', providerPaths[name]);
        this.renderer.appendChild(host, path);
      } else {
        for (const [tag, attributes] of icons[name][2] || []) {
          const child = this.renderer.createElement(tag, 'svg');
          for (const [key, value] of Object.entries(attributes)) this.renderer.setAttribute(child, key, String(value));
          this.renderer.appendChild(host, child);
        }
      }
    });
  }
}
