/**
Be sure to set
TWILIO_WORKSPACE_SID
TWILIO_VIDEO_WORKFLOW_SID
TWILIO_SYNC_SERVICE_SID
**/
const {corsResponse} = require('jlafer-twilio-runtime-util');
const fnName = 'createvideotask';

function createTask(client, workspace, workflow, taskAttributes) {
  return new Promise((resolve, reject) => {
    client.taskrouter.workspaces(workspace).tasks.create({
      attributes: JSON.stringify(taskAttributes),
      workflowSid: workflow,
      taskChannel: 'video'
    })
    .then(task => resolve(task))
    .catch((error) => {
      console.log(`${fnName}: error on createTask:`, error);
      reject(error);
    })
  })
}

async function upsertSyncDoc(client, syncSvcSid, uniqueName, data) {
  try {
    await client.sync.services(syncSvcSid).documents(uniqueName).fetch();
    return client.sync.services(syncSvcSid).documents(uniqueName).update({
      data: data
    })
  }
  catch (error) {
    console.log(`${fnName}: error on upsertSyncDoc:`, error);
    // TODO check for serious errors
    return client.sync.services(syncSvcSid).documents.create({
      data,
      ttl: 3600,
      uniqueName
    })
  }
}

function createSyncDoc(client, syncService, roomName, taskSid, phoneNumber) {
  const data = {
    taskSid: taskSid,
    phoneNumber: phoneNumber
  };
  return upsertSyncDoc(client, syncService, roomName, data);
}

exports.handler = function(context, event, callback) {
  console.log(`${fnName}: entered`);
  const response = corsResponse();
  console.log(`${fnName}: context:`, context);
  console.log(`${fnName}: called with:`, event);
  response.appendHeader('Content-Type', 'application/json');
  const workspace = context.TWILIO_WORKSPACE_SID;
  const workflow = context.TWILIO_VIDEO_WORKFLOW_SID;
  const syncService = context.TWILIO_SYNC_SERVICE_SID;
  const { roomName, customerName, worker, phoneNumber } = event;

  let client = context.getTwilioClient();

  createTask(client, workspace, workflow, {
    name: customerName,
    url: context.DOMAIN_NAME,
    flexWorker: decodeURI(worker),
    phoneNumber: phoneNumber,
    videoChatRoom: roomName
  })
  .then(async task => {
    await createSyncDoc(client, syncService, roomName, task.sid, phoneNumber);
    return task;
  })
  .then((task) => {
    response.setBody(task.sid);
    callback(null, response);
  })
  .catch((error) => {
    console.log(`${fnName}: error:`, error);
    callback(error)
  });
};
