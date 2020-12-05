import * as R from 'ramda';
import Video from 'twilio-video';

export default (function() {
  const state = {
    domain: '',
    token: null,
    roomName: '',
    identity: '',
    previewRef: null,
    partiesRef: null,
    shareRef: null,
    activeRoom: null,
    screenTrack: null,
    previewTracks: null,
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
        attachTracks(tracks, previewContainer);
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
  
  const join = R.curry((roomName, identity, onVideoEvent) => {
    state.roomName = roomName;
    state.identity = identity;
    state.onVideoEvent = onVideoEvent;
    const name = identity;
    console.log(`joining room ${roomName} as ${identity}`);
    const connectOptions = {name: roomName};
    if (state.previewTracks)
      connectOptions.tracks = state.previewTracks;
    getToken(state.domain, identity)
    .then(token => {
      return Video.connect(token, connectOptions)
    })
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
    muteOrUnmuteYourMedia(state.activeRoom, 'audio', 'mute');
  }
  
  function muteYourVideo() {
    muteOrUnmuteYourMedia(state.activeRoom, 'video', 'mute');
  }
    
  function unmuteYourAudio() {
    muteOrUnmuteYourMedia(state.activeRoom, 'audio', 'unmute');
  }
  
  function unmuteYourVideo() {
    muteOrUnmuteYourMedia(state.activeRoom, 'video', 'unmute');
  }
    
  function detachAndStopPreviewTracks() {
    detachTracks(state.previewTracks);
    stopPreviewTracks(state.previewTracks);
    if (state.setPreviewingVideo)
      state.setPreviewingVideo(false);
  }
  
  async function onRoomJoined(room) {
    console.log(`onRoomJoined: room ${room.name} as ${state.identity}`);
    state.activeRoom = room;
    const localContainer = state.previewRef.current;
    attachParticipantTracks(room.localParticipant, localContainer);
    room.participants.forEach(participantConnected);
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
    const tracks = publications.map(pub => pub.track);
    detachTracks(tracks);
    stopPreviewTracks(state.previewTracks);
  }
  
  function participantConnected(participant) {
    console.log(`participant ${participant.identity} connected`);
    const container = state.partiesRef.current;
    addParticipantToContainer(participant, container);
    participant.on(
      'trackSubscribed',
      track => trackSubscribed(participant, track)
    );
    participant.on('trackUnsubscribed', detachTrackFromElements);
    participant.tracks.forEach(publication => {
      if (publication.track) {
        console.log(`subscribing to an existing track for ${participant.identity}`);
        trackSubscribed(participant, publication.track);
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
  
  function attachParticipantTracks(participant, container) {
    const publications = Array.from(participant.tracks.values())
    const tracks = publications.map(pub => pub.track);
    attachTracks(tracks, container);
  }
  
  function attachTracks(tracks, container) {
    if (!container.querySelector("video")) {
      tracks.forEach(track => {
        const videoElement = track.attach();
        videoElement.width = 480;
        videoElement.height = 360;
        container.appendChild(videoElement);
      });
    }
  }
    
  function participantDisconnected(participant) {
    console.log(`participant ${participant.identity} disconnected`);
    document.getElementById(participant.sid).remove();
  }
  
  // TODO seems like this is wet (see attachTracks)
  function trackSubscribed(participant, track) {
    console.log(`subscribing to ${participant.identity}'s track: ${track.kind}`);
    const trackDom = track.attach();
    trackDom.style.maxWidth = "50%";
    const participantElement = document.getElementById(participant.sid);
    participantElement.appendChild(trackDom);
  }
  
  function detachTracks(tracks) {
    tracks.forEach(track => {
      detachTrackFromElements(track);
    });
  }
  
  function detachTrackFromElements(track) {
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
    muteYourAudio, unmuteYourAudio, muteYourVideo, unmuteYourVideo
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

function muteOrUnmuteYourMedia(room, kind, action) {
  const publications = kind === 'audio'
    ? room.localParticipant.audioTracks
    : room.localParticipant.videoTracks;

  publications.forEach(function(publication) {
    if (action === 'mute') {
      publication.track.disable();
    } else {
      publication.track.enable();
    }
    if (state.onVideoEvent) {
      const eventType = `${kind}${action === 'mute' ? 'Muted' : 'Unmuted'}`
      state.onVideoEvent({type: eventType});
    }
  });
}
