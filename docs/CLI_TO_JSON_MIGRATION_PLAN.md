# CLI to JSON Configuration Migration Plan

## Relocating Load Testing Parameters to Per-Endpoint Configuration

### Executive Summary

This document outlines a comprehensive migration plan for relocating CLI flags `--workers`, `--concurrent-requests`, `--ramp-up-time`, and `--rps` from global command-line arguments to per-endpoint JSON configuration. This change enables granular control over load testing parameters for individual endpoints while maintaining the flexibility of JSON-based configuration.

**Migration Impact**: Breaking change that removes global CLI flags in favor of per-endpoint configuration
**Target Version**: v0.0.13

---

## 1. Current State Analysis

### 1.1 CLI Flags Overview

The following CLI flags are currently implemented as global parameters:

| CLI Flag                    | Type    | Default   | Description                              |
| --------------------------- | ------- | --------- | ---------------------------------------- |
| `--workers <n>`             | integer | undefined | Number of worker processes               |
| `--concurrent-requests <n>` | integer | undefined | Maximum concurrent requests per worker   |
| `--ramp-up-time <s>`        | integer | undefined | Time in seconds to ramp up to target RPS |
| `--rps <n>`                 | integer | undefined | Target requests per second               |

**Current Implementation Location**: [`src/cli.ts:57-60`](src/cli.ts:57-60)

### 1.2 Configuration Schema Analysis

**Current JSON Schema Version**: v0.0.13
**Schema Location**: [`schemas/tressi.schema.v0.0.13.json`](schemas/tressi.schema.v0.0.13.json)

**Current Request Configuration Structure**:

```json
{
  "url": "https://api.example.com/endpoint",
  "method": "GET",
  "headers": {},
  "payload": {
    "headers?": {}
  }
}
```

**Limitations**:

- No per-endpoint load testing parameters
- Global CLI flags apply to all endpoints uniformly
- Cannot simulate realistic mixed traffic patterns
- Limited flexibility for testing different endpoint characteristics

### 1.3 Configuration Loading Pipeline

**Configuration Flow**:

1. CLI flags parsed via Commander.js
2. Configuration loaded from JSON file via `loadConfig()` in [`src/config.ts:55-75`](src/config.ts:55-75)
3. CLI flags override JSON configuration globally
4. Merged configuration passed to runner

---

## 2. New JSON Schema Design

### 2.1 Enhanced Request Configuration Schema

The new schema introduces load testing parameters at the individual request level:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "headers": {
    "Content-Type": "application/json"
  },
  "requests": [
    {
      "url": "https://api.example.com/fast-endpoint",
      "method": "GET",
      "loadProfile": {
        "workers": 5,
        "rps": 1000,
        "concurrentRequests": 50,
        "rampUpTime": 30
      }
    },
    {
      "url": "https://api.example.com/slow-endpoint",
      "method": "POST",
      "payload": { "data": "large-payload" },
      "loadProfile": {
        "workers": 2,
        "rps": 50,
        "concurrentRequests": 5,
        "rampUpTime": 60
      }
    }
  ]
}
```

### 2.2 Schema Definition

**New LoadProfile Schema**:

```typescript
const LoadProfileSchema = z.object({
  /** Number of worker processes for this endpoint */
  workers: z.number().positive().int().optional(),

  /** Target requests per second for this endpoint */
  rps: z.number().positive().optional(),

  /** Maximum concurrent requests per worker for this endpoint */
  concurrentRequests: z.number().positive().int().optional(),

  /** Time in seconds to ramp up to target RPS */
  rampUpTime: z.number().positive().int().optional(),
});

