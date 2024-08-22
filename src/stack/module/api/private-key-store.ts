import * as aws from "@pulumi/aws";

export interface PrivateKeyStore {
  storeKey: (props: {
    privateKey: string;
    kid: string;
  }) => aws.secretsmanager.Secret;
}
