/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as AWS from "aws-sdk"
import { Iot } from "aws-sdk";
import { TemplateManager } from "./template-manager";
import { APIGatewayProxyEvent } from "aws-lambda";

const  iot = new AWS.Iot();

/**
 * This lambda creates and registers an iot device into AWS IOT Core
 * The handler will take the ThingName and CSR from the Api request body and use them to create
 * a provisioning template (see doc: https://docs.aws.amazon.com/iot/latest/developerguide/provision-template.html)
 * 
 * The handler will then call the registerThing with the provisioning template to :
 *   - register the IOT device in AWS IOT Core
 *   - Create and attach a policy that allows the device to connect to AWS IOT core
 *   - Generates a key pair for the device and returning the private key.
 * 
 * more information can be found here: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Iot.html#registerThing-property
 * 
 * @param {APIGatewayProxyEvent} event The event coming from Api Gateway proxy integration
 * @returns 
 */
export const handler = async (event: APIGatewayProxyEvent) => {
  const { ThingName, CSR, ...properties } = JSON.parse(event.body!)
  try {
    var params = {
      templateBody: TemplateManager.createProvisioningTemplate(properties),
      parameters: {
        ThingName,
        CSR: Buffer.from(CSR, 'base64').toString(),
      }
    } as Iot.Types.RegisterThingRequest;
    const { certificatePem, } = await iot.registerThing(params).promise();
    const { endpointAddress } = await iot.describeEndpoint({ endpointType: 'iot:Data-ATS' }).promise()
    return {
      statusCode: 200,            
      body: JSON.stringify({
        ThingName,
        certificatePem,
        endpointAddress,
      }),                  
    }
  } catch (error) {
    console.error('Could not provision the devision', error)
    return {
      statusCode: 500,
      body: error instanceof Error ? error.message : error,
    }
  }  
}