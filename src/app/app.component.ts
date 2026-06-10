import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppService } from './app.service';
import { RouterOutlet } from '@angular/router';
import { MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, MatSidenavContainer, MatSidenavContent, AsyncPipe]
})
export class AppComponent {
  private readonly appService = inject(AppService);

  // Bound via the async pipe so the background updates under zoneless change
  // detection without a manual subscription/markForCheck.
  public readonly backgroundImage$: Observable<string>;

  constructor() {
    this.backgroundImage$ = this.appService.backgroundImage$;
  }
}
