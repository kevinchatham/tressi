/**
 * Quadrant Components Index
 *
 * This file exports all quadrant components for the new TUI architecture.
 * Each quadrant component implements the QuadrantComponent interface and
 * provides specific functionality for its designated area.
 */

// Base classes and utilities
export { QuadrantBase } from './base/quadrant-base';

// Quadrant 1: RPS Chart Component
export { Quadrant1RPS } from './quadrant-1-rps';

// Quadrant 2: Latency Component
export { Quadrant2Latency } from './quadrant-2-latency';

// Quadrant 3: System Metrics Component
export { Quadrant3System } from './quadrant-3-system';

// Quadrant 4: Status Distribution Component
export { Quadrant4Status } from './quadrant-4-status';

// Re-export types for convenience
export type {
  QuadrantData,
  Quadrant1RPSData,
  Quadrant2LatencyData,
  Quadrant3SystemData,
  Quadrant4StatusData,
  QuadrantComponent,
} from '../types/quadrant-data';