const EnhancedRequestConfigSchema = RequestConfigSchema.extend({
  /** Load testing parameters specific to this request */
  loadProfile: LoadProfileSchema.optional(),
});
```

### 2.3 Validation Rules

| Field                | Type    | Constraints | Default   | Description                        |
| -------------------- | ------- | ----------- | --------- | ---------------------------------- |
| `workers`            | integer | > 0         | undefined | Number of worker processes         |
| `rps`                | number  | > 0         | undefined | Target RPS for this endpoint       |
| `concurrentRequests` | integer | > 0         | undefined | Max concurrent requests per worker |
| `rampUpTime`         | integer | > 0         | undefined | Ramp-up duration in seconds        |

**Validation Rules**:

- All fields are optional
- When `rps` is specified, `concurrentRequests` must be ≤ `rps`
- `rampUpTime` must be ≤ total test duration
- Values override global defaults when specified

---

## 3. Step-by-Step Migration Plan

### Phase 1: Schema Enhancement (Sprint 1)

**Week 1-2: Schema Development**

- [ ] Create new JSON schema v0.0.13 with loadProfile support
- [ ] Update Zod schemas in [`src/config.ts`](src/config.ts)
- [ ] Add schema validation tests
- [ ] Generate new schema documentation

**Deliverables**:

- Updated [`schemas/tressi.schema.v0.0.13.json`](schemas/tressi.schema.v0.0.13.json)
- Enhanced TypeScript types
- Validation test suite

### Phase 2: Configuration Loading (Sprint 1-2)

**Week 2-3: Configuration Pipeline**

- [ ] Modify `loadConfig()` to handle new schema
- [ ] Update configuration merging logic
- [ ] Add backward compatibility layer (temporary)
- [ ] Implement configuration validation

**Code Changes**:

```typescript
// New configuration interface
interface EnhancedTressiConfig extends TressiConfig {
  requests: Array<
    RequestConfig & {
      loadProfile?: {
        workers?: number;
        rps?: number;
        concurrentRequests?: number;
        rampUpTime?: number;
      };
    }
  >;
}
```

### Phase 3: Runner Implementation (Sprint 2)

**Week 4-5: Execution Engine**

- [ ] Update runner to use per-endpoint parameters
- [ ] Implement load balancing across different RPS targets
- [ ] Add endpoint-specific concurrency control
- [ ] Update metrics collection and reporting

**Key Components**:

- [`src/runner.ts`](src/runner.ts) - Main execution logic
- [`src/stats.ts`](src/stats.ts) - Metrics aggregation
- [`src/ui.ts`](src/ui.ts) - Display updates

### Phase 4: CLI Deprecation (Sprint 3)

**Week 6: CLI Cleanup**

- [ ] Remove deprecated CLI flags from [`src/cli.ts`](src/cli.ts)
- [ ] Update CLI help text and examples
- [ ] Add migration warnings
- [ ] Update documentation

**Removed CLI Flags**:

- `--workers`
- `--concurrent-requests`
- `--ramp-up-time`
- `--rps`

### Phase 5: Testing & Validation (Sprint 3)

**Week 6-7: Quality Assurance**

- [ ] Comprehensive test suite for new configuration
- [ ] Performance regression testing
- [ ] Schema validation testing
- [ ] Migration guide testing

---

## 4. Implementation Examples

### 4.1 Basic Configuration Migration

**Before (CLI flags)**:

```bash
tressi --workers 10 --rps 500 --concurrent-requests 25 --ramp-up-time 30
```

**After (JSON configuration)**:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "workers": 10,
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET",
      "loadProfile": {
        "rps": 500,
        "concurrentRequests": 25,
        "rampUpTime": 30
      }
    }
  ]
}
```

### 4.2 Multi-Endpoint Configuration

**Complex Traffic Pattern**:

```json
{
  "workers": 20,
  "requests": [
    {
      "url": "https://api.example.com/users",
      "method": "GET",
      "loadProfile": {
        "workers": 8,
        "rps": 1000,
        "concurrentRequests": 50,
        "rampUpTime": 15
      }
    },
    {
      "url": "https://api.example.com/users",
      "method": "POST",
      "payload": { "name": "test-user" },
      "loadProfile": {
        "workers": 4,
        "rps": 100,
        "concurrentRequests": 10,
        "rampUpTime": 30
      }
    },
    {
      "url": "https://api.example.com/reports",
      "method": "GET",
      "loadProfile": {
        "workers": 2,
        "rps": 50,
        "concurrentRequests": 5,
        "rampUpTime": 60
      }
    }
  ]
}
```

### 4.3 Mixed Configuration Strategy

**Global Defaults with Overrides**:

```json
{
  "workers": 15,
  "globalLoadProfile": {
    "concurrentRequests": 20,
    "rampUpTime": 30
  },
  "requests": [
    {
      "url": "https://api.example.com/fast-api",
      "loadProfile": {
        "workers": 12,
        "rps": 2000,
        "concurrentRequests": 100
      }
    },
    {
      "url": "https://api.example.com/slow-api",
      "loadProfile": {
        "workers": 3,
        "rps": 100,
        "rampUpTime": 60
      }
    },
    {
      "url": "https://api.example.com/default-api"
    }
  ]
}
```

---

## 5. Validation Rules

### 5.1 Schema Validation

**JSON Schema Rules**:

```json
{
  "properties": {
    "loadProfile": {
      "type": "object",
      "properties": {
        "workers": { "type": "integer", "exclusiveMinimum": 0 },
        "rps": { "type": "number", "exclusiveMinimum": 0 },
        "concurrentRequests": { "type": "integer", "exclusiveMinimum": 0 },
        "rampUpTime": { "type": "integer", "exclusiveMinimum": 0 }
      },
      "additionalProperties": false
    }
  }
}
```

### 5.2 Runtime Validation

**Validation Functions**:

```typescript
function validateLoadProfile(
  profile: LoadProfile,
  duration: number,
): ValidationResult {
  const errors: string[] = [];

  if (profile.rampUpTime && profile.rampUpTime > duration) {
    errors.push('rampUpTime cannot exceed total duration');
  }

  if (
    profile.concurrentRequests &&
    profile.rps &&
    profile.concurrentRequests > profile.rps
  ) {
    errors.push('concurrentRequests should not exceed rps');
  }

  return { valid: errors.length === 0, errors };
}
```

