import * as R from 'ramda';
import Video from 'twilio-video';

export default (function() {
  const state = {
    domain: '',
    token: null,
    roomName: '',
    identity: '',
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

  const previewStart = (onVideoEvent) => {
    console.log('vlib.previewStart: called');
    state.onVideoEvent = onVideoEvent;
    const localTracksPromise = state.previewTracks
      ? Promise.resolve(state.previewTracks)
      : Video.createLocalTracks();
  
    localTracksPromise
    .then(
      tracks => {
        console.log('vlib.previewStart: started');
        state.previewTracks = tracks;
        attachPreviewTracks(tracks);
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
    if (!onVideoEvent) {
      throw new Error('onVideoEvent callback not supplied!')
    }
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
    if (!state.activeRoom)
      throw new Error('room not joined before shareStart called!')
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
    if (!state.activeRoom)
      throw new Error('room not joined before shareStop called!')
    state.activeRoom.localParticipant.unpublishTrack(
      state.screenTrack
    );
    if (state.setSharingScreen)
      state.setSharingScreen(false);
    state.screenTrack = null;
  }
  
  // TODO rename to sendMsg
  function sendText(msg) {
    if (!state.dataTrack)
      throw new Error('data track not created before sendText called!')
    state.dataTrack.send(msg);
  }
    
  function muteYourAudio() {
    if (!state.activeRoom)
      throw new Error('room not joined before muteYourAudio called!')
    muteOrUnmuteYourMedia(state.activeRoom, 'audio', 'mute', state.onVideoEvent);
  }
  
  function muteYourVideo() {
    if (!state.activeRoom)
      throw new Error('room not joined before muteYourVideo called!')
    muteOrUnmuteYourMedia(state.activeRoom, 'video', 'mute', state.onVideoEvent);
  }
    
  function unmuteYourAudio() {
    muteOrUnmuteYourMedia(state.activeRoom, 'audio', 'unmute', state.onVideoEvent);
  }
  
  function unmuteYourVideo() {
    muteOrUnmuteYourMedia(state.activeRoom, 'video', 'unmute', state.onVideoEvent);
  }
    
  async function onRoomJoined(room) {
    const {name, localParticipant, participants} = room;
    console.log(`onRoomJoined: room ${name} as ${localParticipant.identity}`);
    state.onVideoEvent({type: 'roomJoined'});
    state.activeRoom = room;
    onNewParticipantTrackPubs('local', localParticipant);
    participants.forEach(remoteParticipantJoined);

    console.log(`onRoomJoined: registering CBs`);
    room.on('participantConnected', remoteParticipantJoined);
    room.on('participantDisconnected', remoteParticipantLeft);
    room.on('disconnected', onDisconnected);
    console.log(`onRoomJoined: registered CBs`);

    if (state.setInRoom)
      state.setInRoom(true);
    if (state.setPreviewingVideo)
      state.setPreviewingVideo(false);
    if (state.hasDataTrack) {
      state.dataTrack = new Video.LocalDataTrack({name: 'chat'});
      room.localParticipant.publishTrack(state.dataTrack);
    }
  }
  
  function remoteParticipantJoined(participant) {
    const {identity, sid} = participant;
    console.log(`participant ${identity} connected`);
    onNewParticipantTrackPubs('remote', participant);

    participant.on(
      'trackSubscribed',
      track => onNewParticipantTrack('remote', participant, track)
    );
    participant.on('trackUnsubscribed', detachTrackFromElements);

    state.onVideoEvent({type: 'partyJoined', identity, sid});
  }
  
  function attachPreviewTracks(tracks) {
    tracks.forEach(track => {
      console.log(`attachPreviewTracks: attaching ${track.kind} track`);
      const element = track.attach();
      const event = {type: 'trackAdded', trackType: 'preview', track, element};
      state.onVideoEvent(event);
    });
  }

  function onNewParticipantTrackPubs(locOrRmt, participant) {
    const {identity, tracks} = participant;
    tracks.forEach(pub => {
      if (pub.track) {
        console.log(`onNewTrackPubs: ${identity} has ${pub.kind} track`);
        onNewParticipantTrack(locOrRmt, participant, pub.track);
      }
    });
  }

  function onNewParticipantTrack(locOrRmt, participant, track) {
    const event = {
      type: 'trackAdded', trackType: locOrRmt, participant, track
    };
    // TODO is this needed?  if (pub.isSubscribed)
    if (track.kind === 'data') {
      track.on('message', function(msg) {
        state.onVideoEvent({
          type: 'msgReceived', trackType: locOrRmt, participant, track, msg
        });
      });
    }
    else {
      event.element = track.attach();
    }
    state.onVideoEvent(event);
  }

  function detachAndStopPreviewTracks() {
    detachTracks(state.previewTracks);
    stopPreviewTracks(state.previewTracks);
    if (state.setPreviewingVideo)
      state.setPreviewingVideo(false);
  }
  
  function stopPreviewTracks(previewTracks) {
    if (previewTracks) {
      previewTracks.forEach(track => {
        track.stop();
      });
      state.previewTracks = null;
    }
  }
  
  function onDisconnected(room, error) {
    if (error)
      console.log('ERROR: unexpectedly disconnected:', error);
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(remoteParticipantLeft);
    if (state.setInRoom)
      state.setInRoom(false);
    state.activeRoom = null;
    state.onVideoEvent({type: 'roomLeft'});
  }
  
  function detachParticipantTracks(participant) {
    const publications = Array.from(participant.tracks.values())
    const tracks = publications.filter(pub => pub.kind !== 'data')
      .map(pub => pub.track);
    detachTracks(tracks);
    stopPreviewTracks(state.previewTracks);
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
  
  function remoteParticipantLeft(participant) {
    const {identity, sid} = participant;
    console.log(`participant ${identity} disconnected`);
    state.onVideoEvent({type: 'partyLeft', identity, sid});
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
    const eventType = `${kind}${action === 'mute' ? 'Muted' : 'Unmuted'}`
    onVideoEvent({type: eventType});
  });
}
