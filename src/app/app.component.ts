import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { AppService } from './app.service';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public loading = false;
  // Bound via the async pipe so the background updates under zoneless change
  // detection without a manual subscription/markForCheck.
  public readonly backgroundImage$: Observable<string>;

  constructor(private readonly appService: AppService) {
    this.backgroundImage$ = this.appService.backgroundImage$;
  }
}
