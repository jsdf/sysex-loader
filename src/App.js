import React, {useCallback, useEffect, useState, useMemo} from 'react';
import {useDropzone} from 'react-dropzone';
import Modal from 'react-modal';

import './App.css';
import Logo from './Logo';
import MidiDeviceSelector from './MidiDeviceSelector';
import useLocalStorage from './useLocalStorage';
import useLocalForage from './useLocalForage';
import Table from './Table';
import byteArrayToHex from './byteArrayToHex';
import downloadBlob from './downloadBlob';
import md5 from './md5';
import Checkbox from './Checkbox';
import uniqueID from './uniqueID';
import LogView from './LogView';
import EditableText from './EditableText';
import {parseSysexMessage, getSysexManufacturer} from './sysex';

function concatTypedArrays(ArrayType, arrays) {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new ArrayType(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

Modal.setAppElement(document.body);

function splitToSysExMessages(data) {
  let pos = 0;
  let lastPos = 0;
  let parts = [];
  while ((pos = data.indexOf(0xf7, lastPos)) !== -1) {
    pos += 1; // include the end byte
    parts.push(data.slice(lastPos, pos));
    lastPos = pos;
  }

  return parts;
}

// can be saved to localstorage so we can reacquire the same port by id next time
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
  const messages = splitToSysExMessages(message);
  return {
    message,
    name,
    type: parseSysexMessage(messages[0])?.type,
    timestamp: Date.now(),
    hash: md5(byteArrayToHex(message)),
    messagesCount: splitToSysExMessages(message).length,
  };
}

function formatBytesForDisplay(str, lineLength) {
  let out = '';
  for (let i = 0; i < Math.ceil(str.length / (lineLength * 2)); i++) {
    const line = str.slice(i * lineLength * 2, (i + 1) * lineLength * 2);
    for (let k = 0; k < Math.ceil(line.length / 2); k++) {
      out += line.slice(k * 2, (k + 1) * 2) + ' ';
    }
    out += '\n';
  }
  return out;
}

function downloadItem(item) {
  downloadBlob(
    new Blob([new Uint8Array(item.message)]),
    item.name + (item.name.toLowerCase().endsWith('.syx') ? '' : '.syx')
  );
}

function FileDropzone({onFile, onStatus, className, autoSend}) {
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
  const inputProps = getInputProps();

  return (
    <div
      className={`${className} FileDropzone`}
      {...getRootProps()}
      style={{
        textAlign: 'center',
        borderRadius: 30,
        cursor: 'pointer',
      }}
    >
      <div style={{margin: '32px auto', fontSize: 24, maxWidth: 360}}>
        Drag & drop some .syx files here (or click here to select files) to{' '}
        {autoSend ? 'send them to your device' : 'add them to the library'}.
      </div>
      <input
        {...inputProps}
        style={{...inputProps.style, margin: '32px auto'}}
      />
    </div>
  );
}

function uniqueBy(values, getKey) {
  return Array.from(new Map(values.map((v) => [getKey(v), v])).values());
}

const SendButton = React.memo(function SendButton({item, sendItem}) {
  return <button onClick={() => sendItem(item)}>send</button>;
});
const ItemName = React.memo(function ItemName({item, updateItem}) {
  return (
    <EditableText
      value={item.name}
      onChange={useCallback(
        (updatedName) => updateItem({...item, name: updatedName}),
        [updateItem, item]
      )}
    />
  );
});

const InfoButton = React.memo(function InfoButton({item, setModalContent}) {
  return (
    <button
      onClick={() =>
        setModalContent({
          title: item.name,
          body: (
            <div style={{marginTop: 16}}>
              <div>Manufacturer: {getSysexManufacturer(item.message)}</div>
              <div>Messages: {item.messagesCount}</div>

              <h3>Data</h3>

              {splitToSysExMessages(item.message).map((message, i) => {
                const parsed = parseSysexMessage(message);
                return (
                  <React.Fragment key={i}>
                    <h4>Message {i + 1}</h4>
                    {parsed && (
                      <>
                        <div>Parsed:</div>
                        <pre>{JSON.stringify(parsed, null, 2)}</pre>
                      </>
                    )}
                    <div>Bytes:</div>
                    <pre>
                      {formatBytesForDisplay(byteArrayToHex(message), 16)}
                    </pre>
                  </React.Fragment>
                );
              })}
            </div>
          ),
        })
      }
    >
      info
    </button>
  );
});
const DeleteButton = React.memo(function PrintButton({item, deleteItem}) {
  return <button onClick={() => deleteItem(item)}>delete</button>;
});
const DownloadButton = React.memo(function PrintButton({item}) {
  return <button onClick={() => downloadItem(item)}>download</button>;
});

function addToSysexMessages(prev, newItem) {
  return uniqueBy((prev ?? []).concat(newItem), (item) => item.hash);
}

function initSysexMessagesReceived(name, messages = []) {
  return {
    name,
    messages,
  };
}

function Theme() {
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', true);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  return (
    <div style={{position: 'absolute', top: 8, right: 16}}>
      <label>
        dark mode:{' '}
        <input
          type="checkbox"
          checked={darkMode}
          onChange={() => setDarkMode((s) => !s)}
        />
      </label>
    </div>
  );
}

