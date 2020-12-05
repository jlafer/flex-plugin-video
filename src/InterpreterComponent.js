import React, { useState, useEffect, useRef } from "react";
import Button from '@material-ui/core/Button';
//import TextField from '@material-ui/core/TextField';
import './InterpreterComponent.css';

import vlib from './videoHelpers';

const domain = process.env.REACT_APP_SERVERLESS_DOMAIN;

const disconnectedStatuses = [
  'completed',
  'wrapping'
];

export default function InterpreterComponent(props) {
  console.log('InterpreterComponent: called with props', props);
  const [roomName, setRoomName] = useState('');
  const [identity, setIdentity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [inConference, setInConference] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [localVideoDisabled, setLocalVideoDisabled] = useState(false);
  const [localAudioDisabled, setLocalAudioDisabled] = useState(false);
  const previewRef = useRef(null);
  const partiesRef = useRef(null);
  const shareRef = useRef(null);
  //const [taskStatus, setTaskStatus] = useState(null);

  useEffect(
    () => {
      const name = props.manager.workerClient.name;
      const room = props.task.attributes.videoChatRoom;
      setIdentity(name);
      setRoomName(room);
      setPhoneNumber(props.task.attributes.phoneNumber);
      vlib.init({
        domain,
        previewRef, partiesRef, shareRef,
        setPreviewingVideo, setInRoom, setSharingScreen,
        onVideoEvent
      });
      console.log(`AFTER init, roomName=${name}`);
      vlib.join(room, name, onVideoEvent);
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
      roomName,
      customerName: identity,
      phoneNumber
    };
    console.log('onJoinConference: submitting task attributes:', attributes);
    submitTask(attributes);
  }

  function onLeaveConference(_e) {
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

  const onVideoEvent = (event) => {
    console.log('onVideoEvent: ', event);
    if (event.type === 'roomJoined') {}
    if (event.type === 'roomLeft') {}
    if (event.type === 'audioMuted') {
      setLocalAudioDisabled(true);
    }
    if (event.type === 'videoMuted') {
      setLocalVideoDisabled(true);
    }
    if (event.type === 'audioUnmuted') {
      setLocalAudioDisabled(false);
    }
    if (event.type === 'videoUnmuted') {
      setLocalVideoDisabled(false);
    }
    if (event.type === 'conferenceJoined')
      setInConference(true);
    if (event.type === 'conferenceLeft')
      setInConference(false);
  }

  function dialTarget() {
    console.log(`dialing ${phoneNumber} from room ${roomName}`);
    const urlParams = `number=${phoneNumber}&roomName=${roomName}`;
    fetch(
      `${domain}/dialAndAddToRoom?${urlParams}`
    )
    .then(response => {
      return response.json()
    })
  }

  const previewVideo = getVideoPreviewButton(inRoom, previewingVideo, onPreviewStart, onPreviewStop);
  const hangupButton = getHangupButton(inRoom, onLeaveRoom);
  const conferenceButton = getConferenceButton(inConference, onJoinConference, onLeaveConference);
  const shareScreenButton = getScreenSharingButton(inRoom, sharingScreen, vlib.shareStart, vlib.shareStop);

  return (
    <div className="flex-container">
      <div className="preview">
        <div ref={previewRef} />
      </div>
      <div className="parties">
        <div ref={partiesRef} id="remote-media" />
      </div>
      <div className="preview-ctls">
        {previewVideo}
      </div>
      <div className="call-ctls">
        {hangupButton}
        {conferenceButton}
        {shareScreenButton}
        { !localAudioDisabled ? <Button onClick={ mute } variant='contained' color="primary">Mute</Button> : null }
        { localAudioDisabled ? <Button onClick={ unmute } variant='contained' color="secondary">Unmute</Button> : null }
        { !localVideoDisabled ? <Button onClick={ camOff } variant='contained' color="primary">Turn Camera Off</Button> : null }
        { localVideoDisabled ? <Button onClick={ camOn } variant='contained' color="secondary">Turn Camera On</Button> : null }
        { inRoom ? <Button onClick={ dialTarget } variant='contained' color="primary">Dial Target</Button> : null }
      </div>
    </div>
  )
}

function getVideoPreviewButton(inRoom, previewingVideo, onPreviewStart, onPreviewStop) {
  let previewVideo;

  if (inRoom) {
    previewVideo = 
      <Button disabled variant="contained" >Stop Preview</Button>;
  } else if (previewingVideo) {
    previewVideo = 
      <Button color="secondary" onClick={onPreviewStop} variant="contained" >
        Stop Preview
      </Button>;
  } else {
    previewVideo = (
      <Button color="primary" onClick={onPreviewStart} variant="contained">
        Preview Video
      </Button>
    );
  }
  return previewVideo;
}
  
function getConferenceButton(inConference, onJoinConference, onLeaveConference) {
  const button = inConference
  ? (
    <Button color="secondary" onClick={onLeaveConference} variant="contained">
      Leave Conference
    </Button>
  )
  : (
    <Button color="primary" onClick={onJoinConference} variant="contained">
      Conference
    </Button>
  );
  return button;
}

function getHangupButton(inRoom, onLeaveRoom) {
  const button = inRoom
  ? (
    <Button color="secondary" onClick={onLeaveRoom} variant="contained">
      Hang Up
    </Button>
  )
  : (
    <div>
      <Button disabled onClick={onLeaveRoom} variant="contained">
        Hang Up
      </Button>
    </div>
  );
  return button;
}

function getScreenSharingButton(inRoom, sharingScreen, onShareScreenStart, onShareScreenStop) {
  let button;

  if (!inRoom) {
    button = (
      <Button disabled variant="contained">Share Screen</Button>
    );
  } else if (sharingScreen) {
    button = (
      <Button color="secondary" onClick={onShareScreenStop} variant="contained">
        Stop Sharing
      </Button>
    );
  } else {
    button = (
      <Button color="primary" onClick={onShareScreenStart} variant="contained">
        Share Screen
      </Button>
    );
  }
  return button;
}

function submitTask(taskData) {
  const {roomName, customerName, phoneNumber} = taskData;
  fetch(
    `${domain}/createvideotask?customerName=${customerName}&roomName=${roomName}&phoneNumber=${phoneNumber}`
  )
  .then(res => res.json())
  .then(data => {console.log("submitTask: created task: data:", data);});
}
