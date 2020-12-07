import React, { useState, useEffect, useRef } from "react";
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

  const [roomName, setRoomName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [identity, setIdentity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [topic, setTopic] = useState('general');
  const [text, setText] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [inConference, setInConference] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState(false);
  const [onPhone, setOnPhone] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [audioDisabled, setAudioDisabled] = useState(false);
  const previewRef = useRef(null);
  const partiesRef = useRef(null);
  const shareRef = useRef(null);

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
        options: {
          preview: {
            video: {
              className: 'preview-video',
              width: '320'
            }
          },
          party: {
            video: {
              className: 'party-video',
              width: '480'
            }
          }
        },
        previewRef, partiesRef, shareRef,
        setPreviewingVideo, setInRoom, setSharingScreen,
        onVideoEvent
      });
      console.log(`after init, roomName=${roomName}`);
      vlib.join(room, name, onVideoEvent, true);
    },
    []
  );

  function onPreviewStart(_e) {
    vlib.previewStart();
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
      case 'participantLeft':
        setInConference(false);
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
        addRemoteText(event.msg, event.identity);
    }
  }

  function addRemoteText(msg, identity) {
    const chatLog = document.getElementById('chat-log');
    chatLog.appendChild(createMessage(identity, msg));
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function addLocalText(_e) {
    const chatLog = document.getElementById('chat-log');
    chatLog.appendChild(createMessage('me', text));
    chatLog.scrollTop = chatLog.scrollHeight;
    vlib.sendText(text);
    setText('');
  }

  function createMessage(fromName, message) {
    const pElement = document.createElement('p');
    //pElement.className = 'chat-text';
    pElement.innerHTML = `<b>${fromName}:</b>  ${message}`;
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
        <div ref={previewRef} />
      </div>
      <div className="parties">
        <div ref={shareRef} className="party-video" />
        <div ref={partiesRef} className="flex-gallery" />
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

function submitTask(taskData) {
  const {roomName, customerName, phoneNumber, topic} = taskData;
  fetch(
    `${domain}/createvideotask?customerName=${customerName}&roomName=${roomName}&phoneNumber=${phoneNumber}&topic=${topic}`
  )
  .then(res => res.json())
  .then(data => {console.log("submitTask: created task: data:", data);});
}
