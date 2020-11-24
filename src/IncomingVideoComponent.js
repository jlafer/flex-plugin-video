import React from 'react';
import Video from 'twilio-video';
import Button from '@material-ui/core/Button';

const {REACT_APP_SERVERLESS_DOMAIN} = process.env;

const ButtonStyle = {
  margin: '20px 10px',
  background: "#2aa4a2"
};

const EvilButtonStyle = {
  margin: '20px 10px',
  background: "red"
};


const RemoteStyle = {
  minWidth: '80%'
};

const disconnectedStatuses = [
  'completed',
  'wrapping'
]

export default class IncomingVideoComponent extends React.Component {
  constructor(props) {
    super();
    this.state = {
      activeRoom: null,
      taskStatus: null,
      screenTrack: null,
      isScreenSharing: false,
      localAudio: null,
      localAudioDisabled: true,
      localVideo: null,
      localVideoDisabled: false
    };
    this.roomJoined = this.roomJoined.bind(this);
    this.attachTracks = this.attachTracks.bind(this);
    this.attachParticipantTracks = this.attachParticipantTracks.bind(this);
    this.detachTracks = this.detachTracks.bind(this);
    this.detachParticipantTracks = this.detachParticipantTracks.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.getScreenShare = this.getScreenShare.bind(this);
    this.screenShare = this.screenShare.bind(this);
    this.stopScreenShare = this.stopScreenShare.bind(this);
    this.mute = this.mute.bind(this);
    this.unMute = this.unMute.bind(this);
    this.camOff = this.camOff.bind(this);
    this.camOn = this.camOn.bind(this);
  }

  componentDidUpdate() {
    const taskStatus = this.props.task.taskStatus;
    if (this.state.taskStatus !== taskStatus) {
      this.setState({ taskStatus });
      if (taskStatus === 'assigned') {
        fetch(
          `${REACT_APP_SERVERLESS_DOMAIN}/flexvideotokenizer?Identity=${this.props.manager.workerClient.name}`,
          {referrer: 'http:localhost:3000'}
        )
        .then(response => {
          return response.json()
        })
        .then(data => {
          if (!data.token) {
            return console.log('wow, there was an error with the video tokenizer response');
          }
          Video.connect(data.token, { name: this.props.task.attributes.videoChatRoom })
            .then(this.roomJoined, error => {
            alert('Could not connect to Twilio: ' + error.message);
          });
        })
      }
      if (disconnectedStatuses.includes(taskStatus)) {
        this.disconnect();
      }
    }
  }

  componentWillUnmount() {
    const taskStatus = this.props.task.taskStatus;
    if (disconnectedStatuses.includes(taskStatus)) {
      this.disconnect();
    }
  }

  // Attach the Tracks to the DOM.
  attachTracks(tracks, container) {
    tracks.forEach(function(track) {
      let trackDom = track.attach();
      trackDom.style.maxWidth = "100%";
      trackDom.style.minWidth = "100%";
      container.appendChild(trackDom);
    });
  }

  attachLocalTracks(tracks, container) {
    tracks.forEach(function(track) {
      let trackDom = track.attach();
      trackDom.style.maxWidth = "15%";
      trackDom.style.position = "absolute";
      trackDom.style.top = "80px";
      trackDom.style.left = "10px";
      container.appendChild(trackDom);
    });
  }

  // Attach the Participant's Tracks to the DOM.
  attachParticipantTracks(participant, container) {
    var tracks = Array.from(participant.tracks.values());
    this.attachTracks(tracks, container);
  }

  // Detach the Tracks from the DOM.
  detachTracks(tracks) {
    tracks.forEach(function(track) {
      track.detach().forEach(function(detachedElement) {
        detachedElement.remove();
      });
    });
  }

  // Detach the Participant's Tracks from the DOM.
  detachParticipantTracks(participant) {
    var tracks = Array.from(participant.tracks.values());
    this.detachTracks(tracks);
  }

