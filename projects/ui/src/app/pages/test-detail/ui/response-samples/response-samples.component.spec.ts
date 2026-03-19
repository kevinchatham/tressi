import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { ResponseSample } from '@tressi/shared/ui';
import { describe, expect, it, vi } from 'vitest';

import { ResponseSamplesComponent } from './response-samples.component';

describe('ResponseSamplesComponent', () => {
  let component: ResponseSamplesComponent;
  let fixture: ComponentFixture<ResponseSamplesComponent>;

  const mockSamples: ResponseSample[] = [
    {
      body: '{"status":"ok"}',
      headers: { 'content-type': 'application/json' },
      statusCode: 200,
    },
    {
      body: 'Not Found',
      headers: { 'content-type': 'text/plain' },
      statusCode: 404,
    },
    {
      body: '{"error":"internal"}',
      headers: { 'content-type': 'application/json' },
      statusCode: 500,
    },
  ];

  const mockDistribution = {
    '200': 100,
    '404': 10,
    '500': 5,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResponseSamplesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ResponseSamplesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit collapsedChange when onCollapsedChange is called', () => {
    const spy = vi.spyOn(component.collapsedChange, 'emit');
    component.onCollapsedChange(true);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('should return available status codes', () => {
    fixture.componentRef.setInput('statusCodeDistribution', mockDistribution);
    expect(component.getAvailableStatusCodes()).toEqual(['all', '200', '404', '500']);
  });

  it('should return filtered samples', () => {
    fixture.componentRef.setInput('responseSamples', mockSamples);
    component.selectedStatusCode.set('all');
    expect(component.getFilteredSamples().length).toBe(3);

    component.selectedStatusCode.set('200');
    const filtered = component.getFilteredSamples();
    expect(filtered.length).toBe(1);
    expect(filtered[0].statusCode).toBe(200);
  });

  it('should format headers', () => {
    const headers = { 'Content-Type': 'application/json' };
    const formatted = component.formatHeaders(headers);
    expect(formatted).toContain('"Content-Type": "application/json"');
  });

  it('should format body', () => {
    const jsonBody = '{"a":1}';
    expect(component.formatBody(jsonBody)).toContain('"a": 1');

    const plainBody = 'Hello';
    expect(component.formatBody(plainBody)).toBe('Hello');
  });

  it('should return status code classes', () => {
    expect(component.getStatusCodeClasses(200)).toContain('success');
    expect(component.getStatusCodeClasses(301)).toContain('info');
    expect(component.getStatusCodeClasses(404)).toContain('warning');
    expect(component.getStatusCodeClasses(500)).toContain('error');
  });

  it('should check if has headers', () => {
    expect(component.hasHeaders({ a: '1' })).toBe(true);
    expect(component.hasHeaders({})).toBe(false);
  });

  it('should get count', () => {
    fixture.componentRef.setInput('responseSamples', mockSamples);
    fixture.componentRef.setInput('statusCodeDistribution', mockDistribution);

    expect(component.getCount('all')).toBe(3);
    expect(component.getCount('200')).toBe(100);
    expect(component.getCount('404')).toBe(10);
  });

  it('should get percentage', () => {
    fixture.componentRef.setInput('totalRequests', 200);
    fixture.componentRef.setInput('statusCodeDistribution', mockDistribution);

    expect(component.getPercentage('all')).toBe(100);
    expect(component.getPercentage('200')).toBe(50); // 100/200
    expect(component.getPercentage('404')).toBe(5); // 10/200
  });

  it('should return category icon', () => {
    expect(component.getCategoryIcon('all')).toBe('list_alt');
    expect(component.getCategoryIcon('200')).toBe('check');
    expect(component.getCategoryIcon('301')).toBe('info');
    expect(component.getCategoryIcon('404')).toBe('warning');
    expect(component.getCategoryIcon('500')).toBe('error');
  });

  it('should return category classes', () => {
    expect(component.getCategoryClasses('all')).toContain('base-300');
    expect(component.getCategoryClasses('200')).toContain('success');
    expect(component.getCategoryClasses('301')).toContain('info');
    expect(component.getCategoryClasses('404')).toContain('warning');
    expect(component.getCategoryClasses('500')).toContain('error');
  });
});
