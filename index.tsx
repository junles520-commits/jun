
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation, Routes } from '@angular/router';
import { provideHttpClient, withJsonpSupport } from '@angular/common/http';
import { AppComponent } from './src/app.component';
import { HomeComponent } from './src/components/home/home.component';
import { DetailComponent } from './src/components/detail/detail.component';
import { RetracementComponent } from './src/components/retracement/retracement.component';
import { ChartGridComponent } from './src/components/chart-grid/chart-grid.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'grid', component: ChartGridComponent },
  { path: 'detail/:code', component: DetailComponent },
  { path: 'retracement', component: RetracementComponent },
  { path: '**', redirectTo: '' }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withJsonpSupport())
  ]
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.