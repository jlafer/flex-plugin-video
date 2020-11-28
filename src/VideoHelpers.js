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
  });
}

export function muteYourAudio(room) {
  muteOrUnmuteYourMedia(room, 'audio', 'mute');
}

export function muteYourVideo(room) {
  muteOrUnmuteYourMedia(room, 'video', 'mute');
}
