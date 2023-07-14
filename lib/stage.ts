import { Duration, Stage, StageProps, CfnOutput, Tags, Fn } from 'aws-cdk-lib'
import { Construct } from 'constructs';
import { S3CloudfrontStack } from './s3cloudfront';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';

export interface WebsiteStageProps extends StageProps {
    domainName: string;
    siteSubDomain: string;
}

export class WebsiteStage extends Stage {

    constructor(scope: Construct, id: string, props: WebsiteStageProps) {
        super(scope, id, props);
        s3BucketName: CfnOutput;
        Tags.of(this).add('csaa:contact', 'DLSRE@csaa.com');
        Tags.of(this).add('csaa:account-type', 'Sandbox');
        Tags.of(this).add('csaa:cost-center', '23240');
        Tags.of(this).add('csaa:support-group', 'SRE');

        const reactStack = new S3CloudfrontStack(this, props.siteSubDomain + 'FrontendStack', props);
        const importedsreDistributionIdValue = Fn.importValue(`${props.siteSubDomain}-srecloudfrontDistribution`);
        console.log('sreDistributionId ', importedsreDistributionIdValue.toString());

    }
}