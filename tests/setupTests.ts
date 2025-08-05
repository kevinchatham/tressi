/* eslint-disable no-console */
// This file is for setting up tests, e.g., mocking
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach } from 'vitest';

// Store the original dispatcher
const originalDispatcher = getGlobalDispatcher();

// Global mock agent for tests that need network mocking
let globalMockAgent: MockAgent | null = null;

// Cleanup function to be called after each test
afterEach(() => {
  // Clean up any global mock agent
  if (globalMockAgent) {
    try {
      globalMockAgent.assertNoPendingInterceptors();
    } catch (error) {
      // Log the error but don't fail the cleanup
      console.warn('Pending interceptors detected during cleanup:', error);
    }
    globalMockAgent.close();
    globalMockAgent = null;
  }

  // Reset to original dispatcher
  setGlobalDispatcher(originalDispatcher);
});

// Helper function to create and setup a mock agent
export function createMockAgent(): MockAgent {
  if (globalMockAgent) {
    globalMockAgent.close();
  }

  globalMockAgent = new MockAgent();
  globalMockAgent.disableNetConnect();
  setGlobalDispatcher(globalMockAgent);

  return globalMockAgent;
}

// Helper function to cleanup mock agent
export function cleanupMockAgent(): void {
  if (globalMockAgent) {
    try {
      globalMockAgent.assertNoPendingInterceptors();
    } catch (error) {
      console.warn('Pending interceptors during cleanup:', error);
    }
    globalMockAgent.close();
    globalMockAgent = null;
  }
  setGlobalDispatcher(originalDispatcher);
}
