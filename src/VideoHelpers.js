import * as R from 'ramda';
import Video from 'twilio-video';

export default (function() {
  const state = {
    domain: '',
    token: null,
    roomName: '',
    identity: '',
    options: {},
    previewRef: null,
    partiesRef: null,
    shareRef: null,
    activeRoom: null,
    screenTrack: null,
    previewTracks: null,
    hasDataTrack: false,
    dataTrack: null,
    setPreviewingVideo: null,
    setInRoom: null,
    setSharingScreen: null,
    onVideoEvent: null
  };

  function init(config) {
    Object.assign(state, config);
    console.log('init: state now:', state);
  }

  const previewStart = () => {
    console.log('vlib.previewStart: called');
    const localTracksPromise = state.previewTracks
      ? Promise.resolve(state.previewTracks)
      : Video.createLocalTracks();
  
    localTracksPromise
    .then(
      tracks => {
        console.log('vlib.previewStart: started');
        state.previewTracks = tracks;
        const previewContainer = state.previewRef.current;
        attachTracks(tracks, previewContainer, state.options.preview);
        if (state.setPreviewingVideo)
          state.setPreviewingVideo(true);
      },
      function(error) {
        console.error('ERROR: unable to access local media', error);
      }
    );
  };
  
  function previewStop() {
    detachAndStopPreviewTracks();
  }
  
  const join = R.curry((roomName, identity, onVideoEvent, addDataTrack) => {
    state.roomName = roomName;
    state.identity = identity;
    state.onVideoEvent = onVideoEvent;
    state.hasDataTrack = addDataTrack;
    console.log(`joining room ${roomName} as ${identity}`);
    const connectOptions = {name: roomName};
    if (state.previewTracks)
      connectOptions.tracks = state.previewTracks;
    else {
      connectOptions.audio = true;
      connectOptions.video = true;
    }
    getToken(state.domain, identity)
    .then(token => Video.connect(token, connectOptions))
    .then(
      onRoomJoined,
      error => {
        alert(`ERROR: could not connect to Twilio: ${error.message}`);
      }
    );
  });
  
  function leave() {
    console.log(`${state.identity} is leaving room ${state.roomName}`);
    state.activeRoom && state.activeRoom.disconnect();
  }
  
  function shareStart() {
    console.log('shareStart: called');
    getScreenShare().then(stream => {
      console.log('shareStart: starting');
      state.screenTrack = stream.getVideoTracks()[0];
      state.activeRoom.localParticipant.publishTrack(
        stream.getVideoTracks()[0]
      );
      if (state.setSharingScreen)
        state.setSharingScreen(true);
    });
  }
  
  function shareStop() {
    state.activeRoom.localParticipant.unpublishTrack(
      state.screenTrack
    );
    if (state.setSharingScreen)
      state.setSharingScreen(false);
    state.screenTrack = null;
  }
  
  function muteYourAudio() {
    muteOrUnmuteYourMedia(state.activeRoom, 'audio', 'mute', state.onVideoEvent);
  }
  
  function muteYourVideo() {
    muteOrUnmuteYourMedia(state.activeRoom, 'video', 'mute', state.onVideoEvent);
  }
    
  function unmuteYourAudio() {
    muteOrUnmuteYourMedia(state.activeRoom, 'audio', 'unmute', state.onVideoEvent);
  }
  
  function unmuteYourVideo() {
    muteOrUnmuteYourMedia(state.activeRoom, 'video', 'unmute', state.onVideoEvent);
  }
    
  function sendText(msg) {
    state.dataTrack.send(msg);
  }
    
  function detachAndStopPreviewTracks() {
    detachTracks(state.previewTracks);
    stopPreviewTracks(state.previewTracks);
    if (state.setPreviewingVideo)
      state.setPreviewingVideo(false);
  }
  
  async function onRoomJoined(room) {
    const {name, localParticipant, participants} = room;
    console.log(`onRoomJoined: room ${name} as ${localParticipant.identity}`);
    state.activeRoom = room;
    const localContainer = state.previewRef.current;
    attachLocalTracks(localParticipant, localContainer, state.options.preview);
    participants.forEach(participantConnected);
    console.log(`onRoomJoined: registering CBs`);
    room.on('participantConnected', participantConnected);
    room.on('participantDisconnected', participantDisconnected);
    room.on(
      'disconnected',
      onDisconnected
    );
    console.log(`onRoomJoined: registered CBs`);
    if (state.setInRoom)
      state.setInRoom(true);
    if (state.setPreviewingVideo)
      state.setPreviewingVideo(false);
    if (state.onVideoEvent)
      state.onVideoEvent({type: 'roomJoined'});
    if (state.hasDataTrack) {
      state.dataTrack = new Video.LocalDataTrack({name: 'chat'});
      room.localParticipant.publishTrack(state.dataTrack);
    }
  }
  
  function onDisconnected(room, error) {
    if (error)
      console.log('ERROR: unexpectedly disconnected:', error);
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(participantDisconnected);
    if (state.setInRoom)
      state.setInRoom(false);
    state.activeRoom = null;
    if (state.onVideoEvent)
      state.onVideoEvent({type: 'roomLeft'});
  }
  
  function stopPreviewTracks(previewTracks) {
    if (previewTracks) {
      previewTracks.forEach(track => {
        track.stop();
      });
      state.previewTracks = null;
    }
  }
  
  function detachParticipantTracks(participant) {
    const publications = Array.from(participant.tracks.values())
    const tracks = publications.filter(pub => pub.kind !== 'data')
      .map(pub => pub.track);
    detachTracks(tracks);
    stopPreviewTracks(state.previewTracks);
  }
  
  // NOTE: called only for remote parties
  function participantConnected(participant) {
    const {identity, tracks, dataTracks} = participant;
    console.log(`participant ${identity} connected`);
    const container = state.partiesRef.current;
    addParticipantToContainer(participant, container);
    participant.on(
      'trackSubscribed',
      track => trackSubscribed(state.options.party, participant, track)
    );
    participant.on('trackUnsubscribed', detachTrackFromElements);
    // note participant.tracks are actually TrackPublications
    tracks.forEach(publication => {
      if (publication.track) {
        console.log(`subscribing to an existing track for ${identity}`);
        trackSubscribed(state.options.party, participant, publication.track);
      }
    });
    dataTracks.forEach(function(publication) {
      if (publication.isSubscribed && publication.trackName === 'chat') {
        publication.track.on('message', function(msg) {
          if (state.onVideoEvent)
            state.onVideoEvent({type: 'msgReceived', msg, identity});
        });
      }
    });
  }
  
  function getToken(domain, name) {
    if (state.token)
      return Promise.resolve(state.token)
    else {
      return fetchVideoToken(domain, name)
      .then(data => {
        state.token = data.token;
        return data.token;
      });
    }
  }
  
  function addParticipantToContainer(participant, container) {
    const div = document.createElement('div');
    div.id = participant.sid;
    // TODO this should move over to caller
    div.innerText = participant.identity;
    div.style.borderStyle = "solid";
    div.style.borderWidth = "1px";
    div.style.borderColor = "blue";
    container.appendChild(div);
  }
  
  function attachLocalTracks(participant, container, mbrOptions) {
    const publications = Array.from(participant.tracks.values())
    const tracks = publications.filter(pub => {
      console.log(`attachLocalTracks: ${participant.identity} has ${pub.kind} track`);
      return (pub.kind !== 'data')
    })
    .map(pub => pub.track);
    attachTracks(tracks, container, mbrOptions);
  }
  
  function attachTracks(tracks, container, mbrOptions) {
    if (!container.querySelector("video")) {
      tracks.forEach(track => {
        console.log(`attachTracks: found ${track.kind} track`);
        if (track.kind !== 'data') {
          attachTrack(track, container, mbrOptions)
        }
      });
    }
  }

  // TODO should we be appending tracks to dom child elements? seems like the
  // caller should control HTML 
  function attachTrack(track, container, mbrOptions) {
    console.log(`attachTracks: attaching ${track.kind} track`);
    const trackOptions = getTrackOptions(mbrOptions, track);
    const element = track.attach();
    if (trackOptions && trackOptions.className)
      element.className = trackOptions.className;
    if (trackOptions && trackOptions.width)
      element.setAttribute('width', trackOptions.width);
    container.appendChild(element);
  }
  
  function trackSubscribed(mbrOptions, participant, track) {
    if (track.kind !== 'data') {
      const participantElement = document.getElementById(participant.sid);
      attachTrack(track, participantElement, mbrOptions);
    }
    else {
      if (track.name === 'chat') {
        track.on('message', function(msg) {
          if (state.onVideoEvent)
            state.onVideoEvent({type: 'msgReceived', msg, identity: participant.identity});
        });
      }  
    }
  }

  function participantDisconnected(participant) {
    console.log(`participant ${participant.identity} disconnected`);
    document.getElementById(participant.sid).remove();
  }
  
  function detachTracks(tracks) {
    tracks.forEach(track => {
      if (track.kind !== 'data') {
        detachTrackFromElements(track);
      }
    });
  }
  
  function detachTrackFromElements(track) {
    if (track.kind !== 'data')
      track.detach().forEach(element => element.remove());
  }
    
  function getScreenShare() {
    if (navigator.getDisplayMedia) {
      return navigator.getDisplayMedia({ video: true });
    } else if (navigator.mediaDevices.getDisplayMedia) {
      return navigator.mediaDevices.getDisplayMedia({ video: true });
    } else {
      return navigator.mediaDevices.getUserMedia({
        video: { mediaSource: "screen" }
      });
    }
  }
  
  return {
    init,
    previewStart, previewStop,
    join, leave,
    shareStart, shareStop,
    muteYourAudio, unmuteYourAudio, muteYourVideo, unmuteYourVideo,
    sendText
  }
})();

export function fetchVideoToken(url, identity) {
  return fetch(`${url}/flexvideotokenizer?Identity=${identity}`)
  .then(res => res.json())
  .then(data => {
    console.log("new token data:", data);
    return {
      token: data.token,
      identity: data.identity
    };
  });
}

function muteOrUnmuteYourMedia(room, kind, action, onVideoEvent) {
  const publications = (kind === 'audio')
    ? room.localParticipant.audioTracks
    : room.localParticipant.videoTracks;

  publications.forEach(function(publication) {
    if (action === 'mute')
      publication.track.disable();
    else
      publication.track.enable();
    if (onVideoEvent) {
      const eventType = `${kind}${action === 'mute' ? 'Muted' : 'Unmuted'}`
      onVideoEvent({type: eventType});
    }
  });
}

function getTrackOptions(mbrOptions, track) {
  if (mbrOptions)
    return (track.kind === 'video') ? mbrOptions.video : mbrOptions.audio;
  else
    return null;
}