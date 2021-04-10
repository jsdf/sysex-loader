import {useState, useEffect, useRef} from 'react';
import localforage from 'localforage';

let queue = Promise.resolve();

const INITIAL_VALUE = {};

export default function useLocalForage(key, getInitialValue = null) {
  const initialValueRef = useRef(INITIAL_VALUE);
  if (initialValueRef.current === INITIAL_VALUE) {
    initialValueRef.current =
      typeof getInitialValue === 'function'
        ? getInitialValue()
        : getInitialValue;
  }

  const [committedValue, setCommittedValue] = useState(initialValueRef.current);
  // need to use a ref for whatever the latest version in the process of
  // persisting is, otherwise we get lost updates
  const updatedValueRef = useRef(initialValueRef.current);

  useEffect(() => {
    queue = queue.then(
      (async function () {
        try {
          const value = await localforage.getItem(key);

          updatedValueRef.current = value;
          setCommittedValue(value);
        } catch (err) {
          return updatedValueRef.current;
        }
      })()
    );
  }, [key]);

  const set = (value) => {
    queue = queue.then(
      (async function () {
        try {
          // Allow value to be a function so we have same API as useState
          const valueToStore =
            typeof value === 'function'
              ? value(updatedValueRef.current)
              : value;

          updatedValueRef.current = valueToStore;
          await localforage.setItem(key, valueToStore);
          setCommittedValue(updatedValueRef.current);
        } catch (err) {
          console.error(err);
          return updatedValueRef.current;
        }
      })()
    );
  };

  const remove = () => {
    queue = queue.then(
      (async function () {
        try {
          updatedValueRef.current = initialValueRef.current;
          await localforage.removeItem(key);
          setCommittedValue(updatedValueRef.current);
        } catch (err) {
          console.error(err);
        }
      })()
    );
  };

  return [committedValue, set, remove];
}
