import { DependencyContainer } from './dependency-container.js';
import { ErrorHandler } from '../services/error-handler.js';

/**
 * Minimal store with reducer map and middleware support.
 */
const Store = {
  createStore({ initialState = {}, reducers = {}, middleware = [] } = {}) {
    let state = { ...initialState };
    const listeners = new Set();

    const reduce = typeof reducers === 'function'
      ? reducers
      : (currentState, action) => {
          let nextState = currentState;
          let changed = false;
          Object.keys(reducers).forEach((key) => {
            const reducer = reducers[key];
            const previousSlice = currentState[key];
            const nextSlice = reducer(previousSlice, action);
            if (nextSlice !== previousSlice) {
              if (!changed) {
                nextState = { ...currentState };
                changed = true;
              }
              nextState[key] = nextSlice;
            }
          });
          return changed ? nextState : currentState;
        };

    const notify = (prevState, action) => {
      if (listeners.size === 0) return;
      listeners.forEach((listener) => {
        try {
          listener(state, prevState, action);
        } catch (error) {
          ErrorHandler.report(error, { source: 'Store', action });
        }
      });
    };

    const baseDispatch = (action) => {
      if (!action || typeof action.type !== 'string') {
        return action;
      }
      const prevState = state;
      state = reduce(state, action);
      if (state !== prevState) {
        notify(prevState, action);
      }
      return action;
    };

    const store = {
      getState: () => state,
      dispatch: baseDispatch,
      subscribe: (listener) => {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      select: (selector) => {
        if (typeof selector !== 'function') return undefined;
        return selector(state);
      }
    };

    const compose = (...funcs) => {
      if (funcs.length === 0) return (arg) => arg;
      if (funcs.length === 1) return funcs[0];
      return funcs.reduce((a, b) => (...args) => a(b(...args)));
    };

    const chain = middleware
      .filter((fn) => typeof fn === 'function')
      .map((fn) => fn({ getState: store.getState, dispatch: (action) => store.dispatch(action) }));

    if (chain.length > 0) {
      store.dispatch = compose(...chain)(baseDispatch);
    }

    return store;
  }
};

DependencyContainer.register('storeFactory', Store);

export { Store };
export default Store;
