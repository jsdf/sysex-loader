import React from 'react';

export default function MidiDeviceSelector({
  type,
  onChange,
  selectedPortID,
  sysex,
}) {
  const [availablePorts, setAvailablePorts] = React.useState([]);
  const initRef = React.useRef({selectedPortID, onChange});
  initRef.current = {selectedPortID, onChange};

  const accessType = type === 'input' ? 'inputs' : 'outputs';

  React.useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      return;
    }
    navigator.requestMIDIAccess({sysex: Boolean(sysex)}).then((access) => {
      const availablePorts = Array.from(access[accessType].values());
      initRef.current.onChange(
        availablePorts.find(
          (port) => port.id === initRef.current.selectedPortID
        )
      );
      setAvailablePorts(availablePorts);

      access.onstatechange = function (e) {
        setAvailablePorts(Array.from(access[accessType].values()));
      };
    });
  }, [accessType, sysex]);

  return (
    <label>
      midi {type === 'input' ? 'in' : 'out'}:{' '}
      <select
        onChange={(e) => {
          onChange(availablePorts[parseInt(e.currentTarget.value)]);
        }}
        value={availablePorts.findIndex((port) => port.id === selectedPortID)}
      >
        <option key={-1} value={-1}>
          (none)
        </option>
        {availablePorts.map((port, i) => (
          <option key={i} value={i}>
            {port.name}
          </option>
        ))}
      </select>
    </label>
  );
}