### 5.3 Configuration Precedence

**Precedence Order** (highest to lowest):

1. Per-endpoint `loadProfile` configuration
2. Global `globalLoadProfile` configuration (if implemented)
3. System defaults (runtime calculated)

---

## 6. Testing Strategy

### 6.1 Unit Testing

**Test Categories**:

- Schema validation tests
- Configuration loading tests
- Load profile calculation tests
- Error handling tests

**Example Test Cases**:

```typescript
describe('LoadProfile Validation', () => {
  it('should accept valid load profile', () => {
    const config = {
      url: 'https://api.test.com',
      loadProfile: { rps: 100, concurrentRequests: 10 },
    };
    expect(() => validateRequestConfig(config)).not.toThrow();
  });

  it('should reject invalid concurrentRequests', () => {
    const config = {
      url: 'https://api.test.com',
      loadProfile: { concurrentRequests: -5 },
    };
    expect(() => validateRequestConfig(config)).toThrow();
  });
});
```

### 6.2 Integration Testing

**Test Scenarios**:

- Multi-endpoint load testing
- Mixed configuration scenarios
- Performance regression testing
- Memory usage validation

**Test Configuration**:

```json
{
  "testScenarios": [
    {
      "name": "mixed_traffic",
      "config": {
        "workers": 5,
        "requests": [
          {
            "url": "http://localhost:3000/fast",
            "loadProfile": { "workers": 3, "rps": 1000 }
          },
          {
            "url": "http://localhost:3000/slow",
            "loadProfile": { "workers": 1, "rps": 50 }
          }
        ]
      }
    }
  ]
}
```

### 6.3 Performance Testing

**Benchmarks**:

- Configuration parsing performance
- Memory usage with large configurations
- Concurrent endpoint handling
- Metrics aggregation accuracy

---

## 7. Migration Checklist

### Pre-Migration

- [ ] Backup existing configurations
- [ ] Document current CLI usage patterns
- [ ] Identify critical endpoints and their load requirements
- [ ] Prepare migration scripts

### During Migration

- [ ] Update configuration files to new schema
- [ ] Test configurations in staging environment
- [ ] Validate performance characteristics
- [ ] Update CI/CD pipelines

### Post-Migration

- [ ] Monitor production performance
- [ ] Update team documentation
- [ ] Conduct training sessions
- [ ] Archive old configuration formats

---

## 8. Risk Assessment

### High Risk

- **Breaking Change**: CLI flags removal affects existing automation
- **Performance Impact**: Per-endpoint configuration may increase memory usage
- **Configuration Complexity**: More complex configuration management

### Medium Risk

- **User Adoption**: Learning curve for new configuration format
- **Documentation Updates**: Extensive documentation changes required
- **Tooling Updates**: Third-party integrations may need updates

### Mitigation Strategies

- Provide migration scripts
- Maintain backward compatibility during transition period
- Offer comprehensive migration guide
- Provide CLI validation tool

---

## 9. Timeline & Resources

### Development Timeline

- **Phase 1**: 2 weeks (Schema development)
- **Phase 2**: 1 week (Configuration pipeline)
- **Phase 3**: 2 weeks (Runner implementation)
- **Phase 4**: 1 week (CLI cleanup)
- **Phase 5**: 1 week (Testing & validation)
- **Total**: 7 weeks

### Resource Requirements

- 1 Senior Engineer (full-time)
- 1 QA Engineer (part-time)
- Documentation updates (16 hours)
- User training (8 hours)

---

## 10. Success Metrics

### Technical Metrics

- Configuration validation pass rate: >99%
- Performance regression: <5%
- Memory usage increase: <20%
- Test coverage: >90%

### User Metrics

- Migration completion rate: >80% within 30 days
- Support ticket volume: <10 tickets
- User satisfaction score: >4.0/5.0

---

## Appendix

### A. Migration Script Example

```bash
#!/bin/bash
# migrate-config.sh - Convert CLI flags to JSON configuration

cat > tressi.config.migrated.json << EOF
{
  "\$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "workers": ${WORKERS:-10},
  "requests": [
    {
      "url": "${TARGET_URL}",
      "method": "${METHOD:-GET}",
      "loadProfile": {
        "workers": ${WORKERS:-5},
        "rps": ${RPS:-100},
        "concurrentRequests": ${CONCURRENT_REQUESTS:-20},
        "rampUpTime": ${RAMP_UP_TIME:-30}
      }
    }
  ]
}
EOF
```

### B. Validation Tool

```bash
# Validate new configuration
tressi validate --config tressi.config.json

# Check migration compatibility
tressi migrate-check --old-config old.config.json --new-config new.config.json
```

---

**Document Version**: 1.0
**Last Updated**: 2025-08-05
**Author**: Tressi Development Team
**Review Status**: Ready for Implementation
