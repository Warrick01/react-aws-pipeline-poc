import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration, Tags } from "aws-cdk-lib"
import { Construct } from "constructs"
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { AllowedMethods, CachePolicy, CloudFrontWebDistribution, Distribution, HttpVersion, OriginAccessIdentity, PriceClass, SecurityPolicyProtocol, ViewerCertificate, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { HttpsRedirect } from 'aws-cdk-lib/aws-route53-patterns';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
//import { Bucket } from 'aws-cdk-lib/aws-s3';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { certificateArn } from './variables';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { S3DeployAction } from "aws-cdk-lib/aws-codepipeline-actions";

export interface FrontendStackProps extends StackProps {
    domainName: string;
    siteSubDomain: string;
}

export class S3CloudfrontStack extends Stack {

    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        Tags.of(this).add('csaa:contact', 'DLSRE@csaa.com');
        Tags.of(this).add('csaa:account-type', 'Sandbox');
        Tags.of(this).add('csaa:cost-center', '23240');
        Tags.of(this).add('csaa:support-group', 'SRE');

        //domain name formatting
        const siteDomain = props.siteSubDomain + '.' + props.domainName;
        new CfnOutput(this, "Site", { value: "https://" + siteDomain });

        //s3 bucket
        const bucket = new s3.Bucket(this, props.siteSubDomain + 'FrontendBucket', {
            bucketName: siteDomain,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.PUT,
                    ],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
        });

        //assigning S3 bucket name and ARN to be used across stack
        new CfnOutput(this, props.siteSubDomain + 's3Bucket', {
            exportName: `${props.siteSubDomain}-s3BucketArn`,
            description: "Bucketname",
            value: bucket.bucketArn
        })

        //certificates
        const certificate = Certificate.fromCertificateArn(this, props.siteSubDomain + 'websiteCert', certificateArn);

        //cache policy for cloudfront
        const cachePolicy = new CachePolicy(this, 'examplePolicy', {
            defaultTtl: Duration.hours(24),
            minTtl: Duration.hours(24),
            maxTtl: Duration.hours(24),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true
        })

        //cloudfrontOAI
        const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, props.siteSubDomain + 'cloudfront-OAI', {
            comment: 'OAI for ' + siteDomain
        });

        // Grant S3 access to cloudfront
        bucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [bucket.arnForObjects('*')],
            principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
        }));
        new CfnOutput(this, 'Bucket', { value: bucket.bucketName });


        // CloudFront distribution
        const distribution = new cloudfront.Distribution(this, props.siteSubDomain + 'SiteDistribution', {
            certificate: certificate,
            defaultRootObject: "index.html",
            domainNames: [siteDomain],
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            enableIpv6: true,

            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: Duration.minutes(30),
                }
            ],
            defaultBehavior: {
                origin: new cloudfront_origins.S3Origin(bucket, { originAccessIdentity: cloudfrontOAI }),
                compress: true,
                cachePolicy,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            }
        })

        //   new CfnOutput(this, props.siteSubDomain + 'DistributionId', { value: distribution.distributionId });

        //assigning Cloudfront name and ARN to be used across stack
        new CfnOutput(this, props.siteSubDomain + 'DistributionId', {
            exportName: `${props.siteSubDomain}-srecloudfrontDistribution`,
            description: "DistributionDomainName",
            value: distribution.distributionId
        })


        // new S3DeployAction({
        //     actionName: 'DeployReactApp',
        //     //distribution: distribution,
        //     input: build,
        //     bucket: bucket
        // })

        //    // Deploy site contents to S3 bucket
        new s3deploy.BucketDeployment(this, props.siteSubDomain + 'DeployWithInvalidation', {
            //sources: build.getParam.arguments.,
            sources: [s3deploy.Source.asset("react-client/build")],
            destinationBucket: bucket,
            distribution: distribution,
            distributionPaths: ['/*'],
        });
    }
}
