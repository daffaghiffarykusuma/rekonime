import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';

test('Store dispatch updates state and notifies', () => {
  const store = Store.createStore({
    initialState: { count: 0 },
    reducers: {
      count: (state = 0, action) => {
        if (action.type === 'inc') return state + 1;
        return state;
      }
    }
  });

  let observed = null;
  store.subscribe((next) => { observed = next; });
  store.dispatch({ type: 'inc' });

  assert.equal(store.getState().count, 1);
  assert.equal(observed.count, 1);
});

test('Store middleware can intercept actions', () => {
  const calls = [];
  const logger = ({ getState }) => (next) => (action) => {
    calls.push({ action, state: getState() });
    return next(action);
  };

  const store = Store.createStore({
    initialState: { value: 1 },
    reducers: {
      value: (state = 1, action) => action.type === 'set' ? action.payload : state
    },
    middleware: [logger]
  });

  store.dispatch({ type: 'set', payload: 3 });

  assert.equal(store.getState().value, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action.type, 'set');
});
