import React from "react";
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  margin: {
    margin: theme.spacing(1),
  }
}));

export default function VideoCallControls(props) {
  const {
    inRoom, onLeaveRoom,
    inConference, onJoinConference, onLeaveConference,
    sharingScreen, shareStart, shareStop,
    audioDisabled, mute, unmute,
    videoDisabled, camOff, camOn,
    onPhone, dialTarget
  } = props;

  const classes = useStyles();

  const hangupButton = makeButton(
    inRoom, inRoom,
    {text: 'Hang Up', onClick: onLeaveRoom}, {text: 'Call User', onClick: onLeaveRoom}
  );
  const conferenceButton = makeButton(
    inRoom, !inConference,
    {text: 'Conference', onClick: onJoinConference}, {text: 'Transfer', onClick: onLeaveConference}
  );
  const shareScreenButton = makeButton(
    inRoom, !sharingScreen,
    {text: 'Share Screen', onClick: shareStart}, {text: 'Stop Sharing', onClick: shareStop}
  );
  const audioButton = makeButton(
    inRoom, !audioDisabled,
    {text: 'Mute Audio', onClick: mute}, {text: 'Unmute Audio', onClick: unmute}
  );
  const videoButton = makeButton(
    inRoom, !videoDisabled,
    {text: 'Pause Video', onClick: camOff}, {text: 'Resume Video', onClick: camOn}
  );
  const phoneButton = makeButton(
    inRoom, !onPhone,
    {text: 'Place Call', onClick: dialTarget}, {text: 'Release Call', onClick: dialTarget}
  );

  function makeButton(isEnabled, isPrimaryState, primaryOpts, secondaryOpts) {
    if (!isEnabled) {
      return (
        <Button disabled variant="contained" className={classes.margin}>
          {primaryOpts.text}
        </Button>
      )
    }
    let applicableOpts, color;
    if (isPrimaryState) {
      applicableOpts = primaryOpts;
      color="primary";
    }
    else {
      applicableOpts = secondaryOpts;
      color="secondary";
    }
    const {text, onClick} = applicableOpts;
    return (
      <Button onClick={onClick} variant="contained" color={color} className={classes.margin}>
        {text}
      </Button>
    )
  }

  return (
    <div>
      {hangupButton}  
      {conferenceButton}
      {shareScreenButton}
      {audioButton}
      {videoButton}
      {phoneButton}
    </div>
  )
}
