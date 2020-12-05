import { FlexPlugin } from 'flex-plugin';
import React from 'react';
//import IncomingVideoComponent from './IncomingVideoComponent';
import InterpreterComponent from './InterpreterComponent';
import CustomTheme from './CustomTheme'

const PLUGIN_NAME = 'VideoPlugin';

export default class VideoPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  init(flex, manager) {
    const {REACT_APP_SERVERLESS_DOMAIN} = process.env;

    const configuration = {
      colorTheme: CustomTheme
    };
    manager.updateConfig(configuration);
    manager.strings.NoTasks = "Convo Relay Demo";
    flex.MainHeader.defaultProps.logoUrl = `${REACT_APP_SERVERLESS_DOMAIN}/ConvoLogoWeb.png`;
    flex.RootContainer.Content.remove("project-switcher");

    const videoChannel = flex.DefaultTaskChannels.createDefaultTaskChannel("video", (task) => task.taskChannelUniqueName === "video");
    videoChannel.icons = {
      active: 'Video',
      list: {
        Assigned:  'Video',
        Canceled:  'Video',
        Completed: 'Video',
        Pending:   'Video',
        Reserved:  'Video',
        Wrapping:  'Video'
      },
      main: 'Video'
    };
    videoChannel.replacedComponents = [
      {
        target: "CRMContainer",
        options: {sortOrder: 1, align: "start"},
        component: <InterpreterComponent manager={manager} icon="Video" iconActive="Video" key="InterpreterComponent" />
      }
    ];

    flex.TaskChannels.register(videoChannel);
  }
}
