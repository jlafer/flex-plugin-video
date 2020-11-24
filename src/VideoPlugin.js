import { FlexPlugin } from 'flex-plugin';
import React from 'react';
import IncomingVideoComponent from './IncomingVideoComponent';
import CustomTheme from './CustomTheme'
import Videocam from '@material-ui/icons/Videocam';

const PLUGIN_NAME = 'VideoPlugin';

export default class VideoPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started
   * Use this to modify any UI components or attach to the actions framework
   *
   * @param flex { typeof import('@twilio/flex-ui') }
   * @param manager { import('@twilio/flex-ui').Manager }
   */
  init(flex, manager) {
    const {REACT_APP_SERVERLESS_DOMAIN} = process.env;

    // flex.CRMContainer.Content.replace(<IncomingVideoComponent manager={manager} icon="Video" iconActive="Video" key="IncomingVideoComponent" />);

    const configuration = {
      colorTheme: CustomTheme
    };
    manager.updateConfig(configuration);
    manager.strings.NoTasks = "Convo Relay Demo"

    flex.MainHeader.defaultProps.logoUrl = `${REACT_APP_SERVERLESS_DOMAIN}/assets/convo.png`

    flex.RootContainer.Content.remove("project-switcher")


    const videoChannel = flex.DefaultTaskChannels.createDefaultTaskChannel("video", (task) => task.taskChannelUniqueName === "video",
    <Videocam/>,<Videocam/>,"#c2d76e");
    videoChannel.replacedComponents = [
      {
        target: "CRMContainer",
        sortOrder: 1,
        align: "start",
        component: <IncomingVideoComponent manager={manager} icon="Video" iconActive="Video" key="IncomingVideoComponent" />
      }
    ]; 

    flex.TaskChannels.register(videoChannel);
  }
}
