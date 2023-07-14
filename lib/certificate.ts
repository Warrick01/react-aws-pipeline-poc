import { Stack, StackProps, CfnOutput } from "aws-cdk-lib"
import { Construct } from "constructs"
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { certificateArn } from './variables';

export class CertificateStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // TLS certificate
        const certificate = Certificate.fromCertificateArn(this, 'domainCert', certificateArn);
        new CfnOutput(this, 'Certificate', { value: certificate.certificateArn });
    }
}