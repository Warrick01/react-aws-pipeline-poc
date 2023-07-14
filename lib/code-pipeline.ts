import { Stack, StackProps, RemovalPolicy, SecretValue, Tags } from "aws-cdk-lib"
import { Construct } from "constructs"
import { BuildSpec, ComputeType, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, CodeCommitSourceAction, S3DeployAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
//import {  websiteBucketArn } from './variables';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { WebsiteStage } from './stage';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export class CodePipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        Tags.of(this).add('csaa:contact', 'DLSRE@csaa.com');
        Tags.of(this).add('csaa:account-type', 'Sandbox');
        Tags.of(this).add('csaa:cost-center', '23240');
        Tags.of(this).add('csaa:support-group', 'SRE');
        
        const githubSecretId = "github-token"

        //s3 bucket review
        // const websiteBucket = Bucket.fromBucketArn(this, 'websiteBucket', websiteBucketArn); //TODO - websiteBucketArn is a hardcoded value. need to replace

        //Build - store build artifact
        const artifactBucket = new Bucket(this, 'srereactPipelineArtifactBucket', {
            bucketName: 'sre-react-pipeline-artifact-bucket',
            removalPolicy: RemovalPolicy.DESTROY
        })

        //Declare pipeline
        const pipeline = new Pipeline(this, 'MyFirstPipeline', {
            artifactBucket,
            pipelineName: 'MyPipeline',
        });

        //1 Source - Action - Github Definition
        const sourceOutput = new Artifact();
        const sourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: 'Github_Source',
            output: sourceOutput,
            owner: 'rprdeep',
            repo: 'react-aws-pipeline-poc',
            oauthToken: SecretValue.secretsManager(githubSecretId),
            branch: 'main',
        });

        //2 Source - Stage
        const sourceStage = {
            stageName: 'Source',
            actions: [sourceAction],
            env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
        };

        //Build - custom build spec
        const reactBuildProject = new PipelineProject(this, 'reactBuild', {
            buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
                computeType: ComputeType.SMALL
            }
        })

        //Build - Action
        const buildOutput = new Artifact('reactBuildOutput')
        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'buildReactApp',
            input: sourceOutput,
            outputs: [buildOutput],
            project: reactBuildProject
        });

        //Build - Stage
        const buildStage = {
            stageName: 'Build',
            actions: [buildAction],
            env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
        };



        const websiteInfrastructureStage = new WebsiteStage(this, "QA", {
            domainName: "dash-sdx.n01.csaa-insurance.aaa.com",
            siteSubDomain: "qa",
            ...props,
        });

        // Deploy - Action
        const deployAction = new codepipeline_actions.S3DeployAction({
            actionName: 'S3Deploy',
            bucket: Bucket.fromBucketName(this, "WebsiteBucket", "qa.dash-sdx.n01.csaa-insurance.aaa.com"),
            input: buildOutput,
        });


        // const deployAction2 = new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
        //     sources: [s3deploy.Source.asset('./build')],
        //     destinationBucket: siteBucket,
        //    // distribution,
        //     distributionPaths: ['/*'],
        //   });

        //  Deploy - Stage
        const deployStage = {
            stageName: 'QA-Deploy',
            actions: [deployAction],
            env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
        };

        //3 add pipeline stages

        pipeline.addStage(sourceStage);
        pipeline.addStage(buildStage);
      //  pipeline.addStage(websiteInfrastructureStage);
        const testStage = pipeline.addStage(deployStage);
  

    }
}