import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ButtonComponent } from '../../components/button/button.component';
import { AppRouterService } from '../../services/router.service';
import { WelcomeComponent } from './welcome.component';

describe('WelcomeComponent', () => {
  let fixture: ComponentFixture<WelcomeComponent>;
  let toConfigsSpy: ReturnType<typeof vi.fn>;
  let toDocsSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    toConfigsSpy = vi.fn();
    toDocsSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [WelcomeComponent, ButtonComponent],
    })
      .overrideProvider(AppRouterService, {
        useValue: {
          toConfigs: toConfigsSpy,
          toDocs: toDocsSpy,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(WelcomeComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have logoSrc defined', () => {
    expect(fixture.componentInstance.logoSrc).toBe('/media/tressi-logo-512.png');
  });

  it('should render the logo with correct alt text', () => {
    const logo = fixture.nativeElement.querySelector('img');
    expect(logo).toBeTruthy();
    expect(logo.getAttribute('alt')).toBe('Tressi Logo');
    expect(logo.getAttribute('src')).toBe('/media/tressi-logo-512.png');
  });

  it('should render the welcome heading', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Welcome to Tressi');
  });

  it('should render the description text', () => {
    const paragraph = fixture.nativeElement.querySelector('p');
    expect(paragraph).toBeTruthy();
    expect(paragraph.textContent).toContain('Load test your APIs');
  });

  it('should render two buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('app-button');
    expect(buttons).toHaveLength(2);
  });

  it('should call toConfigs when Get Started button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('app-button');
    const getStartedButton = buttons[0];

    getStartedButton.click();

    expect(toConfigsSpy).toHaveBeenCalledTimes(1);
  });

  it('should call toDocs when Docs button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('app-button');
    const docsButton = buttons[1];

    docsButton.click();

    expect(toDocsSpy).toHaveBeenCalledWith('getting-started', 'intro');
  });
});
