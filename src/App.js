import React, {useCallback, useEffect, useState} from 'react';
import {useDropzone} from 'react-dropzone';
import Modal from 'react-modal';
import './App.css';
import MidiDeviceSelector from './MidiDeviceSelector';
import useLocalStorage from './useLocalStorage';
import useLocalForage from './useLocalForage';
import Table from './Table';
import byteArrayToHex from './byteArrayToHex';
import downloadBlob from './downloadBlob';
import md5 from './md5';
import midimanufacturers from './midimanufacturers.json';
import Checkbox from './Checkbox';

Modal.setAppElement(document.body);

function getSysexManufacturer(data) {
  if (data[1] === 0x00) {
    return midimanufacturers[byteArrayToHex(data.slice(1, 4)).toLowerCase()];
  } else {
    return midimanufacturers[byteArrayToHex(data.slice(1, 2)).toLowerCase()];
  }
}

class MidiPortReference {
  constructor(id, port) {
    this.id = id;
    this.port = port;
  }
  toJSON() {
    return {id: this.id, port: null};
  }
}

function getTimestampString(ts) {
  var d = new Date(ts);
  return (
    [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-') +
    ' ' +
    [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      String(d.getSeconds()).padStart(2, '0'),
    ].join(':')
  );
}

function makeItem({message, name}) {
  return {
    message,
    name,
    timestamp: Date.now(),
    hash: md5(byteArrayToHex(message)),
  };
}

function formatBytesForDisplay(str, lineLength) {
  let out = '';
  for (let i = 0; i < Math.ceil(str.length / (lineLength / 2)); i++) {
    const line = str.slice(i * lineLength * 2, (i + 1) * lineLength * 2);
    for (let k = 0; k < Math.ceil(line.length / 2); k++) {
      out += line.slice(k * 2, (k + 1) * 2) + ' ';
    }
    out += '\n';
  }
  return out;
}

function FileDropzone({onFile, onStatus}) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();

        reader.onabort = () => onStatus('file reading was aborted');
        reader.onerror = () => onStatus('file reading has failed');
        reader.onload = () => {
          // Do whatever you want with the file contents
          const binaryStr = reader.result;

          onFile(file, binaryStr);
        };
        reader.readAsArrayBuffer(file);
      });
      onStatus(null);
    },
    [onFile, onStatus]
  );
  const {getRootProps, getInputProps} = useDropzone({onDrop});

  return (
    <div
      style={{
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <div
        {...getRootProps()}
        style={{
          border: 'dashed 3px #ccc',
          borderRadius: 30,
          height: 300,
          margin: '16px',
          cursor: 'pointer',
        }}
      >
        <input {...getInputProps()} />
        <p>Drag 'n' drop some .syx files here, or click to select files</p>
      </div>
    </div>
  );
}

function uniqueBy(values, getKey) {
  return Array.from(new Map(values.map((v) => [getKey(v), v])).values());
}

const SendButton = React.memo(function SendButton({item, sendMidi}) {
  return <button onClick={() => sendMidi(item.message)}>send</button>;
});

const ViewButton = React.memo(function ViewButton({item, setModalContent}) {
  return (
    <button
      onClick={() =>
        setModalContent({
          title: item.name,
          body: (
            <pre>{formatBytesForDisplay(byteArrayToHex(item.message), 16)}</pre>
          ),
        })
      }
    >
      view
    </button>
  );
});
const DeleteButton = React.memo(function PrintButton({item, deleteItem}) {
  return <button onClick={() => deleteItem(item)}>delete</button>;
});
const DownloadButton = React.memo(function PrintButton({item}) {
  return (
    <button
      onClick={() =>
        downloadBlob(
          new Blob([new Uint8Array(item.message)]),
          item.name + (item.name.toLowerCase().endsWith('.syx') ? '' : '.syx')
        )
      }
    >
      download
    </button>
  );
});

function addToSysexMessages(prev, newItem) {
  return uniqueBy((prev ?? []).concat(newItem), (item) => item.hash);
}

function App() {
  const [midiIn, setMidiIn] = useLocalStorage('inPort', null);
  const [midiOut, setMidiOut] = useLocalStorage('outPort', null);
  const [autoSend, setAutoSend] = useLocalStorage('autoSend', true);
  const [errorMessage, setErrorMessageState] = useState(null);
  const [modalContent, setModalContent] = useState(null);
  const [
    sysexMessagesFromStorage,
    setSysexMessages,
    clearSysexMessages,
  ] = useLocalForage('sysexMessages', []);
  const sysexMessages = sysexMessagesFromStorage ?? [];
  const setErrorMessage = useCallback((msg) => {
    if (msg) console.error(msg);
    setErrorMessageState(msg);
  }, []);
  const sendMidi = (buf) => {
    if (midiOut?.port) {
      try {
        setErrorMessage(null);
        midiOut.port.send(new Uint8Array(buf));
      } catch (err) {
        setErrorMessage(err.toString());
      }
    } else {
      setErrorMessage('no midi out selected');
    }
  };

  function deleteItem(itemToDelete) {
    setSysexMessages((s) => s.filter((item) => item !== itemToDelete));
  }

  useEffect(() => {
    if (!midiIn?.port) return;
    midiIn.port.onmidimessage = (event) => {
      if (event.data[0] === 0xf0) {
        setSysexMessages((s) =>
          addToSysexMessages(
            s,
            makeItem({
              message: event.data,
              name: `Received on ${midiIn.port.name}`,
            })
          )
        );
      }
    };

    return () => {
      midiIn.port.onmidimessage = null;
    };
  }, [midiIn, midiIn?.port, setSysexMessages]);

  return (
    <div className="App">
      <div style={{margin: 16}}>
        <div style={{display: 'inline-block', padding: '0 4px'}}>
          <MidiDeviceSelector
            type="input"
            selectedPortID={midiIn?.id}
            onChange={(port) =>
              setMidiIn(port ? new MidiPortReference(port.id, port) : null)
            }
            sysex
          />
        </div>
        <div style={{display: 'inline-block', padding: '0 4px'}}>
          <MidiDeviceSelector
            type="output"
            selectedPortID={midiOut?.id}
            onChange={(port) =>
              setMidiOut(port ? new MidiPortReference(port.id, port) : null)
            }
            sysex
          />
        </div>
        <div style={{display: 'inline-block', padding: '0 4px'}}>
          <Checkbox
            label="automatically send dropped files to device"
            checked={autoSend}
            onChange={() => setAutoSend((s) => !s)}
          />
        </div>
      </div>
      {errorMessage && (
        <div style={{backgroundColor: 'red', margin: 16}}>{errorMessage}</div>
      )}
      <FileDropzone
        onFile={(file, buf) => {
          console.log('file', file);
          if (autoSend) {
            sendMidi(buf);
          }
          setSysexMessages((s) =>
            addToSysexMessages(
              s,
              makeItem({
                message: new Uint8Array(buf),
                name: file.name,
              })
            )
          );
        }}
        onStatus={setErrorMessage}
      />
      <div style={{margin: 16}}>
        {sysexMessages.length ? (
          <Table
            items={sysexMessages
              .slice()
              .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))}
            headings={['Name', 'Manufacturer', 'Bytes', 'Added', 'Actions']}
            layout={['auto', 200, 100, 200, 260]}
            rowRenderer={(item) => [
              item.name,
              getSysexManufacturer(item.message),
              item.message.length,
              item.timestamp ? getTimestampString(item.timestamp) : 'unknown',
              <>
                <SendButton item={item} sendMidi={sendMidi} />
                <DownloadButton item={item} />
                <ViewButton item={item} setModalContent={setModalContent} />
                <DeleteButton item={item} deleteItem={deleteItem} />
              </>,
            ]}
          />
        ) : (
          'SysEx messages you upload or download will be listed here'
        )}
      </div>
      {Boolean(sysexMessages.length) && (
        <div style={{margin: 16}}>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure? This will delete everything you've uploaded or downloaded from this app"
                )
              ) {
                clearSysexMessages();
              }
            }}
          >
            clear all history
          </button>
        </div>
      )}
      {modalContent && (
        <Modal
          isOpen={Boolean(modalContent)}
          onRequestClose={() => setModalContent(null)}
          contentLabel={modalContent?.title}
        >
          <h2>{modalContent?.title}</h2>
          <button onClick={() => setModalContent(null)}>close</button>
          {modalContent?.body}
        </Modal>
      )}
    </div>
  );
}

export default App;
