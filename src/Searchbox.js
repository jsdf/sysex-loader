import './Searchbox.css';

import throttle from './throttle';
import {useRef, useMemo, useState, useEffect, useCallback} from 'react';

export default function Searchbox({
  value,
  size,
  placeholder,
  onChange,
  onClear,
}) {
  const [tempValue, setTempValue] = useState(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const onChangeThrottled = useMemo(
    () =>
      throttle((...args) => {
        setTempValue(null);
        onChangeRef.current(...args);
      }, 400),
    []
  );

  const onChangeUnthrottled = useCallback(
    (e) => {
      const value = e.currentTarget.value;
      setTempValue(value);

      onChangeThrottled(value);
    },
    [onChangeThrottled]
  );

  return (
    <div className="Searchbox">
      <input
        type="text"
        size={size}
        placeholder={placeholder}
        value={tempValue ?? value}
        onChange={onChangeUnthrottled}
      />
      {(tempValue ?? value).length > 0 && (
        <button className="Searchbox_clear" onClick={onClear}>
          clear
        </button>
      )}
    </div>
  );
}
