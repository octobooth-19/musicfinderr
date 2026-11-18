import { Component, input } from '@angular/core';

@Component({
  selector: 'app-album-art',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    @if (artwork()) {
      <img class="album-art" [class.small]="small()" [src]="artwork()" alt="Track artwork" referrerpolicy="no-referrer" />
    } @else {
      <div class="album-art" [class.small]="small()" role="img" aria-label="Rumours inspired album artwork">
        <div class="album-title">FLEETWOOD MAC<span>RUMOURS</span></div>
        <div class="art-moon"></div><div class="art-person one"></div>
        <div class="art-person two"></div><div class="art-line"></div>
      </div>
    }
  `,
})
export class AlbumArtComponent {
  readonly artwork = input<string>();
  readonly small = input(false);
}
