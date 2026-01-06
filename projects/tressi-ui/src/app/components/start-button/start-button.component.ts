import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { ConfigDocument, RPCService } from '../../services/rpc.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-start-button',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './start-button.component.html',
})
export class StartButtonComponent implements OnDestroy {
  /** Service injection */
  private readonly eventService = inject(EventService);
  private readonly logService = inject(LogService);
  private readonly rpc = inject(RPCService);

  /** Input configuration */
  config = input<ConfigDocument | null>(null);

  /** Optional input to override test running state */
  testRunning = input<boolean | undefined>(undefined);

  /** Output events */
  testStarted = output<void>();
  testStartFailed = output<Error>();

  /** Internal state signals */
  isTestRunning = signal<boolean>(false);

  /** Computed disabled state */
  isDisabled = computed(() => {
    const config = this.config();
    const externalTestRunning = this.testRunning();
    const isRunning =
      externalTestRunning !== undefined
        ? externalTestRunning
        : this.isTestRunning();
    return !config || 'error' in config || !config.id || isRunning;
  });

  /** Subject for managing subscription cleanup */
  private readonly destroy$ = new Subject<void>();

  constructor() {
    this.setupTestEventsListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Starts a new load test using the provided configuration
   */
  async start(): Promise<void> {
    const selected = this.config();

    if (!selected || 'error' in selected) {
      const error = new Error('No valid configuration selected');
      this.logService.error(error.message);
      this.testStartFailed.emit(error);
      return;
    }

    if (!selected.config) {
      const error = new Error('Configuration data is missing');
      this.logService.error(error.message);
      this.testStartFailed.emit(error);
      return;
    }

    try {
      this.logService.info('Starting load test with config:', selected.id);

      const response = await this.rpc.client.test.$post({
        json: { configId: selected.id },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.logService.info('Load test started successfully:', data);
      this.testStarted.emit();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error('Unknown error occurred');
      this.logService.error('Failed to start load test:', errorMessage);
      this.testStartFailed.emit(errorMessage);
    }
  }

  /**
   * Sets up test event listeners to track test execution state
   */
  private setupTestEventsListener(): void {
    this.eventService
      .getTestEventsStream()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          if (event.status === 'running') {
            this.isTestRunning.set(true);
          } else if (
            event.status === 'completed' ||
            event.status === 'failed'
          ) {
            this.isTestRunning.set(false);
          }
        },
        error: (error) => {
          this.logService.error('Failed to handle test event:', error);
        },
      });
  }
}
