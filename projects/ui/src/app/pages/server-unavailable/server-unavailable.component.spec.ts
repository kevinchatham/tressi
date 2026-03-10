import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logoSrc } from '../../constants';
import { HealthService } from '../../services/health.service';
import { ServerUnavailableComponent } from './server-unavailable.component';

describe('ServerUnavailableComponent', () => {
  let component: ServerUnavailableComponent;
  let fixture: ComponentFixture<ServerUnavailableComponent>;
  let mockHealthService: {
    getRetryMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockHealthService = {
      getRetryMessage: vi.fn().mockReturnValue('Reconnecting...'),
    };

    await TestBed.configureTestingModule({
      imports: [ServerUnavailableComponent],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerUnavailableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have the correct logo source', () => {
    expect(component.logoSrc).toBe(logoSrc);
    const img = fixture.nativeElement.querySelector('img');
    expect(img.src).toContain(logoSrc);
  });

  it('should display the retry message from health service', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    // The retry message is in the first span with these classes
    const spans = compiled.querySelectorAll('span.text-base-content\\/50');
    const retryMessageSpan = Array.from(spans).find((s) =>
      s.classList.contains('text-xs'),
    );
    expect(retryMessageSpan?.textContent?.trim()).toBe('Reconnecting...');
    expect(mockHealthService.getRetryMessage).toHaveBeenCalled();
  });

  it('should display the offline message and command', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe(
      'Tressi is offline, please start the server',
    );
    expect(compiled.querySelector('code')?.textContent?.trim()).toBe(
      'npx tressi serve',
    );
  });

  it('should show the loading spinner', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const spinner = compiled.querySelector('.loading.loading-infinity');
    expect(spinner).toBeTruthy();
  });
});
