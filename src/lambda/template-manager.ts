import { Iot } from "aws-sdk"
import provisioningTemplate from "./templates/provisioning-template.json"
import policyTemplate from "./templates/policy.json"

/**
 * This function creates a provisioning template that will be used by the registerThing function in AWS IOT SDK
 * The template used can be found in ./templates/provisioning-template.json
 * The policy attached to each thing created restricts the thing to only access MQTT topics 
 * that starts with the ThingName. This prevents differents things from being able to access each others topics.
 * 
 * More infonration can be found here: https://docs.aws.amazon.com/iot/latest/developerguide/provision-template.html
 */
export class TemplateManager {
  static createProvisioningTemplate(thingName: string, properties: any = {}): Iot.Types.TemplateBody {
    provisioningTemplate.Resources.thing.Properties = {
      ...provisioningTemplate.Resources.thing.Properties,
      ...properties,
    }
    const policyString = JSON.stringify(policyTemplate)
    const thingPolicy = policyString.replace('${ThingName$}', thingName)
    provisioningTemplate.Resources.policy.Properties.PolicyDocument = thingPolicy
    return JSON.stringify(provisioningTemplate)
  }
}
