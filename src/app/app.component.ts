import { Component, ChangeDetectionStrategy, Signal, inject } from '@angular/core';
import { AppService } from './app.service';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet]
})
export class AppComponent {
  private readonly appService = inject(AppService);

  // Read directly as a signal; the template auto-tracks it under zoneless CD.
  public readonly backgroundImage: Signal<string> = this.appService.backgroundImage;
}
