import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { ConfigDocument } from '@tressi/shared/common';
import { Subject, takeUntil } from 'rxjs';

import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { RPCService } from '../../services/rpc.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-start-button',
  imports: [ButtonComponent],
  templateUrl: './start-button.component.html',
})
export class StartButtonComponent implements OnDestroy {
  /** Service injection */
  private readonly _eventService = inject(EventService);
  private readonly _logService = inject(LogService);
  private readonly _rpc = inject(RPCService);

  /** Input configuration */
  readonly config = input<ConfigDocument | null>(null);

  /** Output events */
  readonly testStarted = output<void>();
  readonly testStartFailed = output<Error>();

  /** Internal state signals */
  readonly isTestRunning = signal<boolean>(true);

  /** Computed disabled state */
  readonly isDisabled = computed(() => {
    const config = this.config();
    return !config || 'error' in config || !config.id || this.isTestRunning();
  });

  /** Subject for managing subscription cleanup */
  private readonly _destroy$ = new Subject<void>();

  constructor() {
    this._initializeTestState(); // Initialize state from backend before setting up listeners
    this._setupTestEventsListener();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Initializes the test state by checking the backend for any running tests
   * This ensures the button state is correct after page refresh
   */
  private async _initializeTestState(): Promise<void> {
    try {
      const status = await this._rpc.getTestStatus();
      this.isTestRunning.set(status.isRunning);
    } catch (error) {
      this._logService.error('Failed to initialize test state:', error);
      this.isTestRunning.set(false); // Safe default
    }
  }

  /**
   * Starts a new load test using the provided configuration
   */
  async start(): Promise<void> {
    const selected = this.config();

    if (!selected || 'error' in selected) {
      const error = new Error('No valid configuration selected');
      this._logService.error(error.message);
      this.testStartFailed.emit(error);
      return;
    }

    if (!selected.config) {
      const error = new Error('Configuration data is missing');
      this._logService.error(error.message);
      this.testStartFailed.emit(error);
      return;
    }

    try {
      const response = await this._rpc.client.test.$post({
        json: { configId: selected.id },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.testStarted.emit();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error('Unknown error occurred');
      this._logService.error('Failed to start load test:', errorMessage);
      this.testStartFailed.emit(errorMessage);
    }
  }

  /**
   * Stops the currently running load test
   */
  async stop(): Promise<void> {
    try {
      const response = await this._rpc.client.test.stop.$post();
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error('Unknown error occurred');
      this._logService.error('Failed to stop load test:', errorMessage);
    }
  }

  /**
   * Sets up test event listeners to track test execution state
   */
  private _setupTestEventsListener(): void {
    this._eventService
      .getTestEventsStream()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (event) => {
          if (event.status === 'running') {
            this.isTestRunning.set(true);
          } else if (
            event.status === 'completed' ||
            event.status === 'failed' ||
            event.status === 'cancelled'
          ) {
            this.isTestRunning.set(false);
          }
        },
        error: (error) => {
          this._logService.error('Failed to handle test event:', error);
        },
      });
  }
}
