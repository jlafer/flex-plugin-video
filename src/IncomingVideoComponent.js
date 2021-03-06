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
];

export default class IncomingVideoComponent extends React.Component {
  constructor(props) {
    super();
    this.state = {
      activeRoom: null,
      taskStatus: null,
      screenTrack: null,
      localAudio: null,
      localAudioDisabled: true,
      localVideo: null,
      localVideoDisabled: false
    };
    this.onRoomJoined = this.onRoomJoined.bind(this);
    this.onDisconnected = this.onDisconnected.bind(this);
    this.participantConnected = this.participantConnected.bind(this);
    this.participantDisconnected = this.participantDisconnected.bind(this);
    this.trackSubscribed = this.trackSubscribed.bind(this);
    this.trackUnsubscribed = this.trackUnsubscribed.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.getScreenShare = this.getScreenShare.bind(this);
    this.startScreenShare = this.startScreenShare.bind(this);
    this.stopScreenShare = this.stopScreenShare.bind(this);
    this.mute = this.mute.bind(this);
    this.unMute = this.unMute.bind(this);
    this.camOff = this.camOff.bind(this);
    this.camOn = this.camOn.bind(this);
    this.dialTarget = this.dialTarget.bind(this);

    this.remoteMedia = React.createRef();
  }

  // TODO why is connect-to-room done here and not in task.accepted CB?

  componentDidUpdate() {
    const taskStatus = this.props.task.taskStatus;
    if (this.state.taskStatus !== taskStatus) {
      this.setState({ taskStatus });
      if (taskStatus === 'assigned') {
        fetch(
          `${REACT_APP_SERVERLESS_DOMAIN}/flexvideotokenizer?Identity=${this.props.manager.workerClient.name}`
        )
        .then(response => {
          return response.json()
        })
        .then(data => {
          if (!data.token) {
            return console.log('ERROR: there was an error with the video tokenizer response');
          }
          Video.connect(data.token, { name: this.props.task.attributes.videoChatRoom })
            .then(this.onRoomJoined, error => {
            alert(`ERROR: could not connect to Twilio: ${error.message}`);
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

  async onRoomJoined(room) {
    console.log(`onRoomJoined: joined room ${room.name}`);
    this.setState({activeRoom: room});
    this.participantConnected(room.localParticipant);
    room.participants.forEach(this.participantConnected);
    room.on('participantConnected', this.participantConnected);
    room.on('participantDisconnected', this.participantDisconnected);
    room.on(
      'disconnected',
      this.onDisconnected
    );
  }

  onDisconnected(room, error) {
    if (error) {
      console.log('ERROR: unexpectedly disconnected:', error);
    }
    this.participantDisconnected(room.localParticipant);
    room.participants.forEach(this.participantDisconnected);
  }

  participantConnected(participant) {
    console.log(`participant ${participant.identity} connected`);
    const remoteContainer = this.remoteMedia.current;
    const div = document.createElement('div');
    div.id = participant.sid;
    div.innerText = participant.identity;
    div.style.borderStyle = "solid";
    div.style.borderWidth = "1px";
    div.style.borderColor = "red";
    remoteContainer.appendChild(div);
  
    participant.on(
      'trackSubscribed',
      track => this.trackSubscribed(participant, track)
    );
    participant.on('trackUnsubscribed', this.trackUnsubscribed);
  
    participant.tracks.forEach(publication => {
      if (publication.track) {
        this.trackSubscribed(participant, publication.track);
      }
    });
    // TODO figure out how to distinguish local from remote
    if (true) {
      // place the local audio in muted state
      // TODO hacky! relying on there being only one pub of each type!
      participant.audioTracks.forEach((publication) => {
        if (publication.track) {
          publication.track.disable();
          this.setState({
            localAudio: publication.track
          })
        }
      })
      participant.videoTracks.forEach((publication) => {
        this.setState({
          localVideo: publication.track
        })
      })
    }
  }
  
  participantDisconnected(participant) {
    console.log(`participant ${participant.identity} disconnected`);
    document.getElementById(participant.sid).remove();
  }
  
  trackSubscribed(participant, track) {
    console.log(`subscribing to ${participant.identity}'s track: ${track.kind}`);
    const trackDom = track.attach();
    trackDom.style.maxWidth = "50%";
    const participantElement = document.getElementById(participant.sid);
    // remote
    //trackDom.style.maxWidth = "100%";
    //trackDom.style.minWidth = "100%";
    // local
    //trackDom.style.maxWidth = "15%";
    //trackDom.style.position = "absolute";
    //trackDom.style.top = "80px";
    //trackDom.style.left = "10px";
    participantElement.appendChild(trackDom);
  }
  
  trackUnsubscribed(track) {
    track.detach().forEach(element => element.remove());
  }

  dialTarget() {
    const {phoneNumber} = this.props.task.attributes;
    const {name: roomName} = this.state.activeRoom;
    console.log(`dialing ${phoneNumber} from room ${roomName}`);
    const urlParams = `number=${phoneNumber}&roomName=${roomName}`;
    fetch(
      `${REACT_APP_SERVERLESS_DOMAIN}/dialAndAddToRoom?${urlParams}`
    )
    .then(response => {
      return response.json()
    })
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

  startScreenShare() {
    this.getScreenShare()
    .then((stream) => {
      const screenTrack = stream.getVideoTracks()[0];
      this.state.activeRoom.localParticipant.publishTrack(screenTrack);
      this.setState({
        screenTrack: screenTrack
      });
    })
  }

  stopScreenShare() {
    this.state.activeRoom.localParticipant.unpublishTrack(this.state.screenTrack);
    this.setState({
      screenTrack: null
    });
  }

  render() {
    return (
      <table>
        <tbody>
          <tr>
            <td>
              <Button variant="contained" style={ButtonStyle} color="secondary" onClick={this.disconnect}>Disconnect</Button>
              { !this.state.screenTrack ? <Button onClick={this.startScreenShare} variant='contained' style={ButtonStyle} color="primary">Screen Share</Button> : null }
              { this.state.screenTrack ? <Button onClick={this.stopScreenShare} variant='contained' style={EvilButtonStyle}  color="secondary">Stop Screen Share</Button> : null }
              { !this.state.localAudioDisabled ? <Button onClick={ this.mute } variant='contained' style={ButtonStyle} color="primary">Mute</Button> : null }
              { this.state.localAudioDisabled ? <Button onClick={ this.unMute } variant='contained' style={EvilButtonStyle} color="secondary">Unmute</Button> : null }
              { !this.state.localVideoDisabled ? <Button onClick={ this.camOff } variant='contained' style={ButtonStyle} color="primary">Turn Camera Off</Button> : null }
              { this.state.localVideoDisabled ? <Button onClick={ this.camOn } variant='contained' style={EvilButtonStyle} color="secondary">Turn Camera On</Button> : null }
              { this.state.activeRoom ? <Button onClick={ this.dialTarget } variant='contained' style={ButtonStyle} color="primary">Dial Target</Button> : null }
            </td>          
          </tr>
          <tr>
            <td>
              <div style={RemoteStyle} ref={this.remoteMedia} id="remote-media"></div>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }
}
