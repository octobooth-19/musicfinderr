import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent).catch(error => {
  console.error('Keynote could not start:', error);
  const root = document.querySelector('app-root');
  if (root) root.textContent = 'Keynote could not start. Please refresh the page.';
});
