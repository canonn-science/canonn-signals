import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { preloadDialogFontSubsets } from './app/preload-fonts';

// Warm the Roboto subsets only the dialogs use, in parallel with bootstrap, so the
// first dialog open doesn't fetch+swap fonts and visibly reflow. See preload-fonts.ts.
preloadDialogFontSubsets();

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
