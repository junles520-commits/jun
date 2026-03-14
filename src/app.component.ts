import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen flex flex-col font-sans text-sm">
      <header class="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-chart-line text-blue-400 text-2xl"></i>
            <h1 class="text-xl font-bold tracking-tight">ETF Alpha <span class="text-blue-400">分析平台</span></h1>
          </div>
          <nav class="flex gap-4">
            <a routerLink="/" routerLinkActive="text-blue-400" [routerLinkActiveOptions]="{exact: true}" class="hover:text-blue-300 transition-colors font-medium">仪表盘</a>
            <a routerLink="/grid" routerLinkActive="text-blue-400" class="hover:text-blue-300 transition-colors font-medium">
               <i class="fa-solid fa-border-all mr-1"></i> K线网格
            </a>
            <a routerLink="/retracement" routerLinkActive="text-blue-400" class="hover:text-blue-300 transition-colors font-medium">
               <i class="fa-solid fa-chess-board mr-1"></i> 回撤系统
            </a>
            <a href="https://eastmoney.com" target="_blank" class="text-gray-400 hover:text-white text-xs flex items-center gap-1">
              数据来源 <i class="fa-solid fa-external-link-alt"></i>
            </a>
          </nav>
        </div>
      </header>

      <main class="flex-grow bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div class="max-w-7xl mx-auto">
          <router-outlet></router-outlet>
        </div>
      </main>

      <footer class="bg-white border-t border-gray-200 py-6 mt-8">
        <div class="max-w-7xl mx-auto px-4 text-center text-gray-500 text-xs">
          <p>&copy; 2024 ETF Alpha 分析平台. 本数据仅供分析参考。</p>
          <p class="mt-1">不构成投资建议。市场数据可能存在 15 分钟以上的延迟。</p>
        </div>
      </footer>
    </div>
  `
})
export class AppComponent {}