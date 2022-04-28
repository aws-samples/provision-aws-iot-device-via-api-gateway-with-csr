import * as AWS from "aws-sdk"
import event from './event.json'
import eventFail from './event-failed.json'
import { handler } from '../src/lambda/provision-device'

const  iot = new AWS.Iot();

jest.mock('aws-sdk', () => {
  return {
    Iot: jest.fn().mockImplementation(() => ({
      registerThing: jest.fn().mockImplementation((params) => ({
        promise: jest.fn()
          .mockImplementation(() => {
            if (params.parameters.ThingName === 'broken-device') {
              throw new Error('device error')
            } else {
              return { certificatePem: '--the certificate--' }
            } 
          })
      })),
      describeEndpoint: jest.fn().mockImplementation(() => ({
        promise: jest.fn()
          .mockResolvedValueOnce({ endpointAddress: 'endpoint.aws.com' })
          .mockRejectedValueOnce(new Error('Could not register thing')),
      }))
    }))
  } 
})

describe('provision-device', () => {
  test('It should succeed', async () => {
    const response = await handler(event)
    expect(response).toMatchObject({
      "body": "{\"ThingName\":\"lightbulb-1\",\"certificatePem\":\"--the certificate--\",\"endpointAddress\":\"endpoint.aws.com\"}", 
      "statusCode": 200
    })
  });

  test('It should fail', async () => {
    const response = await handler(eventFail)
    expect(response).toMatchObject({
      "body": "device error", 
      "statusCode": 500
    })
  });
});