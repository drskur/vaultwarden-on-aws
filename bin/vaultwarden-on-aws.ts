#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VaultwardenOnAwsStack } from '../lib/vaultwarden-on-aws-stack';

const app = new cdk.App();
new VaultwardenOnAwsStack(app, 'VaultwardenOnAwsStack', {
  env: {
    account: '832344807991',
    region: 'ap-northeast-2'
  },
});