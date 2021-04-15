import midimanufacturers from './midimanufacturers.json';

function range(size, startAt = 0) {
  return [...Array(size).keys()].map((i) => i + startAt);
}

function bytesToUTF8(bytes) {
  return new TextDecoder().decode(bytes);
}

// https://github.com/asb2m10/dexed/blob/master/Documentation/sysex-format.txt
// https://github.com/asb2m10/dexed/blob/master/Source/PluginData.cpp#L120
function parseDX7VoiceSingleFormat(data, startOffset) {
  return {name: bytesToUTF8(data.slice(startOffset + 145, startOffset + 155))};
}

function parseDX7VoiceBulkFormat(data, startOffset) {
  return {name: bytesToUTF8(data.slice(startOffset + 118, startOffset + 128))};
}

// http://midi.teragonaudio.com/tech/midispec/sysex.htm
// https://github.com/ahlstromcj/midicvt/blob/master/contrib/sysex-format.txt
export function parseSysexMessage(data) {
  switch (data[1]) {
    case 0x43: // yamaha
      switch (data[2] >> 4) {
        case 0:
          switch (data[3]) {
            case 0: {
              // Bulk Data for 1 Voice
              return {
                type: 'DX7 1 Voice Bulk Data',
                voice: parseDX7VoiceSingleFormat(data, 6),
              };
            }
            case 2: {
              return {
                type: 'TX7 64 Performance Bulk Data',
              };
            }
            case 9: {
              // Bulk Data for 32 Voices
              return {
                type: 'DX7 32 Voice Bulk Data',
                voices: range(32).map((i) =>
                  parseDX7VoiceBulkFormat(data, 6 + i * 128)
                ),
              };
            }
            default:
              break;
          }
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }

  return {type: `Other ${getSysexManufacturer(data)} message`};
}

function bytesToManufacturerID(bytes) {
  return Array.from(bytes)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}

export function getSysexManufacturer(data) {
  if (data[1] === 0x00) {
    return midimanufacturers[bytesToManufacturerID(data.slice(1, 4))];
  } else {
    return midimanufacturers[bytesToManufacturerID(data.slice(1, 2))];
  }
}
