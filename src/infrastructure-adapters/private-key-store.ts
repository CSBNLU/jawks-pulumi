import * as aws from "@pulumi/aws";

export interface Props {
  name: string;
  description: string;
  secret: string;
  versionStages: string[];
}

export interface PrivateKeyStore {
  provisionSecret: (props: {
    name: string;
    description: string;
  }) => aws.secretsmanager.Secret;
}
