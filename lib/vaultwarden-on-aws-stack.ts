import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {IVpc, Port, SecurityGroup, Vpc} from "aws-cdk-lib/aws-ec2";
import {Cluster, ContainerImage} from "aws-cdk-lib/aws-ecs";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {FileSystem} from "aws-cdk-lib/aws-efs";
import {HostedZone} from "aws-cdk-lib/aws-route53";
import {Certificate} from "aws-cdk-lib/aws-certificatemanager";
import {SslPolicy} from "aws-cdk-lib/aws-elasticloadbalancingv2";

export class VaultwardenOnAwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // exist resources: please use your resources.
    const certificate = Certificate.fromCertificateArn(this, 'Cert', 'arn:aws:acm:ap-northeast-2:832344807991:certificate/d9c33c93-0573-4033-991b-f8d957acd3b3');
    const domainZone = HostedZone.fromLookup(this, 'Zone', { domainName: 'drskur.xyz' });
    const domainName = 'vaultwarden.drskur.xyz';

    const vpc = new Vpc(this, "vpc");
    const cluster = this.createEcsCluster(vpc);
    const ecsService = new ApplicationLoadBalancedFargateService(this, "vaultwarden-service", {
      cluster,
      certificate,
      domainZone,
      domainName,
      sslPolicy: SslPolicy.RECOMMENDED,
      redirectHTTP: true,
      desiredCount: 1,
      taskImageOptions: {
        image: ContainerImage.fromRegistry('vaultwarden/server'),
      },
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    const fsSG = this.createFsSecurityGroup(vpc);
    fsSG.connections.allowFrom(ecsService.service, Port.tcp(2049));
    const fs = new FileSystem(this, "efs", {
      vpc,
      fileSystemName: 'vaultwardenFS',
      securityGroup: fsSG,
    });
    const accessPoint = fs.addAccessPoint('vaultwarden-accessPoint', {
      path: '/data',
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '750'
      },
      posixUser: {
        gid: '1000',
        uid: '1000'
      }
    });

    const volumeName= 'vaultwarden-data';
    ecsService.taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        fileSystemId: fs.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: accessPoint.accessPointId
        }
      }
    });
    ecsService.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: '/data',
      sourceVolume: volumeName,
      readOnly: false,
    });

  }

  private createFsSecurityGroup(vpc: IVpc): SecurityGroup {
    return new SecurityGroup(this, 'fs-security-group', {
      vpc,
      allowAllOutbound: true,
    });
  }

  private createEcsCluster(vpc: Vpc): Cluster {
    return new Cluster(this, "cluster", {
      vpc,
      clusterName: 'valutwarden'
    })
  }


}
