import { Component } from '@angular/core';
import { AppService } from './app.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public loading = false;
  public backgroundImage = 'assets/bg1.jpg';

  constructor(private appService: AppService) {
    this.appService.backgroundImage$.subscribe(image => {
      this.backgroundImage = image;
    });
  }
}
