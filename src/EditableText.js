import React, {useState, useCallback, useRef, useEffect} from 'react';

import './EditableText.css';

export default function EditableText({
  value,
  onChange,
  className,
  inline,
  size = 20,
}) {
  const [editingValue, setEditingValue] = useState(null);
  const inputRef = useRef(null);
  const onInputChange = useCallback(
    (e) => setEditingValue({value: e.currentTarget.value}),
    []
  );
  const onBlur = useCallback(() => {
    const updated = inputRef.current?.value;
    setEditingValue(null);
    onChange(updated);
  }, [onChange]);
  const onKeyUp = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        const updated = inputRef.current?.value;
        setEditingValue(null);
        onChange(updated);
      }
    },
    [onChange]
  );
  const isEditing = editingValue?.value != null;

  const onEditClick = useCallback(() => {
    setEditingValue({value});
  }, [value]);
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (editingValue) {
    return (
      <input
        type="text"
        className={inline ? 'EditableText_inline' : 'EditableText_block'}
        value={editingValue.value}
        size={size}
        ref={inputRef}
        onChange={onInputChange}
        onBlur={onBlur}
        onKeyUp={onKeyUp}
      />
    );
  }

  return React.createElement('span', {
    className: `EditableText_view ${className} ${
      inline ? 'EditableText_inline' : 'EditableText_block'
    }`,
    onClick: onEditClick,
    children: value,
  });
}
