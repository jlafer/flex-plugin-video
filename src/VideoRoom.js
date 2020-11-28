import React from 'react';

const RoomStyle = {
  minWidth: '25%',
  borderStyle: "solid",
  borderWidth: "1px"
};

export default function VideoRoom(props) {
  const {room} = props;
  return (
    <h1 style={RoomStyle} >
      Hello Video World!
    </h1>
  )
}