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
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AccessLogFormat, AuthorizationType, Deployment, JsonSchemaType, LambdaIntegration, LambdaRestApi, LogGroupLogDestination, Model, RequestValidator, Stage } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { PolicyStatement, User } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

const environment = process.env.DEPLOYMENT_ENV || 'dev'
const version = process.env.VERSION || '1'
const stageName = `v${version}`

/**
 * This construct creates an API Gateway endpoint with AWS_IAM authorization
 * It also create an AWS IAM user named "provision-user" that is allowed to call the API
 * 
 * @api {post} /provision/device Provision an IOT device in AWS IOT Core with a CSR
 * @apiName provisionDevice
 * @apiGroup User
 * 
 * @apiHeader {String} Authorization     The AWS signature token
 *
 * @apiBody {String} ThingName           The id of the device
 * @apiBody {String} CSR                 A base64 encoded CSR
 * @apiBody {String} [ThingTypeName]     Type of the device
 * @apiBody {Array} [ThingGroups]       Group of the device
 * @apiBody {Object} [AttributePayload]  a key value pair of attributes to attach to the device
 *
 * @apiSuccess {String} ThingName        The id of the device
 * @apiSuccess {String} certificatePem   The private certificate as a string
 * @apiSuccess {String} endpointAddress  url of the iot endpoint to connect to
 * 
 */
export class ProvisionIotDeviceViaApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const handler = new NodejsFunction(this, 'provision-device', {
      entry: `${__dirname}/../src/lambda/provision-device.ts`, 
      handler: 'handler', 
    });

    const lambdaPolicy = new PolicyStatement({
      actions: [
        'iot:CreateThing',
        'iot:RegisterThing', 
        'iot:DescribeThing',
        'iot:ListThingGroupsForThing',
        'iot:ListThingPrincipals',
        'iot:DescribeThingType',
        'iot:CreateCertificateFromCsr',
        'iot:CreatePolicy',
        'iot:AttachPrincipalPolicy',
        'iot:AttachThingPrincipal',
        'iot:UpdateCertificate',
        'iot:DescribeCertificate',
        'iot:DescribeEndpoint',
      ],
      resources: ['*'],
    })

    handler.addToRolePolicy(lambdaPolicy)

    const logGroup = new LogGroup(this, `${environment}Logs`);

    // The code that defines your stack goes here
    const restApi = new LambdaRestApi(this, 'iot-device', {
      handler,
      proxy: false,
      deployOptions: {
        stageName,
        accessLogDestination: new LogGroupLogDestination(logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields()
      }
    });

    const provision = restApi.root.addResource('provision');
    const provisionDevice = provision.addResource('device');

    const bodyValidator = new Model(this, "body-validator", {
      restApi,
      contentType: "application/json",
      description: "validate the request body",
      modelName: "cdkDeviceProvisionValidator",
      schema: {
        type: JsonSchemaType.OBJECT,
        required: ["ThingName", "CSR"],
        properties: {
          ThingName: { type: JsonSchemaType.STRING },
          CSR: { type: JsonSchemaType.STRING },
          ThingTypeName: { type: JsonSchemaType.STRING },
          ThingGroups: { type: JsonSchemaType.ARRAY },
          AttributePayload: { type: JsonSchemaType.OBJECT },
        },
      },
    });

    const bodyRequestValidator = new RequestValidator(this, 'bodyRequestValidator', {
      restApi,
      requestValidatorName: 'bodyRequestValidator',
      validateRequestBody: true,
      validateRequestParameters: false,
    });
    
    provisionDevice.addMethod(
      'POST', 
      new LambdaIntegration(handler), 
      { 
        authorizationType: AuthorizationType.IAM,
        requestValidator: bodyRequestValidator,
        requestModels: {
          "application/json": bodyValidator,
        },
      },
      
    );    

    const iamUserPolicy = new PolicyStatement({
      actions: [
        'execute-api:Invoke',
      ],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${restApi.restApiId}/${stageName}/POST${provisionDevice.path}`],
    })

    const user = new User(this, 'provision-user', { userName: 'provision-user'})
    user.addToPolicy(iamUserPolicy)
  }
}
