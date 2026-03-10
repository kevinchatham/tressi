import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigDocument } from '@tressi/shared/common';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { RPCService } from '../../services/rpc.service';
import { StartButtonComponent } from './start-button.component';

describe('StartButtonComponent', () => {
  let component: StartButtonComponent;
  let fixture: ComponentFixture<StartButtonComponent>;
  let mockEventService: { getTestEventsStream: () => Subject<unknown> };
  let mockLogService: { error: (msg: string, err?: unknown) => void };
  let mockRPCService: {
    getTestStatus: () => Promise<{ isRunning: boolean }>;
    client: {
      test: {
        $post: unknown;
        stop: {
          $post: unknown;
        };
      };
    };
  };

  beforeEach(async () => {
    mockEventService = {
      getTestEventsStream: vi.fn().mockReturnValue(new Subject()),
    };
    mockLogService = {
      error: vi.fn(),
    };
    mockRPCService = {
      getTestStatus: vi.fn().mockResolvedValue({ isRunning: false }),
      client: {
        test: {
          $post: vi.fn(),
          stop: {
            $post: vi.fn(),
          },
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [StartButtonComponent],
      providers: [
        { provide: EventService, useValue: mockEventService },
        { provide: LogService, useValue: mockLogService },
        { provide: RPCService, useValue: mockRPCService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StartButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start test', async () => {
    const mockConfig: ConfigDocument = {
      id: '1',
      config: { name: 'test' },
    } as unknown as ConfigDocument;
    fixture.componentRef.setInput('config', mockConfig);
    fixture.detectChanges();

    (
      mockRPCService.client.test.$post as unknown as {
        mockResolvedValue: (val: unknown) => void;
      }
    ).mockResolvedValue({
      ok: true,
      status: 200,
    });

    await component.start();

    expect(
      mockRPCService.client.test.$post as unknown as {
        toHaveBeenCalledWith: (val: unknown) => void;
      },
    ).toHaveBeenCalledWith({
      json: { configId: '1' },
    });
  });
});
