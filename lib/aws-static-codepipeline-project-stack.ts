import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { App, Duration, Stack, StackProps, CfnOutput, SecretValue, Tags } from 'aws-cdk-lib'
import { Construct } from 'constructs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { WebsiteStage } from './stage';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { BuildSpec, ComputeType, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';

export class AwsS3StaticStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const config: string = "SREPOC";

    // const appConfig = new AppConfigUtility(appConfigDetails.appConfig.appName,
    //   appConfigDetails.appConfig.configProfile,
    //   appConfigDetails.appConfig.environment);

    //   let envVariables = {
    //     APPCONFIG_APPNAME: appConfigDetails.appConfig.appName,
    //     APPCONFIG_CONFIG_PROFILE: appConfigDetails.appConfig.configProfile,
    //     APPCONFIG_ENVIRONMENT: appConfigDetails.appConfig.environment,
    //        }

    // const appConfigResponse: any =  appConfig.getAppConfigWithProfile(profile, region);
    // Tags.of(this).add(appConfigResponse.tags.cdk.contact.key, appConfigResponse.tags.cdk.contact.value);
    // Tags.of(this).add(appConfigResponse.tags.cdk.accountType.key, appConfigResponse.tags.cdk.accountType.value);
    // Tags.of(this).add(appConfigResponse.tags.cdk.costCenter.key, appConfigResponse.tags.cdk.costCenter.value);
    // Tags.of(this).add(appConfigResponse.tags.cdk.supportGroup.key, appConfigResponse.tags.cdk.supportGroup.value);
    // Tags.of(this).add(appConfigResponse.tags.cdk.dataClassification.key, appConfigResponse.tags.cdk.dataClassification.value);
    // Tags.of(this).add(appConfigResponse.tags.cdk.contact.key, appConfigResponse.tags.cdk.contact.value);

    Tags.of(this).add('Joel', 'joeldomains.com');
    // Tags.of(this).add('csaa:account-type', 'Sandbox');
    // Tags.of(this).add('csaa:cost-center', '23240');
    // Tags.of(this).add('csaa:support-group', 'SRE');

    const githubSecretId = "github-token";
    const secret = new Secret(this, githubSecretId);

    // declare const codePipeline: Pipeline;

    const prebuild = new ShellStep('Prebuild', {
      input: CodePipelineSource.gitHub('Warrick01/react-client', 'main'),
      primaryOutputDirectory: './build',
      commands: [
        'npm ci',
        'npm run build',
      ]
    });

    const srepocpipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'SREFrontendStack',       // Create a new code pipeline 
      synth: new ShellStep('Synth', {        // pointed at our gihub repository 
        input: CodePipelineSource.gitHub('Warrick01/react-aws-pipeline-poc', 'main'),
        additionalInputs: {
          'react-client/build': prebuild,
        },
        commands: [
          'chmod +x ./build.sh',
          './build.sh',
        ],
      }),
      // codePipeline: codePipeline,
      codeBuildDefaults: {

        // Control the build environment
        buildEnvironment: {
          buildImage: LinuxBuildImage.STANDARD_5_0,
          computeType: ComputeType.LARGE
        }
      }
    });

    const websiteInfrastructureStage = new WebsiteStage(this, "QA", {
      domainName: "csaasre.cloud",
      siteSubDomain: "qa",
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
    });

    const testStage = srepocpipeline.addStage(websiteInfrastructureStage);
    testStage.addPost()

    const prodwebsiteInfrastructureStage = new WebsiteStage(this, "PROD", {
      domainName: "csaasre.cloud",
      siteSubDomain: "prod",
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
    });

    const prodStage = srepocpipeline.addStage(prodwebsiteInfrastructureStage);

    prodStage.addPre(new ManualApprovalStep('Manual approval step'));

  }
}