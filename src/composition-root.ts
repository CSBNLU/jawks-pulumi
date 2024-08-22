import * as aws from "@pulumi/aws";
import { JWKS } from ".";
import * as Infrastructure from "./infrastructure";
import * as InfrastructureAdapters from "./infrastructure-adapters";
import * as pulumi from "@pulumi/pulumi";

export interface Configuration<AccessTokenPayload, RefreshTokenPayload> {
  customDomain?: aws.apigateway.DomainName;
  jwksFileKey?: string;
  kidVersionStagePrefix?: string;
  kidVersionStagePrefixSeparator?: string;
  replicas: Infrastructure.Region[];
  secretsRecoveryWindowInDays: number;
  region: string;
  resourcesPrefix: string;
  s3Bucket?: aws.s3.BucketV2;
}

export interface Output {
  accessTokenSecretARN: pulumi.Output<string>;
  accessTokenSecretID: pulumi.Output<string>;
  accessTokenSecretName: pulumi.Output<string>;
  jwksUri: pulumi.Output<string>;
  keySetRotationProcessorARN: pulumi.Output<string>;
  keySetRotationProcessorID: pulumi.Output<string>;
  keySetRotationProcessorName: pulumi.Output<string>;
  kidVersionStagePrefix: string;
  kidVersionStagePrefixSeparator: string;
  pulumiProjectName: string;
  pulumiStackName: string;
  refreshTokenSecretARN: pulumi.Output<string>;
  refreshTokenSecretID: pulumi.Output<string>;
  refreshTokenSecretName: pulumi.Output<string>;
  s3BucketARN: pulumi.Output<string>;
  s3BucketID: pulumi.Output<string>;
  s3BucketName: pulumi.Output<string>;
  tableARN: pulumi.Output<string>;
  tableName: pulumi.Output<string>;
  tableID: pulumi.Output<string>;
}

export const compose = <AccessTokenPayload, RefreshTokenPayload>(
  configuration: Configuration<AccessTokenPayload, RefreshTokenPayload>,
): Output => {
  const { resourcesPrefix, region, replicas, secretsRecoveryWindowInDays } =
    configuration;

  const kidVersionStagePrefix = configuration.kidVersionStagePrefix ?? "kid";
  const kidVersionStagePrefixSeparator =
    configuration.kidVersionStagePrefixSeparator ?? "#";

  const jwksFileKey = configuration.jwksFileKey ?? ".well-known/jwks.json";

  const jwksTable = Infrastructure.DynamoDB.jwksTable({
    prefix: resourcesPrefix,
    replicas: replicas,
  });

  const s3Bucket = Infrastructure.S3.configureJwksBucket({
    jwksFileKey,
    prefix: configuration.resourcesPrefix,
    providedBucket: configuration.s3Bucket,
  });

  const jwksModuleProps = {
    jwksFileKey,
  };

  const jwksModule: JWKS.API.JWKSModule = JWKS.Bindings.create({
    jwksTable: jwksTable.table,
    region,
    s3Bucket,
  })(jwksModuleProps);

  const keySetRotationProcessorProps = {
    jwksFileKey,
    prefix: configuration.resourcesPrefix,
  };

  const keySetRotationProcessor =
    InfrastructureAdapters.KeySetRotationProcessor.create({
      jwksModule,
      table: jwksTable,
      s3Bucket,
    })(keySetRotationProcessorProps);

  const privateKeyStore = Infrastructure.SecretsManager.create({
    prefix: resourcesPrefix,
    recoveryWindowInDays: secretsRecoveryWindowInDays,
    replicas: replicas,
  });
  const accessTokenSecret = privateKeyStore.provisionSecret({
    name: "AccessTokenPrivateKey",
    description: "Secret for the access token private key",
  });
  const refreshTokenSecret = privateKeyStore.provisionSecret({
    name: "RefreshTokenPrivateKey",
    description: "Secret for the refresh token private key",
  });

  const jwksUri = (() => {
    if (configuration.customDomain) {
      return configuration.customDomain.domainName.apply((domainName) => {
        return pulumi.output(`https://${domainName}/${jwksFileKey}`);
      });
    } else {
      return s3Bucket.bucket.apply((bucket) => {
        return pulumi.output(
          `https://${bucket}.s3.amazonaws.com/${jwksFileKey}`,
        );
      });
    }
  })();

  return {
    accessTokenSecretARN: accessTokenSecret.arn,
    accessTokenSecretID: accessTokenSecret.id,
    accessTokenSecretName: accessTokenSecret.name,
    jwksUri,
    keySetRotationProcessorARN: keySetRotationProcessor.arn,
    keySetRotationProcessorID: keySetRotationProcessor.id,
    keySetRotationProcessorName: keySetRotationProcessor.name,
    kidVersionStagePrefix,
    kidVersionStagePrefixSeparator,
    pulumiProjectName: pulumi.getProject(),
    pulumiStackName: pulumi.getStack(),
    refreshTokenSecretARN: refreshTokenSecret.arn,
    refreshTokenSecretID: refreshTokenSecret.id,
    refreshTokenSecretName: refreshTokenSecret.name,
    s3BucketARN: s3Bucket.arn,
    s3BucketID: s3Bucket.id,
    s3BucketName: s3Bucket.bucket,
    tableARN: jwksTable.table.arn,
    tableName: jwksTable.table.name,
    tableID: jwksTable.table.id,
  };
};
