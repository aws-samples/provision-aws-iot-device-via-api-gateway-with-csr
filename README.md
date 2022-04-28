# Provision an Iot Device in AWS IOT Core using Api Gateway


This Serverless pattern demonstrates how to provision an IoT device (called a Thing in AWS IOT Core) via Amazon API gateway using a Certificate Signing Request (CSR) . This can be used to automate device provisioning in a factory.

This sample uses AWS CDK to deploy the following components:

 - An AWS IAM user
 - An Amazon API Gateway resource (with an IAM Authorizer)
 - An AWS Lambda


## Prerequisites 

 - An active AWS Account 
 - Node.js (version < 16.14.2) and NPM
 - The AWS Cloud Development Kit (CDK) installed. See the [AWS CDK Guide](https://docs.aws.amazon.com/cdk/v2/guide/work-with.html)
 - AWS Command Line Interface. See the [AWS CLI](https://aws.amazon.com/cli/) documentation
 - A self signed certificate signing request (CSR) or Follow [these steps](https://docs.aws.amazon.com/acm-pca/latest/userguide/PcaGetCsr.html) to retrieve it from AWS Certificate Manager


## Limitations 

This sample uses a CSR to provision a device in AWS IoT core. 

This solution does not create a shadow device.

Calling this API more than once with the same "ThingName" will not fail, it will instead -each time- create a new key pair certificate for the device. All key pairs will be in an active state (this is the default behaviour of the IoT SDK).


## Costs

This sample is eligible for the AWS free tier.

However, creating a CSR using AWS Certificate Manager (ACM) costs $400.00 per month for each ACM private certification authority (CA) until you delete the CA.
For more information, see [AWS Certificate Manager Pricing](https://aws.amazon.com/certificate-manager/pricing/) documentation.


## Stack deployed  

This sample uses AWS Cloud Development Kit (CDK) which provisions -through an AWS CloudFormation template- the following resources:

### AWS IAM User

An AWS IAM user called "provision-user" with an inline policy that only grants him the right to call the Amazon API Gateway. 

### Amazon API Gateway

The Amazon API Gateway deployed is a REST API that uses a POST method and a path : /provision/device with a stage named "v1" . The deployed Api uses an IAM Authorizer.

  A Request Body Model validator is created to check the format of the body following this JSON schema :

  ```JSON
  { 
    "$schema": "http://json-schema.org/draft-04/schema#", 
    "type": "object", 
    "required": ["ThingName", "CSR"], 
    "properties": {
        "ThingName": { "type": "string" }, 
        "CSR": { "type": "string" }, 
        "ThingTypeName": { "type": "string" }, 
        "AttributePayload": { "type": "object" }, 
        "ThingGroups": { "type": "array" }
    } 
  }
  ```

  The body of the request must be a JSON that contains the following keys:

  - ThingName (required) :  a unique name containing only: letters, numbers, hyphens, colons, or underscores. A thing name can't contain any spaces. 
  - CSR (required): the CSR encoded in base64
  - ThingTypeName (optional):  see [Thing types](https://docs.aws.amazon.com/iot/latest/developerguide/thing-types.html) 
  - ThingGroups (optional) : Array of group names. see [Thing Groups](https://docs.aws.amazon.com/iot/latest/developerguide/thing-groups.html)


The response body is:

```JSON
HTTP 200 OK 
{
  "ThingName": "name of the thing sent in the request",
  "certificatePem": "the certificate as a string",
  "endpointAddress": "url of the iot endpoint",
}
```


### AWS Lambda:

The AWS Lambda will call the AWS javascript IoT SDK to create a Thing in AWS Iot Core using the [registerThing](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Iot.html#registerThing-property) method.

This method takes two parameters:

 - templateBody: The provisioning template, see [Provision template Developer Guide](https://docs.aws.amazon.com/iot/latest/developerguide/provision-template.html) for more information.
 
    The template body also contains the policy that will be attached to each thing created.
    The policy used in this pattern allows every device to connect to AWS IOT core mqtt broker, publish a message to any mqtt topic that starts with '/<ThingName>/' and receive messages from mqtt topics that starts with '/<ThingName>/'.
    The policy automatically assigned to the IOT device is :

    ```JSON
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "iot:Publish",
                    "iot:Connect",
                    "iot:Subscribe"
                ],
                "Resource": [
                    "arn:aws:iot:<region>:<accountId>:topic/${ThingName$}/*"
                ]
            }
        ]
    }
    ```

  - parameters: The parameters for provisioning a thing in AWS IoT Core. In this pattern it corresponds to the API body request JSON

 

## How to test and deploy the Stack

1. configure your aws account using aws cli. more information here: [aws-cli configure](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)

2. Install CDK:
    ```sh
    npm install -g cdk@~2
    ```


3. Clone the git repository	and cd into it

4. Install the dependencies
   ```
   npm install
   ```

5. Bootstrap CDK	
    
    ```
    cdk bootstrap
    ```

6. Deploy the package	

    ```
    cdk deploy
    ```

7. Configure AWS IAM user

    - Sign in to the AWS Management Console and open the IAM console at https://console.aws.amazon.com/iam/.

    - In the navigation pane, choose Users and then select the user "provision-user".

    - Select "Security credentials"
    
    - Click on "Create access key"
    
    - Download the .csv file or copy/paste the "Access key ID" and "Secret access key" in a secure location.

 8. Execute the following command line to encode in base64 the CSR
    ```bash
    node -e "require('readline') .createInterface({input:process.stdin,output:process.stdout,historySize:0}) .question('PASTE CSR> ',p => { b64=Buffer.from(p.trim()).toString('base64');console.log(b64);process.exit(); })"
    ``` 

    Paste the CSR when prompted

 9. Test the API

  - Method: POST
  - URL: can be fetched from your AWS account: https://console.aws.amazon.com/apigateway
  - body:
    ```JSON
    {
      "ThingName": "<ThingName>",
      "CSR":"<Base64 encoded CSR>"
    }
    ```
  - Headers:
    - Authorization: The AWS Signature using the "Access key ID" and "Secret access key" of step 7.