function App() {
  const [midiIn, setMidiIn] = useLocalStorage('inPort', null);
  const [midiOut, setMidiOut] = useLocalStorage('outPort', null);
  const [autoSend, setAutoSend] = useLocalStorage('autoSend', true);
  const [errorMessage, setErrorMessageState] = useState(null);
  const [statusMessages, setStatusMessagesState] = useState([]);
  const [modalContent, setModalContent] = useState(null);
  const [sysexMessagesReceived, setSysexMessagesReceived] = useState(null);

  function updateSysexMessagesReceivedList(cb) {
    setSysexMessagesReceived((s) => ({...s, messages: cb(s.messages)}));
  }

  function messagesToLibraryFile(messagesReceived) {
    return makeItem({
      message: concatTypedArrays(
        Uint8Array,
        messagesReceived.messages.map((m) => m.message)
      ),
      name: messagesReceived.name,
    });
  }

  function storeMessages(messagesReceived) {
    const item = messagesToLibraryFile(messagesReceived);
    setLibrarySysexMessages((s) => addToSysexMessages(s, item));
    return item;
  }
  const [
    sysexMessagesFromStorage,
    setLibrarySysexMessages,
    clearLibrarySysexMessages,
  ] = useLocalForage('sysexMessages', []);
  const librarySysexMessages = useMemo(() => sysexMessagesFromStorage ?? [], [
    sysexMessagesFromStorage,
  ]);
  const setStatusMessage = useCallback((msg) => {
    setStatusMessagesState((s) => s.concat({msg, id: uniqueID()}));
  }, []);
  const setErrorMessage = useCallback((msg) => {
    if (msg) console.error(msg);
    setErrorMessageState(msg);
  }, []);
  const sendMidi = (buf) => {
    if (midiOut?.port) {
      try {
        setErrorMessage(null);
        midiOut.port.send(new Uint8Array(buf));
        return true;
      } catch (err) {
        setErrorMessage(err.toString());
      }
    } else {
      setErrorMessage('no midi out selected');
    }
    return false;
  };

  const sendItem = (item) => {
    if (item.message[0] !== 0xf0) {
      setErrorMessage('not a valid sysex file');
      return false;
    }

    const messages = splitToSysExMessages(item.message);

    if (messages.length === 1) {
      if (sendMidi(item.message)) {
        setStatusMessage(`Sent "${item.name}" to ${midiOut?.port?.name}`);
      }
    } else {
      let messageIdx = 0;
      let error = false;
      while (messageIdx < messages.length) {
        if (!sendMidi(messages[messageIdx])) {
          error = true;
          break;
        }
      }
      if (!error) {
        setStatusMessage(
          `Sent "${item.name}" to ${midiOut?.port?.name} (messages sent: ${messageIdx} of ${messages})`
        );
      } else {
        setStatusMessage(
          `Failed to send "${item.name}" to ${midiOut?.port?.name} (messages sent: ${messageIdx} of ${messages})`
        );
      }
    }
  };

  function deleteItem(itemToDelete) {
    setLibrarySysexMessages((s) => s.filter((item) => item !== itemToDelete));
  }

  const updateItem = useCallback(
    function updateItem(itemToUpdate) {
      setLibrarySysexMessages((s) =>
        s.map((item) => (item.hash === itemToUpdate.hash ? itemToUpdate : item))
      );
    },
    [setLibrarySysexMessages]
  );

  useEffect(() => {
    if (!midiIn && !midiOut) {
      setStatusMessage('Select a midi in or out port to get started');
      setErrorMessage(null);
    }
  }, [midiIn, midiOut, setErrorMessage, setStatusMessage]);

  useEffect(() => {
    if (!midiIn?.port) return;
    midiIn.port.onmidimessage = (event) => {
      if (event.data[0] === 0xf0) {
        setStatusMessage(
          `Received ${event.data.length} byte message from ${midiIn.port.name}`
        );
        setSysexMessagesReceived((s) => {
          const newMsg = {
            name:
              parseSysexMessage(event.data)?.type ??
              `Dumped from ${midiIn.port.name}`,
            message: event.data,
            source: midiIn.port.name,
          };
          return s
            ? {...s, messages: s.messages.concat(newMsg)}
            : initSysexMessagesReceived(newMsg.name, [newMsg]);
        });
      }
    };
    return () => {
      midiIn.port.onmidimessage = null;
    };
  }, [midiIn, midiIn?.port, setLibrarySysexMessages, setStatusMessage]);

  const tableItems = useMemo(
    () =>
      librarySysexMessages
        .slice()
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    [librarySysexMessages]
  );
  return (
    <div className="App">
      <Logo />
      <h1 style={{padding: '0 16px'}}>Digital SysEx Message Loader</h1>
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
      </div>
      {errorMessage && (
        <div className="App_error" onClick={() => setErrorMessageState(null)}>
          {errorMessage}
        </div>
      )}
      <div className="App_columns">
        <div
          className="App_column_outer"
          style={{
            margin: 16,
          }}
        >
          <h2>Send</h2>
          <div style={{paddingBottom: 8}}>
            <Checkbox
              label="automatically send dragged & dropped files to device"
              checked={autoSend}
              onChange={() => setAutoSend((s) => !s)}
            />
          </div>
          <FileDropzone
            className="App_column_inner"
            autoSend={autoSend}
            onFile={(file, arrayBuffer) => {
              const buf = new Uint8Array(arrayBuffer);
              if (buf[0] !== 0xf0) {
                setErrorMessage(
                  `"${file.name} is not a valid sysex message file"`
                );
                return;
              }
              const item = makeItem({
                message: buf,
                name: file.name,
              });
              if (autoSend) {
                sendItem(item);
              } else {
                setStatusMessage(`Added "${item.name}" to library`);
              }
              setLibrarySysexMessages((s) => addToSysexMessages(s, item));
            }}
            onStatus={setErrorMessage}
          />
        </div>
        <div
          className="App_column_outer"
          style={{
            margin: 16,
          }}
        >
          <h2>Receive</h2>
          <div className="App_column_inner border-thin">
            <div>
              {sysexMessagesReceived?.messages.length ?? 0} messages received
              {(sysexMessagesReceived?.messages.length ?? 0) > 0 &&
                ` from ${sysexMessagesReceived?.messages[0].source}`}
            </div>
            <div>
              {sysexMessagesReceived?.messages.length > 0 && (
                <>
                  <div className="App_receive_group_filename">
                    Group filename:{' '}
                    <EditableText
                      value={sysexMessagesReceived.name}
                      size={40}
                      onChange={(updatedName) =>
                        setSysexMessagesReceived((s) => ({
                          ...s,
                          name: updatedName,
                        }))
                      }
                    />
                  </div>
                  <div className="App_receive_group_actions">
                    All messages:{' '}
                    <button
                      onClick={() => {
                        storeMessages(sysexMessagesReceived);
                      }}
                    >
                      store as group
                    </button>
                    <button
                      onClick={() => {
                        const item = messagesToLibraryFile(
                          sysexMessagesReceived
                        );
                        downloadItem(item);
                      }}
                    >
                      download
                    </button>
                    <button
                      onClick={() => {
                        setSysexMessagesReceived(null);
                      }}
                    >
                      discard all
                    </button>
                  </div>
                  <div style={{overflowY: 'auto', height: 216}}>
                    <Table
                      items={sysexMessagesReceived?.messages}
                      headings={['#', 'Filename', 'Bytes', 'Actions']}
                      layout={[30, 'auto', 65, 'auto']}
                      rowRenderer={(item, i) => [
                        `${i + 1}`,
                        <EditableText
                          className="App_receive_name"
                          value={item.name}
                          onChange={(updatedName) =>
                            updateSysexMessagesReceivedList((s) =>
                              s.map((otherItem) =>
                                otherItem === item
                                  ? {...item, name: updatedName}
                                  : otherItem
                              )
                            )
                          }
                        />,
                        `${item.message.length}B`,
                        <div className="App_table_actions App_receive_group_actions">
                          <button
                            onClick={() => {
                              storeMessages({
                                name: item.name,
                                messages: [item],
                              });
                            }}
                          >
                            store in library
                          </button>
                          <button
                            onClick={() => {
                              downloadItem(item);
                            }}
                          >
                            download
                          </button>
                          <button
                            onClick={() => {
                              updateSysexMessagesReceivedList((s) =>
                                s.filter((otherItem) => item !== otherItem)
                              );
                            }}
                          >
                            discard
                          </button>
                        </div>,
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          margin: 16,
        }}
      >
        <h2>Info</h2>
        <div
          className="border-thin"
          style={{
            height: 200,
            padding: 12,
            overflowY: 'scroll',
          }}
        >
          <LogView items={statusMessages.slice().sort((a, b) => b.id - a.id)} />
        </div>
      </div>
      <div style={{margin: 16}}>
        <h2>Library</h2>
        {tableItems.length ? (
          <Table
            items={tableItems}
            className="App_library_table"
            headings={['Name', 'Type', 'Msgs', 'Bytes', 'Added', 'Actions']}
            rowRenderer={(item) => [
              <ItemName item={item} updateItem={updateItem} />,
              item.type,
              item.messagesCount,
              `${item.message.length}B`,
              item.timestamp ? getTimestampString(item.timestamp) : 'unknown',
              <div className="App_table_actions">
                <SendButton item={item} sendItem={sendItem} />
                <DownloadButton item={item} />
                <InfoButton item={item} setModalContent={setModalContent} />
                <DeleteButton item={item} deleteItem={deleteItem} />
              </div>,
            ]}
          />
        ) : (
          'SysEx messages you upload or download will be listed here'
        )}
      </div>
      {Boolean(librarySysexMessages.length) && (
        <div style={{margin: 16}}>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure? This will delete everything you've uploaded or downloaded from this app"
                )
              ) {
                clearLibrarySysexMessages();
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
          className="Modal"
          overlayClassName="Modal_overlay"
        >
          <h2>{modalContent?.title}</h2>
          <button onClick={() => setModalContent(null)}>close</button>
          {modalContent?.body}
        </Modal>
      )}
      <Theme />
    </div>
  );
}

export default App;