  roomJoined(room) {
    this.setState({
      activeRoom: room
    });

    console.log(Array.from(room.localParticipant.tracks.values()));

    // places the local audio/video in state so we can easily mute later
    Array.from(room.localParticipant.tracks.values()).forEach((track) => {
      if (track.kind === "audio") {
        //track.disable();
        this.setState({
          localAudio: track
        })
        return;
      }
      this.setState({
        localVideo: track
      })
      return;
    })

    // add local tracks
    this.attachLocalTracks(Array.from(room.localParticipant.tracks.values()), this.refs.remoteMedia);

    // add participant tracks
    room.participants.forEach((participant) => {
        this.attachParticipantTracks(participant, this.refs.remoteMedia);
    });

    // when a participant adds a track, attach it
    room.on('trackSubscribed', (track, participant) => {
      console.log(participant.identity + " added track: " + track.kind);
      this.attachTracks([track], this.refs.remoteMedia);
    });

    // When a Participant removes a Track, detach it from the DOM.
    room.on('trackUnsubscribed', (track, participant) => {
      console.log(participant.identity + " removed track: " + track.kind);
      this.detachTracks([track]);
    });

    // When a Participant leaves the Room, detach its Tracks.
    room.on('participantDisconnected', (participant) => {
      console.log("Participant '" + participant.identity + "' left the room");
      this.detachParticipantTracks(participant);
    });

    // Once the LocalParticipant leaves the room, detach the Tracks
    // of all Participants, including that of the LocalParticipant.
    room.on('disconnected', () => {
      console.log('Left');
      this.detachParticipantTracks(room.localParticipant);
      room.participants.forEach(this.detachParticipantTracks);
    });
  }

  mute() {
    this.state.localAudio.disable();
    this.setState({
      localAudioDisabled: true
    })
  }

  unMute() {
    this.state.localAudio.enable();
    this.setState({
      localAudioDisabled: false
    })
  }
  camOff() {
    this.state.localVideo.disable();
    this.setState({
      localVideoDisabled: true
    })
  }

  camOn() {
    this.state.localVideo.enable();
    this.setState({
      localVideoDisabled: false
    })
  }

  disconnect() {
    this.state.activeRoom && this.state.activeRoom.disconnect();
    this.setState({
      activeRoom: null
    });
  }

  getScreenShare() {
    if (navigator.getDisplayMedia) {
      return navigator.getDisplayMedia({video: true});
    } else if (navigator.mediaDevices.getDisplayMedia) {
      return navigator.mediaDevices.getDisplayMedia({video: true});
    } else {
      return navigator.mediaDevices.getUserMedia({video: {mediaSource: 'screen'}});
    }
  }

  screenShare() {
    this.getScreenShare().then((stream) => {
      let screenTrack = stream.getVideoTracks()[0];
      this.state.activeRoom.localParticipant.publishTrack(screenTrack);
      this.setState({
        screenTrack: screenTrack,
        isScreenSharing: true
      });
    })
  }

  stopScreenShare() {
    this.state.activeRoom.localParticipant.unpublishTrack(this.state.screenTrack);
    this.setState({
      screenTrack: null,
      isScreenSharing: false
    });
  }

  render() {
    return (
      <div>
        <Button variant="contained" style={ButtonStyle} color="secondary" onClick={this.disconnect}>Disconnect</Button>
        { !this.state.isScreenSharing ? <Button onClick={this.screenShare} variant='contained' style={ButtonStyle} color="primary">Screen Share</Button> : null }
        { this.state.isScreenSharing ? <Button onClick={this.stopScreenShare} variant='contained' style={EvilButtonStyle}  color="secondary">Stop Screen Share</Button> : null }
        { !this.state.localAudioDisabled ? <Button onClick={ this.mute } variant='contained' style={ButtonStyle} color="primary">Mute</Button> : null }
        { this.state.localAudioDisabled ? <Button onClick={ this.unMute } variant='contained' style={EvilButtonStyle} color="secondary">Unmute</Button> : null }
        { !this.state.localVideoDisabled ? <Button onClick={ this.camOff } variant='contained' style={ButtonStyle} color="primary">Turn Camera Off</Button> : null }
        { this.state.localVideoDisabled ? <Button onClick={ this.camOn } variant='contained' style={EvilButtonStyle} color="secondary">Turn Camera On</Button> : null }
        <div style={RemoteStyle} ref="remoteMedia" id="remote-media"></div>
      </div>
    )
  }
}
