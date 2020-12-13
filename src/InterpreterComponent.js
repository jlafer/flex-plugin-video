import React, { useState, useEffect } from "react";
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import './InterpreterComponent.css';
import VideoCallControls from './VideoCallControls';
import vlib from './videoHelpers';

const domain = process.env.REACT_APP_SERVERLESS_DOMAIN;

const useStyles = makeStyles((theme) => ({
  margin: {
    margin: theme.spacing(1),
  }
}));

export default function InterpreterComponent(props) {
  console.log('InterpreterComponent: called with props', props);
  const classes = useStyles();

  const [topic, setTopic] = useState('general');
  const [text, setText] = useState('');
  const [identity, setIdentity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [audioDisabled, setAudioDisabled] = useState(false);
  const [previewWidth, setPreviewWidth] = useState('320');
  const [previewClass, setPreviewClass] = useState('preview-video');
  const [partywWidth, setPartyWidth] = useState('480');
  const [partyClass, setPartyClass] = useState('party-video');

  const [customerName, setCustomerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [inConference, setInConference] = useState(false);
  const [onPhone, setOnPhone] = useState(false);

  useEffect(
    () => {
      const {videoChatRoom: room, customerName, phoneNumber, topic} = props.task.attributes;
      const name = props.manager.workerClient.attributes.full_name;
      setIdentity(name);
      setCustomerName(customerName);
      setRoomName(room);
      setPhoneNumber(phoneNumber);
      setTopic(topic);
      vlib.init({
        domain,
        setPreviewingVideo, setInRoom, setSharingScreen
      });
      console.log(`after init, roomName=${roomName}`);
      vlib.join(room, name, onVideoEvent, true);
    },
    []
  );

  // TODO right now, there is no way for an agent to preview before they
  // take a video call
  function onPreviewStart(_e) {
    vlib.previewStart(onVideoEvent);
  }
  
  function onPreviewStop(_e) {
    vlib.previewStop();
  }
  
  function onLeaveRoom(_e) {
    vlib.leave();
  }
  
  function onJoinConference(_e) {
    const attributes = {
      roomName, customerName: identity, phoneNumber, topic
    };
    console.log('onJoinConference: submitting task attributes:', attributes);
    submitTask(attributes);
    setInConference(true);
  }

  function onLeaveConference(_e) {
    setInConference(false);
    vlib.leave();
  }

  function mute() {
    vlib.muteYourAudio();
  }
  
  function unmute() {
    vlib.unmuteYourAudio();
  }
  
  function camOff() {
    vlib.muteYourVideo();
  }
  
  function camOn() {
    vlib.unmuteYourVideo();
  }

  function submitText() {
    vlib.sendText(text);
  }
  
  const onVideoEvent = (event) => {
    console.log('onVideoEvent: ', event);
    switch (event.type) {
      case 'roomJoined':
        break;
      case 'roomLeft':
        break;
      case 'partyJoined':
        addPartyToGallery(event.identity, event.sid);
        break;
      case 'partyLeft':
        removePartyFromGallery(event.identity, event.sid);
        setInConference(false);
        break;
      case 'trackAdded':
        onTrackAdded(event);
        break;
      case 'audioMuted':
        setAudioDisabled(true);
        break;
      case 'videoMuted':
        setVideoDisabled(true);
        break;
      case 'audioUnmuted':
        setAudioDisabled(false);
        break;
      case 'videoUnmuted':
        setVideoDisabled(false);
        break;
      case 'msgReceived':
        addRemoteText(event.msg, event.participant.identity);
        break;
    }
  }

  function addPartyToGallery(identity, sid) {
    const gallery = document.getElementById('gallery');
    const div = document.createElement('div');
    div.id = sid;
    div.innerText = identity;
    gallery.appendChild(div);
    console.log(`addPartyToGallery: after append, gallery:`, gallery);
    const party = document.getElementById(sid);
    console.log(`addPartyToGallery: after append, party by sid:`, party);
  }
  
  function removePartyFromGallery(_identity, sid) {
    document.getElementById(sid).remove();
  }

  function onTrackAdded(event) {
    const {trackType, participant, track, element} = event;
    const {kind} = track;
    if (kind === 'data')
      return;
    console.log(`onTrackAdded: attaching ${kind} track`);
    let domId, className, width;
    if (trackType === 'remote') {
      domId = participant.sid;
      className = partyClass;
      width = partywWidth;
    }
    else {
      domId = 'local';
      className = previewClass;
      width = previewWidth;
    }
    console.log(`onTrackAdded: domId = ${domId}`);
    const party = document.getElementById(domId);
    console.log(`onTrackAdded: document:`, document);
    console.log(`onTrackAdded: party by sid:`, party);
    if (party.querySelector("video"))
      return;
    if (kind === 'video') {
      element.className = className;
      element.setAttribute('width', width);
    }
    party.appendChild(element);
  }

  function addRemoteText(msg, identity) {
    const element = createMessage(identity, msg);
    addElementToParentWithId('chat-log', element);
    scrollChatLog('chat-log');
  }

  function addLocalText(_e) {
    const element = createMessage('me', text);
    addElementToParentWithId('chat-log', element);
    scrollChatLog('chat-log');
    vlib.sendText(text);
    setText('');
  }

  function createMessage(fromName, message) {
    const pElement = document.createElement('p');
    pElement.innerHTML = `<b>${fromName}:</b> ${message}`;
    return pElement;
  }

  function dialTarget() {
    console.log(`dialing ${phoneNumber} from room ${roomName}`);
    const urlParams = `number=${phoneNumber}&roomName=${roomName}`;
    fetch(
      `${domain}/dialAndAddToRoom?${urlParams}`
    )
    .then(response => {
      setOnPhone(true);
      return response.json();
    })
  }

  const previewVideo = null;

  return (
    <div className="flex-container">
      <div className="preview">
        <div id="local" />
      </div>
      <div className="parties">
        <div id="gallery" className="flex-gallery" />
      </div>
      <div className="preview-ctls">
        {previewVideo}
      </div>
      <div className="call-ctls">
        <VideoCallControls inRoom={inRoom} onLeaveRoom={onLeaveRoom}
          inConference={inConference} onJoinConference={onJoinConference} onLeaveConference={onLeaveConference}
          sharingScreen={sharingScreen} shareStart={vlib.shareStart} shareStop={vlib.shareStop}
          audioDisabled={audioDisabled} mute={mute} unmute={unmute}
          videoDisabled={videoDisabled} camOff={camOff} camOn={camOn}
          onPhone={onPhone} dialTarget={dialTarget}
        />
      </div>
      <div className="chat">
      {inRoom ? (
        <div>
          <div>
            <TextField
                value={text ? text : ""}
                id="chat-text-fld"
                label="Chat Text"
                variant="outlined"
                disabled={!inRoom}
                onChange={e => setText(e.target.value)}
                className={classes.margin}
            />
            <Button onClick={addLocalText} variant='contained' color="primary" className={classes.margin}>Send</Button>
          </div>
          <div id="chat-log" />
        </div>
      ) : null}
      </div>
    </div>
  )
}

function addElementToParentWithId(id, element) {
  const parent = document.getElementById(id);
  parent.appendChild(element);
  console.log('added child:', element);
  console.log('...to parent', parent);
}

function scrollChatLog(id) {
  const chatLog = document.getElementById(id);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function submitTask(taskData) {
  const {roomName, customerName, phoneNumber, topic} = taskData;
  fetch(
    `${domain}/createvideotask?customerName=${customerName}&roomName=${roomName}&phoneNumber=${phoneNumber}&topic=${topic}`
  )
  .then(res => res.json())
  .then(data => {console.log("submitTask: created task: data:", data);});
}
