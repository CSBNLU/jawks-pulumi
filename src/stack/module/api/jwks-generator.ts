import * as aws from "@pulumi/aws";

export interface JWKSGenerator {
  execute: () => Promise<{
    accessTokenKeyID: string;
    refreshTokenKeyID: string;
    accessTokenSecret: aws.secretsmanager.Secret;
    refreshTokenSecret: aws.secretsmanager.Secret;
  }>;
}
