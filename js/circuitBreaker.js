/**
 * Circuit Breaker - protects external calls from sustained failures.
 */
const CircuitBreaker = {
  states: {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
  },
  config: {
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenMaxCalls: 3
  },
  circuits: new Map(),

  getCircuit(serviceName) {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: this.states.CLOSED,
        failures: 0,
        lastFailureTime: null,
        successCount: 0,
        halfOpenCalls: 0
      });
    }
    return this.circuits.get(serviceName);
  },

  canExecute(serviceName) {
    const circuit = this.getCircuit(serviceName);

    if (circuit.state === this.states.CLOSED) {
      return { allowed: true, state: circuit.state };
    }

    if (circuit.state === this.states.OPEN) {
      const elapsed = Date.now() - (circuit.lastFailureTime || 0);
      if (elapsed >= this.config.resetTimeoutMs) {
        circuit.state = this.states.HALF_OPEN;
        circuit.halfOpenCalls = 0;
        circuit.successCount = 0;
        return { allowed: true, state: circuit.state };
      }
      const retryAfter = Math.max(0, this.config.resetTimeoutMs - elapsed);
      return { allowed: false, state: circuit.state, retryAfterMs: retryAfter };
    }

    if (circuit.state === this.states.HALF_OPEN) {
      if (circuit.halfOpenCalls < this.config.halfOpenMaxCalls) {
        circuit.halfOpenCalls += 1;
        return { allowed: true, state: circuit.state };
      }
      return { allowed: false, state: circuit.state };
    }

    return { allowed: false, state: circuit.state };
  },

  recordSuccess(serviceName) {
    const circuit = this.getCircuit(serviceName);
    if (circuit.state === this.states.HALF_OPEN) {
      circuit.successCount += 1;
      if (circuit.successCount >= this.config.halfOpenMaxCalls) {
        this.reset(serviceName);
      }
      return;
    }
    circuit.failures = 0;
  },

  recordFailure(serviceName) {
    const circuit = this.getCircuit(serviceName);
    circuit.failures += 1;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === this.states.HALF_OPEN) {
      circuit.state = this.states.OPEN;
      circuit.halfOpenCalls = 0;
      circuit.successCount = 0;
      return;
    }

    if (circuit.failures >= this.config.failureThreshold) {
      circuit.state = this.states.OPEN;
    }
  },

  reset(serviceName) {
    this.circuits.set(serviceName, {
      state: this.states.CLOSED,
      failures: 0,
      lastFailureTime: null,
      successCount: 0,
      halfOpenCalls: 0
    });
  },

  getStatus(serviceName) {
    const circuit = this.getCircuit(serviceName);
    return {
      service: serviceName,
      state: circuit.state,
      failures: circuit.failures,
      lastFailureTime: circuit.lastFailureTime,
      halfOpenCalls: circuit.halfOpenCalls,
      successCount: circuit.successCount,
      healthy: circuit.state === this.states.CLOSED
    };
  }
};

export { CircuitBreaker };
export default CircuitBreaker;
