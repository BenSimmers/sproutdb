---
"sproutdb": minor
---

## Enhanced Server Monitoring and Schema Validation

### Server Metrics and Logging
- Added comprehensive metrics tracking system for monitoring server performance
  - Request count by method and endpoint
  - Response time tracking (average and total)
  - Error rate monitoring
  - Server uptime tracking
- Implemented custom request logging middleware with timestamp and performance metrics
- Added `/metrics` endpoint exposing server statistics, database info, and memory usage
- Enhanced `/health` endpoint with detailed system status including database metrics

### Runtime Schema Validation
- Added Zod-based runtime schema validation for all table operations
- Optional schema parameter for `table()` function enabling type-safe data validation
- Comprehensive validation for `insert`, `update`, and `load` operations
- Detailed validation error messages with field-specific feedback
- Backward compatibility maintained - validation is opt-in via schema parameter
- Added `ValidationError` class for structured error handling
